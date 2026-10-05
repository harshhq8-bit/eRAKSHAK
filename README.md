# eRAKSHAK: IoT Smart Security System + Web Dashboard + Android Mobile Face Recognition + Cloud Notifications

**Application Name:** Simple IoT World  
**Department:** Dept of ETC, SBJAIN  
**Authors:** Developed by Justice League  

---

## 1. Project Overview

**eRAKSHAK** is a production-grade full-stack IoT Smart Security System designed to protect restricted facilities, office gates, and residential perimeters. It unites low-cost edge microcontrollers (**NodeMCU ESP8266**), environmental sensing (**PIR motion detection** and **HC-SR04 ultrasonic ranging**), **Android mobile face recognition**, and a high-performance **React + Express + Supabase** cloud platform with multi-channel emergency alert dispatch (**Twilio SMS, Voice Call, and SendGrid Email**).

---

## 2. Key Features

- **Edge Microcontroller Firmware (NodeMCU ESP8266):**
  - Non-blocking asynchronous task execution with hardware watchdog protection.
  - Outbound cloud polling (every 3–5 seconds), telemetry streaming (every 10 seconds), and heartbeat reporting (every 10–15 seconds).
  - Preserved local HTTP server on port 80 for on-site manual diagnostic testing (`/authorized`, `/unauthorized`, `/reset`, `/status`).
  - Resilient offline fallback: never freezes or crashes when internet access is interrupted.

- **Mobile Phone Face Recognition Companion (`/mobile`):**
  - Mobile-first web application turning any Android phone into an AI security camera.
  - Live video stream with camera switcher (front/rear lens).
  - Real-time face detection with dynamic bounding box rendering.
  - Profile matching (e.g. Authorized "Rahul" vs Unauthorized "Unknown Intruder").
  - Instant cryptographic 6-digit pairing with security hubs.

- **Centralized Cloud Backend (Node.js & Express):**
  - RESTful APIs for hardware commands, telemetry storage, mobile heartbeats, and alert workflows.
  - Supabase PostgreSQL database with strict Row Level Security (RLS) on all 11 tables.
  - Anti-spam cooldown engine preventing notification spam.
  - Timezone-locked timestamps in **Asia/Kolkata (IST: UTC +05:30)**.

- **Modern Web Dashboard:**
  - Distinctive **Red Gradient** theme tailored for mission-critical security control rooms.
  - Dark and Light mode toggling with persistent preferences.
  - High-priority pulsing Red Alert Banner for unauthorized intrusions.
  - 16x2 Smart LCD remote controller with live character counter and preview.
  - Remote physical LED on/off switcher.
  - Responsive Recharts analytics for motion events, distance history, and access ratios.
  - Paginated audit table with confirmation-protected record deletion.

---

## 3. System Architecture

```
                 PERSON
                    |
             +------+------+
             |             |
           PIR        Ultrasonic
             |             |
             +------+------+
                    |
                 ESP8266
                    |
              Wi-Fi (Outbound)
                    |
             Render Backend (Express REST)
                    |
              +-----+------+
              |            |
           Supabase      Mobile
          PostgreSQL  Face Recognition
              |            |
              +------+-----+
                     |
             AUTHORIZED / UNAUTHORIZED
                     |
                 ESP8266 (Outbound Polling)
               +-----+------+
               |     |      |
              LCD   LED   Buzzer
                     |
             Render Backend
                     |
           +---------+---------+
           |         |         |
          SMS       EMAIL     CALL
        (Twilio)  (SendGrid)(Twilio Voice)
```

> **IMPORTANT CLOUD ARCHITECTURE RULE:**  
> The deployed Render web application does **NOT** directly connect to the ESP8266's private local IP (`192.168.x.x`). The NodeMCU initiates outbound HTTPS/HTTP calls to the cloud backend.

---

## 4. Hardware Requirements & Specifications

1. **Microcontroller:** NodeMCU ESP8266 CP2102 (WiFi 802.11 b/g/n)
2. **Motion Sensor:** PIR Motion Sensor (HC-SR501)
3. **Distance Sensor:** HC-SR04 Ultrasonic Distance Sensor
4. **Display:** 16x2 Character LCD with PCF8574 I2C Backpack (Address `0x27`)
5. **Security LED:** 5mm Red or Green LED with 220Ω resistor
6. **Alarm Buzzer:** 5V Active Buzzer
7. **Mobile Camera:** Any Android smartphone with modern mobile browser (Chrome/Edge/Firefox)
8. **Wiring/Components:** Solderless breadboard, jumper wires, 1kΩ and 2kΩ resistors (for level shifter)

