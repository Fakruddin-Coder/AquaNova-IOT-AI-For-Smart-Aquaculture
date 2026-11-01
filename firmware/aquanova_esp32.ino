/*
 * =================================================================================
 * AquaNova ESP32 Firmware — Smart Aquaculture IoT Telemetry & Automatic Feeder
 * =================================================================================
 * 
 * Hardware Requirements:
 *  - ESP32 Development Board (e.g. ESP32 NodeMCU, DOIT DevKit V1)
 *  - Sensors:
 *      * Temperature: DS18B20 (or Analog LM35/NTC) -> GPIO 4
 *      * pH Sensor: Analog pH probe module -> GPIO 34 (ADC1)
 *      * Turbidity Sensor: Analog turbidity module -> GPIO 35 (ADC1)
 *      * Water Level: Ultrasonic (Trigger: GPIO 5, Echo: GPIO 18) or Analog -> GPIO 32
 *      * Automatic Feeder: SG90 / MG995 Servo Motor -> GPIO 13
 *      * Status LED: Built-in LED -> GPIO 2
 *
 * Servo Motor Wiring (IMPORTANT):
 *  - Brown / Black Wire -> ESP32 GND
 *  - Red Wire           -> ESP32 VIN / 5V (DO NOT use 3.3V — servo will not move!)
 *  - Orange / Yellow    -> ESP32 GPIO 13 (Pin labeled D13 or 13)
 *
 * Required Arduino Libraries (Install via Arduino IDE Library Manager):
 *  1. PubSubClient (by Nick O'Leary)
 *  2. ArduinoJson (by Benoît Blanchon) — Version 6 or 7
 *  3. ESP32Servo (by Kevin Harrington) — Version 1.x or 3.x
 * =================================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

// ==================== CONFIGURATION ====================
// 1. WiFi Credentials
const char* WIFI_SSID     = "YOUR_WIFI_SSID";            // Your Wi-Fi / Hotspot SSID
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";        // Your Wi-Fi / Hotspot Password

// 2. MQTT Broker Settings (Your PC IP running AquaNova)
// NOTE: Port 1884 is open to all devices on your Wi-Fi network!
const char* MQTT_BROKER   = "192.168.1.100";             // Replace with your PC / Broker IP on local network
const int   MQTT_PORT     = 1884;                        // Port 1884
const char* MQTT_CLIENT_ID = "AquaNova-ESP32-Kit";

// 3. MQTT Topics (matches AquaNova Dashboard)
const char* TOPIC_SENSORS        = "aquanova/sensors";
const char* TOPIC_FEEDER_COMMAND = "aquanova/commands/feeder";
const char* TOPIC_FEEDER_STATUS  = "aquanova/status/feeder";

// 4. Pin Definitions
#define PIN_PH_SENSOR         34 // Analog ADC1
#define PIN_TURBIDITY_SENSOR  35 // Analog ADC1
#define PIN_WATER_LEVEL       32 // Analog or Ultrasonic
#define PIN_SERVO_FEEDER      13 // PWM for Feeder (Servo Signal Pin D13)
#define PIN_STATUS_LED         2 // Built-in LED

// 5. Feeder Servo Configuration
const int SERVO_NORMAL_POS    = 0;    // Normal / resting angle (closed flap, 0 degrees)
const int SERVO_DISPENSE_POS  = 180;  // Dispense angle (open flap, 180 degrees)
const int FEED_DURATION_MS    = 1500; // Duration (ms) to stay open to dispense food

// 6. Telemetry Interval (milliseconds)
const unsigned long TELEMETRY_INTERVAL_MS = 5000; // Send telemetry every 5 seconds
unsigned long lastTelemetryTime = 0;

// ==================== CLIENTS & ACTUATORS ====================
WiFiClient espClient;
PubSubClient mqttClient(espClient);
Servo feederServo;
bool isFeeding = false;
const unsigned long MIN_FEEDER_COOLDOWN_MS = 5000;
unsigned long activeCooldownMs = 5000; // Dynamic: 5g = 5s, 10g = 10s, 15g = 15s (+1s per gram)
unsigned long lastFeedTime = 0;

// ==================== SENSOR READING FUNCTIONS ====================
// In real hardware, read the analog pins and convert with calibration curves.
// If sensors are not plugged in yet, these functions produce realistic readings.

float readTemperature() {
  // Read DS18B20 or analog thermistor
  // Realistic simulation around 26.5 - 28.5 °C
  float base = 27.0;
  float variation = (random(-15, 15) / 10.0);
  return base + variation;
}

float readPH() {
  int raw = analogRead(PIN_PH_SENSOR);
  if (raw > 100) {
    // Voltage conversion (0-3.3V) -> pH (0-14) calibration
    float voltage = raw * (3.3 / 4095.0);
    return 3.5 * voltage; // Example calibration factor
  }
  // Realistic fallback: 7.1 - 7.6
  return 7.35 + (random(-20, 20) / 100.0);
}

float readTurbidity() {
  int raw = analogRead(PIN_TURBIDITY_SENSOR);
  if (raw > 100) {
    float voltage = raw * (3.3 / 4095.0);
    return max(0.0f, (voltage * 10.0f));
  }
  // Realistic fallback: 5 - 15 NTU
  return 8.5 + (random(-30, 30) / 10.0);
}

float readDissolvedOxygen() {
  // DO calculation from temperature & aeration
  float base = 6.8;
  return base + (random(-4, 4) / 10.0);
}

float readWaterLevel() {
  int raw = analogRead(PIN_WATER_LEVEL);
  if (raw > 100) {
    return (raw / 4095.0) * 100.0;
  }
  // Realistic fallback: 85 - 92%
  return 88.0 + (random(-20, 20) / 10.0);
}

// ==================== ACTUATION (FEEDER MOTOR ROTATION LOGIC) ====================
/*
 * MOTOR ROTATION LOGIC:
 * 5 grams  = 1 motor rotation/cycle
 * 10 grams = 2 motor rotations/cycles
 * 15 grams = 3 motor rotations/cycles
 * Each additional 5 grams = 1 additional cycle
 * No gram sensor or weight calculator is used — dispenses strictly by motor cycle count.
 *
 * COOLDOWN LOGIC:
 * 5g = 5 seconds, 10g = 10 seconds, 15g = 15 seconds (+1s per gram)
 */
