/*
 * =================================================================================
 * AquaNova ESP32-CAM Firmware — Real-Time Aquaculture Video Streaming & Telemetry
 * =================================================================================
 * 
 * Hardware Requirements:
 *  - Board: AI-Thinker ESP32-CAM (with OV2640 camera module)
 *  - Flash LED: Built-in high-power LED on GPIO 4
 *  - Programmer: FTDI USB-to-TTL Programmer (or Arduino Uno as USB-to-Serial)
 *
 * Flashing Connections (FTDI -> ESP32-CAM):
 *  - FTDI VCC (5V)  -> ESP32-CAM 5V (Recommend 5V 2A power supply for stable Wi-Fi)
 *  - FTDI GND       -> ESP32-CAM GND
 *  - FTDI TX        -> ESP32-CAM U0R (GPIO 3)
 *  - FTDI RX        -> ESP32-CAM U0T (GPIO 1)
 *  - ESP32-CAM IO0  -> ESP32-CAM GND  *** IMPORTANT: Connect IO0 to GND during flashing! ***
 *                                     *** Disconnect IO0 from GND and press RESET to run! ***
 *
 * Arduino IDE Settings:
 *  - Board: "AI Thinker ESP32-CAM" (or "ESP32 Wrover Module")
 *  - CPU Frequency: 240MHz (WiFi/BT)
 *  - Flash Frequency: 80MHz
 *  - Flash Mode: QIO
 *  - Partition Scheme: "Huge APP (3MB No OTA/1MB SPIFFS)"
 *  - Core Debug Level: None
 *  - Upload Speed: 115200 (or 921600 if FTDI supports it)
 *
 * Required Libraries:
 *  - Built into ESP32 board package: esp_camera.h, WiFi.h, esp_http_server.h
 *  - PubSubClient (by Nick O'Leary)
 *  - ArduinoJson (by Benoît Blanchon)
 * =================================================================================
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "esp_http_server.h"

// ==================== CONFIGURATION ====================

// 1. Wi-Fi Credentials (Matches AquaNova Main ESP32)
const char* WIFI_SSID     = "YOUR_WIFI_SSID";            // Your Wi-Fi / Hotspot SSID
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";        // Your Wi-Fi / Hotspot Password

// 2. MQTT Broker Settings (Your PC IP running AquaNova Mosquitto)
const char* MQTT_BROKER   = "192.168.1.100";             // Replace with your PC / Broker IP
const int   MQTT_PORT     = 1884;                        // Mosquitto Port
const char* MQTT_CLIENT_ID = "AquaNova-ESP32-CAM";

// 3. MQTT Topics
const char* TOPIC_CAMERA_STATUS  = "aquanova/camera/status";
const char* TOPIC_CAMERA_COMMAND = "aquanova/commands/camera";

// 4. AI-Thinker ESP32-CAM Pin Definitions
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// Built-in High Power Flash LED on AI-Thinker board
#define FLASH_LED_PIN      4

// ==================== GLOBAL CLIENTS & HANDLES ====================
WiFiClient espClient;
PubSubClient mqttClient(espClient);
httpd_handle_t stream_httpd = NULL;

bool flashState = false;
unsigned long lastStatusPublish = 0;
const unsigned long STATUS_INTERVAL = 10000; // Publish status every 10s

#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

// ==================== FLASH CONTROL ====================
void setFlash(bool on) {
  flashState = on;
  digitalWrite(FLASH_LED_PIN, on ? HIGH : LOW);
  Serial.printf("[AquaNova CAM] Flash LED: %s\n", on ? "ON" : "OFF");
}

// ==================== HTTP REQUEST HANDLERS ====================

// 1. MJPEG Live Video Stream Handler (/stream)
static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t * _jpg_buf = NULL;
  char part_buf[128]; // Buffer for boundary and HTTP multipart headers

  int client_fd = httpd_req_to_sockfd(req);
  Serial.printf("[AquaNova CAM] >>> Live video stream client CONNECTED (socket fd: %d)\n", client_fd);

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if (res != ESP_OK) {
    Serial.printf("[AquaNova CAM] Failed to set stream Content-Type: %d\n", res);
    return res;
  }

  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, OPTIONS");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store, must-revalidate, pre-check=0, post-check=0, max-age=0");
  httpd_resp_set_hdr(req, "Pragma", "no-cache");
  httpd_resp_set_hdr(req, "Expires", "0");
  httpd_resp_set_hdr(req, "X-Framerate", "10");

  uint32_t frames_sent = 0;
  uint32_t consecutive_capture_failures = 0;
  unsigned long last_fps_log = millis();
  int64_t last_frame_time = esp_timer_get_time();

  while (true) {
    int64_t frame_start_us = esp_timer_get_time();

    fb = esp_camera_fb_get();
    if (!fb) {
      consecutive_capture_failures++;
      Serial.printf("[AquaNova CAM] Camera capture retry (%u/5)...\n", consecutive_capture_failures);
      if (consecutive_capture_failures >= 5) {
        Serial.println("[AquaNova CAM] Camera capture failed 5 consecutive times. Exiting stream.");
        res = ESP_FAIL;
        break;
      }
      vTaskDelay(pdMS_TO_TICKS(50));
      continue;
    }
    consecutive_capture_failures = 0;

    _jpg_buf_len = fb->len;
    _jpg_buf = fb->buf;

    // Send boundary delimiter FIRST before each frame part
    res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    if (res == ESP_OK) {
      size_t hlen = snprintf(part_buf, sizeof(part_buf), _STREAM_PART, _jpg_buf_len);
      res = httpd_resp_send_chunk(req, part_buf, hlen);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    }

    // Immediately release frame buffer back to DMA pool
    esp_camera_fb_return(fb);
    fb = NULL;
    _jpg_buf = NULL;

    // Break immediately if client disconnected or socket send failed
    if (res != ESP_OK) {
      Serial.printf("[AquaNova CAM] <<< Stream client DISCONNECTED (socket fd: %d, res: %d)\n", client_fd, res);
      break;
    }

    frames_sent++;
    if (millis() - last_fps_log >= 5000) {
      int64_t now = esp_timer_get_time();
      float fps = (float)frames_sent / ((now - last_frame_time) / 1000000.0f);
      Serial.printf("[AquaNova CAM] Live streaming active: %u frames dispatched (~%.1f FPS), last frame: %u bytes\n",
                    frames_sent, fps, (unsigned int)_jpg_buf_len);
      frames_sent = 0;
      last_frame_time = now;
      last_fps_log = millis();
    }

    // Limit stream to ~10 FPS (100ms cycle) while feeding watchdog and yielding to WiFi/MQTT
    int64_t frame_duration_us = esp_timer_get_time() - frame_start_us;
    int delay_ms = 100 - (int)(frame_duration_us / 1000);
    if (delay_ms < 10) delay_ms = 10;
    vTaskDelay(pdMS_TO_TICKS(delay_ms));
  }

  return res;
}

// 2. Single Snapshot Capture Handler (/capture)
static esp_err_t capture_handler(httpd_req_t *req) {
  Serial.println("[AquaNova CAM] Snapshot requested via /capture");
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[AquaNova CAM] Camera capture failed in /capture");
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=aquanova_snapshot.jpg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, OPTIONS");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store, must-revalidate");

  size_t fb_len = fb->len;
  esp_err_t res = httpd_resp_send(req, (const char *)fb->buf, fb_len);
  esp_camera_fb_return(fb);
  Serial.printf("[AquaNova CAM] Snapshot served (%u bytes, res: %d)\n", (unsigned int)fb_len, res);
  return res;
}

// 3. Flash LED Control Handler (/flash?state=1 or /flash?state=0)
static esp_err_t flash_handler(httpd_req_t *req) {
  char query[32];
  if (httpd_req_get_url_query_str(req, query, sizeof(query)) == ESP_OK) {
    char stateStr[8];
    if (httpd_query_key_value(query, "state", stateStr, sizeof(stateStr)) == ESP_OK) {
      if (strcmp(stateStr, "1") == 0 || strcmp(stateStr, "on") == 0) {
        setFlash(true);
      } else if (strcmp(stateStr, "0") == 0 || strcmp(stateStr, "off") == 0) {
        setFlash(false);
      } else if (strcmp(stateStr, "toggle") == 0) {
        setFlash(!flashState);
      }
    }
  } else {
    // If no query string, default to toggle
    setFlash(!flashState);
  }

  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, OPTIONS");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "*");
  
  char resp[128];
  snprintf(resp, sizeof(resp), "{\"success\":true,\"flash\":%s}", flashState ? "true" : "false");
  return httpd_resp_send(req, resp, strlen(resp));
}

// 4. Status / Diagnostics Handler (/status)
static esp_err_t status_handler(httpd_req_t *req) {
  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "GET, OPTIONS");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "*");

  String ip = WiFi.localIP().toString();
  char resp[300];
  snprintf(resp, sizeof(resp),
    "{\"status\":\"online\",\"ip\":\"%s\",\"port\":81,\"stream_url\":\"http://%s:81/stream\",\"capture_url\":\"http://%s:81/capture\",\"resolution\":\"QVGA 320x240\",\"flash\":%s,\"rssi\":%d,\"free_heap\":%u}",
    ip.c_str(), ip.c_str(), ip.c_str(), flashState ? "true" : "false", WiFi.RSSI(), ESP.getFreeHeap()
  );
  return httpd_resp_send(req, resp, strlen(resp));
}

// 5. Start HTTP Streaming Server
void startCameraServer() {
  if (stream_httpd != NULL) {
    httpd_stop(stream_httpd);
    stream_httpd = NULL;
  }

  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 81;
  config.ctrl_port = 32768;
  config.max_uri_handlers = 8;
  config.stack_size = 8192;       // Generous stack size for HTTP image chunks
  config.lru_purge_enable = true; // Auto-purge stale/disconnected sockets to prevent socket exhaustion
  config.send_wait_timeout = 10;  // 10s timeout prevents premature socket drop on network jitter
  config.recv_wait_timeout = 10;  // 10s receive timeout
  config.max_open_sockets = 5;    // Safe socket limit
  config.backlog_conn = 5;

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t capture_uri = {
    .uri       = "/capture",
    .method    = HTTP_GET,
    .handler   = capture_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t flash_uri = {
    .uri       = "/flash",
    .method    = HTTP_GET,
    .handler   = flash_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t status_uri = {
    .uri       = "/status",
    .method    = HTTP_GET,
    .handler   = status_handler,
    .user_ctx  = NULL
  };

  Serial.println("[AquaNova CAM] Starting HTTP streaming server on port 81...");
  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &stream_uri);
    httpd_register_uri_handler(stream_httpd, &capture_uri);
    httpd_register_uri_handler(stream_httpd, &flash_uri);
    httpd_register_uri_handler(stream_httpd, &status_uri);
    Serial.println("[AquaNova CAM] Camera HTTP server successfully started on port 81!");
  } else {
    Serial.println("[AquaNova CAM] CRITICAL: Failed to start HTTP server!");
  }
}

// ==================== CAMERA INITIALIZATION ====================
bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  
  // 16MHz clock provides rock-solid stability and prevents DMA FB-OVF
  config.xclk_freq_hz = 16000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Use lightweight QVGA (320x240) resolution for fast, low-bandwidth aquaculture video
  config.frame_size = FRAMESIZE_QVGA;

  if (psramFound()) {
    Serial.println("[AquaNova CAM] PSRAM detected! Setting QVGA (320x240) with dual frame buffers");
    config.jpeg_quality = 15; // Set JPEG quality to 15 for smaller image sizes and reliable transmission
    config.fb_count = 2;      // Dual buffer avoids frame tearing
    #if defined(CAMERA_FB_IN_PSRAM)
    config.fb_location = CAMERA_FB_IN_PSRAM;
    #endif
    #if defined(CAMERA_GRAB_LATEST)
    config.grab_mode = CAMERA_GRAB_LATEST; // Drops stale frames, prevents FB-OVF
    #endif
  } else {
    Serial.println("[AquaNova CAM] No PSRAM found. Setting QVGA (320x240) with single frame buffer");
    config.jpeg_quality = 15;
    config.fb_count = 1;
    #if defined(CAMERA_FB_IN_DRAM)
    config.fb_location = CAMERA_FB_IN_DRAM;
    #endif
    #if defined(CAMERA_GRAB_LATEST)
    config.grab_mode = CAMERA_GRAB_LATEST;
    #endif
  }

  // Camera initialization
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[AquaNova CAM] Camera init failed with error 0x%x\n", err);
    return false;
  }

  // Sensor adjustments for clear water vision
  sensor_t * s = esp_camera_sensor_get();
  if (s) {
    s->set_brightness(s, 1);     // -2 to 2
    s->set_contrast(s, 1);       // -2 to 2
    s->set_saturation(s, 1);     // -2 to 2
    s->set_whitebal(s, 1);       // Auto white balance enable
    s->set_awb_gain(s, 1);       // Auto white balance gain enable
    s->set_wb_mode(s, 0);        // 0: Auto
    // s->set_vflip(s, 1);       // Uncomment if camera is mounted upside down
    // s->set_hmirror(s, 1);     // Uncomment if camera image is mirrored
  }

  Serial.println("[AquaNova CAM] OV2640 Camera initialized successfully at QVGA (320x240)!");
  return true;
}

// ==================== WIFI & MQTT FUNCTIONS ====================
void setupWiFi() {
  Serial.printf("\n[AquaNova CAM] Connecting to WiFi SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[AquaNova CAM] WiFi Connected!");
    Serial.printf("[AquaNova CAM] IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[AquaNova CAM] RSSI Signal: %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("\n[AquaNova CAM] WiFi Connection Failed! Will retry in background...");
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  message.trim();
  Serial.printf("[AquaNova CAM] MQTT [%s] -> %s\n", topic, message.c_str());

  if (String(topic) == TOPIC_CAMERA_COMMAND) {
    if (message.equalsIgnoreCase("FLASH_ON")) {
      setFlash(true);
    } else if (message.equalsIgnoreCase("FLASH_OFF")) {
      setFlash(false);
    } else if (message.equalsIgnoreCase("FLASH_TOGGLE")) {
      setFlash(!flashState);
    }
  }
}

void reconnectMQTT() {
  if (mqttClient.connected()) return;
  if (WiFi.status() != WL_CONNECTED) return;

  Serial.printf("[AquaNova CAM] Connecting to MQTT Broker at %s:%d...\n", MQTT_BROKER, MQTT_PORT);
  if (mqttClient.connect(MQTT_CLIENT_ID)) {
    Serial.println("[AquaNova CAM] Connected to MQTT Broker!");
    mqttClient.subscribe(TOPIC_CAMERA_COMMAND);
    publishCameraStatus();
  } else {
    Serial.printf("[AquaNova CAM] MQTT connection failed, rc=%d (will retry)\n", mqttClient.state());
  }
}

void publishCameraStatus() {
  if (!mqttClient.connected()) return;

  JsonDocument doc;
  doc["status"] = "online";
  doc["ip"] = WiFi.localIP().toString();
  doc["stream_url"] = "http://" + WiFi.localIP().toString() + ":81/stream";
  doc["capture_url"] = "http://" + WiFi.localIP().toString() + ":81/capture";
  doc["model"] = "AI-Thinker ESP32-CAM (OV2640)";
  doc["resolution"] = "QVGA 320x240";
  doc["flash"] = flashState;

  char buffer[256];
  serializeJson(doc, buffer);
  mqttClient.publish(TOPIC_CAMERA_STATUS, buffer, true);
  Serial.printf("[AquaNova CAM] Published status: %s\n", buffer);
}

// ==================== SETUP & LOOP ====================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n========================================================");
  Serial.println("  AquaNova ESP32-CAM — Live Aquaculture Video Monitor  ");
  Serial.println("========================================================");

  // 1. Setup Flash LED
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);

  // Flash LED test blink (150ms) to indicate power on
  digitalWrite(FLASH_LED_PIN, HIGH);
  delay(150);
  digitalWrite(FLASH_LED_PIN, LOW);

  // 2. Initialize Camera FIRST
  if (!initCamera()) {
    Serial.println("[AquaNova CAM] CRITICAL: Camera initialization failed! Check ribbon cable connection.");
  }

  // 3. Connect to Wi-Fi
  setupWiFi();

  // 4. Start HTTP Streaming Server on Port 81
  startCameraServer();

  // 5. Setup MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  String localIp = WiFi.localIP().toString();
  Serial.println("\n--------------------------------------------------------");
  Serial.println(" READY FOR LIVE AQUACULTURE MONITORING!                 ");
  Serial.printf (" Live Video Stream : http://%s:81/stream\n", localIp.c_str());
  Serial.printf (" Snapshot Capture  : http://%s:81/capture\n", localIp.c_str());
  Serial.printf (" Status Telemetry  : http://%s:81/status\n", localIp.c_str());
  Serial.printf (" Flashlight Toggle : http://%s:81/flash?state=toggle\n", localIp.c_str());
  Serial.println(" Open the AquaNova Web Dashboard -> Live Monitoring     ");
  Serial.println("--------------------------------------------------------\n");
}

void loop() {
  // Ensure WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }

  // Maintain MQTT connection
  if (!mqttClient.connected()) {
    static unsigned long lastMqttRetry = 0;
    if (millis() - lastMqttRetry > 5000) {
      lastMqttRetry = millis();
      reconnectMQTT();
    }
  } else {
    mqttClient.loop();
  }

  // Periodically publish status
  if (millis() - lastStatusPublish > STATUS_INTERVAL) {
    lastStatusPublish = millis();
    if (mqttClient.connected()) {
      publishCameraStatus();
    }
  }

  delay(10);
}