---

## 5. Hardware Wiring & Pin Mapping

| Peripheral | Component Pin | NodeMCU Pin | ESP8266 GPIO | Notes |
|:---|:---|:---|:---|:---|
| **PIR Motion Sensor** | OUT | **D5** | GPIO 14 | Digital Input |
| | VCC | Vin (5V) | - | Power |
| | GND | GND | - | Ground |
| **HC-SR04 Ultrasonic** | TRIG | **D6** | GPIO 12 | Digital Output |
| | ECHO | **D7** | GPIO 13 | **MUST use Voltage Divider!** |
| | VCC | Vin (5V) | - | Power |
| | GND | GND | - | Ground |
| **Active Buzzer** | (+) Anode | **D0** | GPIO 16 | Digital Output (Loud Alarm) |
| | (-) Cathode | GND | - | Ground |
| **Security LED** | (+) Anode | **D4** | GPIO 2 | 220Ω resistor in series |
| | (-) Cathode | GND | - | Ground |
| **16x2 I2C LCD** | SDA | **D3** | GPIO 0 | I2C Data line |
| | SCL | **D2** | GPIO 4 | I2C Clock line |
| | VCC | Vin (5V) | - | Power |
| | GND | GND | - | Ground |

---

## 6. HC-SR04 Voltage Divider Warning

> ⚠️ **CRITICAL HARDWARE SAFETY NOTICE:**  
> The HC-SR04 sensor operates on 5V and outputs a 5V signal on its `ECHO` pin. NodeMCU ESP8266 GPIO pins operate at **3.3V logic** and are not 5V tolerant. Connecting the ECHO pin directly to D7 can permanently damage the microcontroller.
>
> **Circuit Diagram for Voltage Divider:**
> ```
> HC-SR04 ECHO (5V) ----[ 1 kΩ Resistor ]----+---- ESP8266 Pin D7 (3.3V)
>                                            |
>                                    [ 2 kΩ Resistor ]
>                                            |
>                                           GND
> ```

---

## 7. ESP8266 Firmware Setup

1. Open `esp8266/smart_security.ino` in the Arduino IDE.
2. Under **Tools > Board**, select **NodeMCU 1.0 (ESP-12E Module)**.
3. Install required Arduino libraries from the Library Manager:
   - `ArduinoJson` (v6.x)
   - `LiquidCrystal_I2C` (by Frank de Brabander)
4. Locate the configuration block at the top of the file:
   ```cpp
   // Prototype Wi-Fi credentials
   const char* ssid = "ESP8266";
   const char* password = "12345678";

   // Cloud configuration
   const char* DEVICE_ID = "erakshak-nodemcu-01";
   const char* DEVICE_API_KEY = "erakshak_default_key";
   const char* RENDER_API_URL = "http://YOUR_RENDER_BACKEND_URL";
   ```
5. Connect your NodeMCU via USB and click **Upload**.
6. Open the Serial Monitor at **115200 baud** to view startup output.

---

## 8. Supabase Database & Auth Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** tab in your Supabase dashboard.
3. Open `supabase/migrations/20261005_init_schema.sql` from this repository.
4. Copy and paste the entire script into the SQL Editor and click **Run**.
5. The migration creates all 11 required tables, performance indexes, Row Level Security policies, user creation triggers, and Supabase Realtime publications:
   - `profiles`
   - `devices`
   - `sensor_readings`
   - `access_events`
   - `lcd_commands`
   - `led_commands`
   - `device_commands`
   - `notification_settings`
   - `face_profiles`
   - `mobile_devices`
   - `system_logs`
6. In Supabase **Settings > API**, note your:
   - **Project URL**
   - **anon / public key**
   - **service_role key** (keep secret; backend only!)

---

## 9. Twilio & SendGrid Notification Setup