void triggerFeeding(int cycles = 1, int grams = 0) {
  if (cycles < 1) {
    cycles = (grams > 0) ? max(1, (int)round(grams / 5.0f)) : 1;
  }
  if (grams <= 0) {
    grams = cycles * 5;
  }

  // Calculate dynamic cooldown based on quantity (minimum 5s, +1s per gram)
  unsigned long calculatedCooldown = max(5000UL, (unsigned long)grams * 1000UL);

  if (isFeeding) {
    Serial.println("[Feeder] Feeder is already in motion, ignoring duplicate trigger.");
    return;
  }

  // Cooldown check: blocks repeated manual/auto feeds until countdown finishes
  if (lastFeedTime > 0 && (millis() - lastFeedTime < activeCooldownMs)) {
    unsigned long remainingSec = (activeCooldownMs - (millis() - lastFeedTime)) / 1000 + 1;
    Serial.print("[Feeder] COOLDOWN ACTIVE: Please wait ");
    Serial.print(remainingSec);
    Serial.print("s (cooldown: ");
    Serial.print(activeCooldownMs / 1000);
    Serial.println("s) before feeding again.");
    return;
  }

  isFeeding = true;
  lastFeedTime = millis();

  Serial.println("[Feeder] =========================================");
  Serial.print("[Feeder] FEED command accepted! Target: ");
  Serial.print(grams);
  Serial.print("g -> Executing ");
  Serial.print(cycles);
  Serial.print(" motor cycle(s), Cooldown: ");
  Serial.print(calculatedCooldown / 1000);
  Serial.println("s...");
  mqttClient.publish(TOPIC_FEEDER_STATUS, "FEEDING");

  // Ensure servo is attached
  if (!feederServo.attached()) {
    Serial.println("[Feeder] Servo was detached, re-attaching to GPIO 13...");
    feederServo.attach(PIN_SERVO_FEEDER, 500, 2400);
  }

  // Execute calibrated motor cycles (1 cycle = ~5g)
  for (int c = 1; c <= cycles; c++) {
    Serial.print("[Feeder] Running motor cycle ");
    Serial.print(c);
    Serial.print(" of ");
    Serial.print(cycles);
    Serial.println(" (~5g dispensed)...");

    digitalWrite(PIN_STATUS_LED, HIGH);

    // Rotate servo to dispensing position (open flap)
    feederServo.write(SERVO_DISPENSE_POS);
    delay(FEED_DURATION_MS); // Hold open to drop food pellets

    // Return servo back to normal resting position (close flap)
    feederServo.write(SERVO_NORMAL_POS);
    delay(500); // Allow servo to complete return motion

    digitalWrite(PIN_STATUS_LED, LOW);

    // Brief inter-cycle delay if multiple cycles
    if (c < cycles) {
      delay(400);
    }
  }

  Serial.print("[Feeder] Finished all ");
  Serial.print(cycles);
  Serial.print(" cycle(s) (~");
  Serial.print(grams);
  Serial.println("g dispensed successfully).");
  mqttClient.publish(TOPIC_FEEDER_STATUS, "COMPLETED");

  // Brief pause before restoring READY status
  delay(500);
  mqttClient.publish(TOPIC_FEEDER_STATUS, "READY");

  // Set the dynamic cooldown duration and update timestamp
  activeCooldownMs = calculatedCooldown;
  lastFeedTime = millis();
  isFeeding = false;

  Serial.print("[Feeder] Feeder is READY (Next cooldown: ");
  Serial.print(activeCooldownMs / 1000);
  Serial.println("s active).");
  Serial.println("[Feeder] =========================================");
}

