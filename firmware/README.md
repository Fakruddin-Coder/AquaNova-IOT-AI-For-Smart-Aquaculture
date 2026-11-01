# AquaNova Hardware Firmware Guide

This directory contains the complete firmware for the AquaNova Smart Aquaculture IoT system:

1. **`aquanova_esp32.ino`** — Main IoT Node (Telemetry sensors: Temperature, pH, Turbidity, Water Level + Automatic Servo Feeder).
2. **`aquanova_esp32_cam/aquanova_esp32_cam.ino`** — Vision Node (AI-Thinker ESP32-CAM: Real-time MJPEG live video streaming, snapshot capture, night flash LED, and MQTT announcements).

---

## 📷 Part 1: AquaNova ESP32-CAM (Live Video Stream)

### Hardware Requirements
- **Module:** AI-Thinker ESP32-CAM with OV2640 camera sensor.
- **Programmer:** FTDI USB-to-TTL Serial adapter (or CP2102 / CH340).
- **Power:** 5V / 2A dedicated supply (or reliable 5V USB port) to avoid Wi-Fi brownouts.

### FTDI Programmer Flashing Wiring Diagram

| FTDI Adapter Pin | ESP32-CAM Pin | Notes |
|---|---|---|
| **VCC (5V)** | **5V / VIN** | Set FTDI jumper to **5V** |
| **GND** | **GND** | Common Ground |
| **TXD** | **U0R (GPIO 3)** | Programmer Transmit -> ESP32 Receive |
| **RXD** | **U0T (GPIO 1)** | Programmer Receive -> ESP32 Transmit |
| **GND** | **IO0 (GPIO 0)** | **CRUCIAL:** Connect IO0 to GND during upload! |

> ⚠️ **IMPORTANT FLASHING STEP:**
> 1. Connect **IO0 to GND** before plugging in the USB cable.
> 2. Press the **RESET** button on the ESP32-CAM (or replug USB).
> 3. Click **Upload** in Arduino IDE.
> 4. Once uploaded, **disconnect IO0 from GND** and press **RESET**.
> 5. Open Serial Monitor at **115200 baud** to see the IP address and live stream link!

### Arduino IDE Settings
- **Board:** `AI Thinker ESP32-CAM`
- **CPU Frequency:** `240MHz (WiFi/BT)`
- **Flash Frequency:** `80MHz`
- **Flash Mode:** `QIO`
- **Partition Scheme:** `Huge APP (3MB No OTA/1MB SPIFFS)`
- **Upload Speed:** `115200` (or `921600` if your programmer supports high speed)

### Endpoints Served by ESP32-CAM
Once connected to your Wi-Fi, the ESP32-CAM serves:
- **Live Stream:** `http://<ESP32_CAM_IP>:81/stream` (Continuous MJPEG video stream)
- **Snapshot Capture:** `http://<ESP32_CAM_IP>:81/capture` (Single JPEG frame)
- **Flashlight Control:** `http://<ESP32_CAM_IP>:81/flash?state=toggle` (Turns flash LED on/off)
- **Status / Health:** `http://<ESP32_CAM_IP>:81/status` (JSON telemetry)

The camera also automatically publishes its IP address to MQTT topic:
`aquanova/camera/status`

---

## 🐟 Part 2: AquaNova Main ESP32 (Sensors & Feeder)

### Hardware Pinout
| Component | ESP32 Pin | Details |
|---|---|---|
| **DS18B20 Temperature** | GPIO 4 | 4.7kΩ pullup to 3.3V |
| **Analog pH Probe** | GPIO 34 (ADC1) | Analog voltage 0-3.3V |
| **Turbidity Sensor** | GPIO 35 (ADC1) | Analog voltage 0-3.3V |
| **Water Level Sensor** | GPIO 32 (ADC1) | Analog or ultrasonic |
| **Feeder Servo (SG90/MG995)** | GPIO 13 | Signal wire (Orange/Yellow). Red to 5V VIN! |
| **Status LED** | GPIO 2 | Built-in Blue LED |

### Libraries Required (Install via Arduino Library Manager)
1. `PubSubClient` by Nick O'Leary
2. `ArduinoJson` by Benoît Blanchon (v6 or v7)
3. `ESP32Servo` by Kevin Harrington

---

## 🌐 Network Configuration
Ensure both ESP32 boards share the same Wi-Fi network as your PC:
- **Wi-Fi / Hotspot SSID:** `YOUR_WIFI_SSID`
- **Wi-Fi / Hotspot Password:** `YOUR_WIFI_PASSWORD`
- **PC Mosquitto MQTT Broker IP:** `YOUR_LOCAL_PC_IP` (Port `1884`)