### Twilio SMS & Voice
1. Register at [twilio.com](https://www.twilio.com).
2. Obtain a Twilio phone number with SMS and Voice capabilities.
3. From the Twilio Console, copy:
   - `Account SID`
   - `Auth Token`
   - `Twilio Phone Number` (e.g. `+1234567890`)

### SendGrid Email
1. Sign up at [sendgrid.com](https://sendgrid.com).
2. Create an API Key with **Full Access** or **Mail Send** permissions.
3. Verify a Single Sender Identity (e.g. `alerts@yourdomain.com`).

---

## 10. Environment Variables Configuration

### Backend (`backend/.env`)
```env
PORT=5000
NODE_ENV=production
FRONTEND_URL=http://localhost:5173
RENDER_API_URL=https://your-backend.onrender.com

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Twilio (SMS & Voice)
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# SendGrid (Email)
SENDGRID_API_KEY=SG.your_sendgrid_api_key
SENDGRID_FROM_EMAIL=alerts@yourdomain.com
```

### Frontend (`frontend/.env`)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=https://your-backend.onrender.com
```

---

## 11. Render Cloud Deployment

The repository includes a ready-to-use `render.yaml` blueprint.

1. Push this repository to GitHub.
2. Log into [render.com](https://render.com) and click **New > Blueprint**.
3. Connect your repository.
4. Render will automatically detect both services:
   - `erakshak-backend`: Node.js Express Web Service
   - `erakshak-frontend`: React Static Site
5. Fill in the prompted secret environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_ACCOUNT_SID`, etc.).
6. Click **Apply**. Once built, copy your live Render backend URL and update your ESP8266 firmware `RENDER_API_URL`.

---

## 12. Mobile Pairing & Face Recognition

1. Open the Web Dashboard and click **Tab 4: Device + Mobile**.
2. Click **GENERATE PAIRING CODE**.
3. Open `http://<domain-or-ip>:5173/mobile` on the Android smartphone.
4. Enter the 6-digit code and approve camera permissions.
5. Point the phone towards the entrance.
6. The phone automatically tracks faces in the viewport, classifies them as **Authorized** or **Unauthorized**, and immediately transmits results to the cloud backend.

---

## 13. End-to-End Operational Workflow

```
[Person Approaches Gate]
       ↓
[PIR detects Motion on D5]
       ↓
[NodeMCU LED (D4) turns ON]
       ↓
[HC-SR04 measures Distance]
       ↓
[LCD displays: "PERSON DETECTED / FACE CHECKING"]
       ↓
[Event uploaded to Cloud Backend]
       ↓
[Android Mobile captures Face]
       ↓
┌──────────────────────┴──────────────────────┐
│                                             │
▼                                             ▼
[AUTHORIZED (Rahul)]               [UNAUTHORIZED (Unknown Intruder)]
- NodeMCU Buzzer remains OFF       - NodeMCU Buzzer (D0) turns ON (Alarm)
- LCD: "ACCESS: / AUTHORIZED"      - LCD: "ACCESS: / UNAUTHORIZED"
- Dashboard displays Green State   - High-Priority Red Alert Banner on Dashboard
- Logged to Supabase DB            - SMS Sent via Twilio
                                   - Email Sent via SendGrid
                                   - Emergency Voice Call Initiated via Twilio
```

---

## 14. Manual Testing Protocol

Automated test runners are strictly disabled. Follow the comprehensive 22-step testing guide in [`docs/MANUAL_TESTING.md`](./docs/MANUAL_TESTING.md) to manually test every hardware pin, network reconnect, sensor trigger, LCD update, and notification channel.

---

## 15. Troubleshooting

- **ESP8266 shows "WIFI FAILED":**
  Verify the Wi-Fi router or mobile hotspot SSID is `ESP8266` and password is `12345678` (2.4 GHz only; ESP8266 does not support 5 GHz Wi-Fi).
- **LCD screen displays black rectangles or nothing:**
  Adjust the small potentiometer on the back of the I2C backpack using a screwdriver until characters are sharp and clear. Verify I2C address is `0x27`.
- **Mobile Camera preview is blank:**
  Ensure browser permissions for Camera are allowed in Android Settings. If testing over a local network, use `localhost` or an HTTPS URL (browsers restrict WebRTC camera APIs on non-secure HTTP origins outside of `localhost`).
- **Twilio SMS/Call not received:**
  Check that the recipient phone number is entered in international E.164 format with country code (e.g. `+91` for India, `+1` for USA). Verify that your Twilio account has available balance or trial verification.