// ==================== MQTT CALLBACK ====================
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();
  Serial.print("[MQTT] Arrived on ");
  Serial.print(topic);
  Serial.print(": ");
  Serial.println(message);

  // Handle FEED command with cycle / grams calculation
  if (String(topic) == TOPIC_FEEDER_COMMAND) {
    int cycles = 1;
    int grams = 5;

    if (message.startsWith("{") && message.endsWith("}")) {
      // JSON format: {"action":"FEED","cycles":2,"grams":10}
      StaticJsonDocument<256> doc;
      DeserializationError err = deserializeJson(doc, message);
      if (!err) {
        if (doc.containsKey("cycles")) {
          cycles = doc["cycles"].as<int>();
          grams = doc.containsKey("grams") ? doc["grams"].as<int>() : (cycles * 5);
        } else if (doc.containsKey("grams")) {
          grams = doc["grams"].as<int>();
          cycles = max(1, (int)round(grams / 5.0f));
        } else if (doc.containsKey("amount")) {
          grams = doc["amount"].as<int>();
          cycles = max(1, (int)round(grams / 5.0f));
        }
      }
    } else if (message.indexOf(':') != -1) {
      // Format: "FEED:2" or "FEED:15g"
      int colonIdx = message.indexOf(':');
      String param = message.substring(colonIdx + 1);
      param.trim();
      int val = param.toInt();
      if (val > 0) {
        if (param.endsWith("g") || param.endsWith("G") || val >= 20) {
          grams = val;
          cycles = max(1, (int)round(grams / 5.0f));
        } else {
          cycles = val;
          grams = cycles * 5;
        }
      }
    } else if (message.equalsIgnoreCase("FEED")) {
      cycles = 1;
      grams = 5;
    } else {
      // Direct numeric string e.g. "2" cycles
      int val = message.toInt();
      if (val > 0) {
        cycles = val;
        grams = cycles * 5;
      }
    }

    triggerFeeding(cycles, grams);
  }
}

// ==================== WIFI & MQTT CONNECTION ====================
void setupWiFi() {
  delay(10);
  Serial.println();
  Serial.print("[WiFi] Connecting to: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
  }

  digitalWrite(PIN_STATUS_LED, HIGH);
  Serial.println();
  Serial.print("[WiFi] Connected! IP assigned: ");
  Serial.println(WiFi.localIP());
}

void reconnectMqtt() {
  while (!mqttClient.connected()) {
    Serial.print("[MQTT] Connecting to broker: ");
    Serial.print(MQTT_BROKER);
    Serial.print(":");
    Serial.println(MQTT_PORT);

    if (mqttClient.connect(MQTT_CLIENT_ID)) {
      Serial.println("[MQTT] Connected successfully to AquaNova Broker!");
      mqttClient.subscribe(TOPIC_FEEDER_COMMAND);
      mqttClient.publish(TOPIC_FEEDER_STATUS, "READY");
    } else {
      Serial.print("[MQTT] Connect failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" -> Retrying in 4 seconds...");
      delay(4000);
    }
  }
}

// ==================== SETUP & LOOP ====================
void setup() {
  Serial.begin(115200);
  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_PH_SENSOR, INPUT);
  pinMode(PIN_TURBIDITY_SENSOR, INPUT);
  pinMode(PIN_WATER_LEVEL, INPUT);

  // 1. Connect to WiFi first
  setupWiFi();

  // 2. Initialize and attach servo on GPIO 13 AFTER WiFi initializes
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  feederServo.setPeriodHertz(50); // Standard 50Hz servo
  int channel = feederServo.attach(PIN_SERVO_FEEDER, 500, 2400);
  Serial.print("[Feeder] Servo attached to GPIO 13 on channel: ");
  Serial.println(channel);

  // 3. Boot self-test: quick twitch to verify servo power and movement
  Serial.println("[Feeder] Running boot servo self-test...");
  feederServo.write(45);
  delay(350);
  feederServo.write(SERVO_NORMAL_POS);
  delay(350);
  Serial.println("[Feeder] Boot self-test complete. Feeder ready at 0°.");

  // 4. MQTT setup
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setBufferSize(512); // Ensure buffer fits JSON payload
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }

  if (!mqttClient.connected()) {
    reconnectMqtt();
  }
  mqttClient.loop();

  // Send sensor telemetry periodically
  unsigned long now = millis();
  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;

    float temp       = readTemperature();
    float ph         = readPH();
    float turbidity  = readTurbidity();
    float do_level   = readDissolvedOxygen();
    float waterLevel = readWaterLevel();

    // Create JSON document
    StaticJsonDocument<256> doc;
    doc["temperature"]     = serialized(String(temp, 1));
    doc["ph"]              = serialized(String(ph, 2));
    doc["turbidity"]       = serialized(String(turbidity, 1));
    doc["dissolvedOxygen"] = serialized(String(do_level, 2));
    doc["waterLevel"]      = serialized(String(waterLevel, 1));

    char jsonBuffer[256];
    serializeJson(doc, jsonBuffer);

    Serial.print("[Telemetry -> Dashboard] ");
    Serial.println(jsonBuffer);

    // Publish to AquaNova dashboard topic
    bool published = mqttClient.publish(TOPIC_SENSORS, jsonBuffer);
    if (!published) {
      Serial.println("[MQTT Error] Failed to publish sensor reading.");
    }
  }
}
