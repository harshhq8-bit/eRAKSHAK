# eRAKSHAK: Comprehensive Manual Testing Guide

**Project:** Simple IoT World - eRAKSHAK Smart Security System  
**System:** NodeMCU ESP8266 + Android Mobile Face Recognition + React Web Dashboard + Express Cloud Backend + Twilio/SendGrid Notifications  
**Testing Policy:** Automated tests are prohibited. All verification must be performed manually following this standardized test protocol.

---

## Pre-requisites & Local Environment Setup

1. **Backend Server:**
   ```bash
   cd backend
   npm run dev
   # Confirmed running on http://localhost:5000 (Health Check: http://localhost:5000/api/health)
   ```

2. **Frontend Web Dashboard:**
   ```bash
   cd frontend
   npm run dev
   # Accessible at http://localhost:5173
   ```

3. **NodeMCU ESP8266 Hardware:**
   - Flash `esp8266/smart_security.ino` using Arduino IDE.
   - Baud Rate: 115200.
   - Wi-Fi Hotspot: SSID `ESP8266`, Password `12345678`.

4. **Android Mobile Companion:**
   - Connect phone to same Wi-Fi/Internet.
   - Open browser to `http://<your-local-ip>:5173/mobile`.

---

## 22 Step-by-Step Manual Test Scenarios

### Test 1: User Registration
- **Procedure:**
  1. Open `http://localhost:5173/register`.
  2. Fill in:
     - Name: `Ashish`
     - Email: `ashish@sbjain.ac.in`
     - Password: `Password@123`
     - Confirm Password: `Password@123`
  3. Click **"Complete Registration"**.
- **Expected Result:**
  - Form validates successfully.
  - User is registered in Supabase Auth & `public.profiles`.
  - Redirects immediately to `/dashboard`.

---

### Test 2: User Login & Session Persistence
- **Procedure:**
  1. Sign out using the logout icon in the header.
  2. Navigate to `http://localhost:5173/login`.
  3. Enter email `ashish@sbjain.ac.in` and password `Password@123`.
  4. Click **"Sign In to Dashboard"**.
  5. Refresh the browser page.
- **Expected Result:**
  - Login succeeds without error.
  - Header displays "Welcome **Ashish**".
  - Refresh preserves authenticated session without logging out.

---

### Test 3: ESP8266 Power-On & Wi-Fi Connection
- **Procedure:**
  1. Power on NodeMCU ESP8266 via USB CP2102.
  2. Observe the 16x2 I2C LCD screen.
- **Expected Result:**
  - **Screen 1:** `SECURITY SYSTEM` / `STARTING...`
  - **Screen 2:** `CONNECTING WIFI` / `PLEASE WAIT`
  - **Screen 3:** `CONNECTED TO` / `WIFI SUCCESS`
  - **Screen 4:** `IP ADDRESS:` / `<ESP_IP_ADDRESS>` (e.g. `192.168.65.77`)
  - **Screen 5:** `SYSTEM READY` / `WAITING...`
  - LCD Backlight remains ON at all times.

---

### Test 4: ESP8266 Cloud Online/Offline Status Tracking
- **Procedure:**
  1. Check the Dashboard Overview header badge for ESP8266.
  2. Power off the ESP8266 or disconnect its Wi-Fi.
  3. Wait 35 seconds (heartbeat expiry threshold).
- **Expected Result:**
  - While connected, badge shows **"ESP8266: ONLINE"** (green pulsing dot).
  - After disconnection, badge automatically switches to **"ESP8266: OFFLINE"** (red dot).

---

### Test 5: PIR Motion Detection & Debouncing
- **Procedure:**
  1. Wave hand in front of the PIR sensor (GPIO D5).
  2. Keep waving hand continuously for 15 seconds.
- **Expected Result:**
  - NodeMCU LED (D4) immediately turns ON.
  - Buzzer remains OFF.
  - LCD displays:
    - Row 1: `PERSON DETECTED`
    - Row 2: `FACE CHECKING`
  - Dashboard Live Security Status switches to yellow **"PERSON DETECTED"**.
  - Internal cooldown (8 seconds) prevents spamming duplicate detection requests.

---

### Test 6: HC-SR04 Ultrasonic Distance Measurement
- **Procedure:**
  1. Place an obstacle at 20 cm, 45 cm, and 70 cm in front of the HC-SR04 sensor.
  2. Observe Dashboard "Ultrasonic" card and Serial Monitor.
- **Expected Result:**
  - Sensor measures distance accurately in centimeters.
  - Dashboard card updates with measured distance (e.g. `45 cm`).
  - Graph records distance telemetry.

---

### Test 7: Mobile Device Pairing Workflow
- **Procedure:**
  1. In Dashboard, go to **Tab 4: Device + Mobile**.
  2. Click **"GENERATE PAIRING CODE"**.
  3. Note the 6-digit code (e.g. `849201`).
  4. On Android phone, open `http://<IP>:5173/mobile`.
  5. Enter the 6-digit code and tap **"Pair Phone"**.
- **Expected Result:**
  - Mobile interface confirms pairing with device name (e.g. `eRAKSHAK Main Gate`).
  - Dashboard updates mobile badge to **"Mobile: ONLINE"** (green).
  - Status shows `PAIRED`.

---

### Test 8: Mobile Camera Permission & Viewport
- **Procedure:**
  1. On mobile companion page, check prompt for camera access.
  2. Tap **"Allow"**.
  3. Tap camera toggle button in the top right.
- **Expected Result:**
  - Live camera stream activates immediately.
  - "Camera Live" overlay badge appears.
  - Camera switches between Front (user) and Rear (environment) lenses smoothly.

---

### Test 9: Face Detection in Video Feed
- **Procedure:**
  1. Point the phone camera towards a person's face.
- **Expected Result:**
  - Live viewport tracks and highlights the face.
  - Visual bounding box renders on the video canvas.
  - Recognition status displays `READY`.

---

### Test 10: Face Recognition Engine (Authorized vs Unknown)
- **Procedure:**
  1. On mobile page, select profile **"Rahul (Authorized)"**.
  2. Tap **"Simulate Authorized"** (or point at enrolled face).
  3. Switch profile to **"Unknown (Intruder)"**.
  4. Tap **"Simulate Unauthorized"**.
- **Expected Result:**
  - For Rahul: Result displays `AUTHORIZED` with confidence ~94%.
  - For Unknown: Result displays `UNAUTHORIZED` with confidence ~42%.
  - Status briefly transitions through `BUSY` then returns to `READY`.

---

### Test 11: Authorized Access Hardware & Dashboard Reaction
- **Procedure:**
  1. Trigger Authorized Access via mobile face recognition (or `GET http://<ESP_IP>/authorized`).
- **Expected Result:**
  - **ESP8266:**
    - LED (D4): **ON**
    - Buzzer (D0): **OFF**
    - LCD Row 1: `ACCESS:`
    - LCD Row 2: `AUTHORIZED`
  - **Dashboard:**
    - Live Security panel turns Green: `ACCESS: AUTHORIZED`.
    - Event table logs row with Person `Rahul`, Result `AUTHORIZED`.

---

### Test 12: Unauthorized Access Alarm & High-Priority Alert Banner
- **Procedure:**
  1. Trigger Unauthorized Access via mobile face recognition (or `GET http://<ESP_IP>/unauthorized`).
- **Expected Result:**
  - **ESP8266:**
    - LED (D4): **ON**
    - Buzzer (D0): **ON (Loud continuous alarm)**
    - LCD Row 1: `ACCESS:`
    - LCD Row 2: `UNAUTHORIZED`
  - **Dashboard:**
    - High-Priority Red Alert Banner appears with pulsing glow: `UNAUTHORIZED ACCESS DETECTED`.
    - Shows Person: `Unknown`, Distance, Date, and Time in `Asia/Kolkata`.
    - Displays notification status badges.

---

### Test 13: Smart LCD Cloud Control (Tab 2)
- **Procedure:**
  1. In Dashboard, go to **Tab 2: Smart LCD**.
  2. Enter:
     - Row 1: `SECURITY LEVEL 1` (16 chars)
     - Row 2: `RESTRICTED ENTRY` (16 chars)
  3. Try typing a 17th character to verify validation.
  4. Click **"SAVE TO LCD"**.
- **Expected Result:**
  - Character counter prevents entering > 16 characters (`16/16`).
  - Command is queued to Render API & Supabase.
  - Within 3–4 seconds, ESP8266 polls and updates physical LCD.
  - Delivery status shows `Synchronized with ESP8266`.

---

### Test 14: LED Hardware Cloud Control (Tab 3)
- **Procedure:**
  1. In Dashboard, go to **Tab 3: LED Control**.
  2. Click **"TURN LED ON"**.
  3. Observe physical LED on ESP8266 (D4).
  4. Click **"TURN LED OFF"**.
- **Expected Result:**
  - On "TURN LED ON": Physical LED illuminates immediately; Dashboard bulb glows amber.
  - On "TURN LED OFF": Physical LED turns off; Dashboard bulb switches to inactive dark state.

---

### Test 15: Twilio SMS Notification Dispatch
- **Procedure:**
  1. In Dashboard, go to **Tab 5: Notifications**.
  2. Ensure SMS is enabled and your mobile number is in E.164 format (e.g. `+919876543210`).
  3. Click **"TEST SMS"**.
- **Expected Result:**
  - Backend issues Twilio API call.
  - SMS received on phone:
    ```
    Simple IoT World Security Alert

    Unauthorized person detected.

    Device: eRAKSHAK Main Gate
    Time: 10:35 AM
    Date: 05-10-2026
    Distance: 45 cm

    Please check your security system.
    ```

---

### Test 16: SendGrid Email Notification Dispatch
- **Procedure:**
  1. In Tab 5, enter recipient email and click **"TEST EMAIL"**.
- **Expected Result:**
  - Backend issues SendGrid API call.
  - Email received with Subject: `Security Alert - Unauthorized Access`.
  - Body contains styled HTML alert with device name, timestamp, and distance.

---

### Test 17: Twilio Voice Call Dispatch
- **Procedure:**
  1. In Tab 5, click **"TEST CALL"**.
- **Expected Result:**
  - Phone receives an incoming call from Twilio.
  - Automated voice speaks:
    *"Security alert. An unauthorized person has been detected by your Simple IoT World security system. Please check immediately."*

---

### Test 18: Anti-Spam Notification Cooldown
- **Procedure:**
  1. In Tab 5, verify Cooldown is set to `60 seconds`.
  2. Trigger two unauthorized access events within 10 seconds.
- **Expected Result:**
  - First event dispatches SMS/Email/Call.
  - Second event logs to dashboard but skips redundant notification dispatches due to active cooldown timer.

---

### Test 19: Theme Toggle (Dark & Light Mode)
- **Procedure:**
  1. In Header, click the Sun/Moon theme toggle button.
  2. Reload page.
- **Expected Result:**
  - Interface switches instantly between sleek dark mode and polished light mode.
  - Preference is retained across reloads via `localStorage`.

---

### Test 20: Event Log Pagination & Deletion
- **Procedure:**
  1. In Tab 1 Event Table, click page buttons `1`, `2`, `Next`.
  2. Click the trash icon on an event.
  3. Confirm deletion in the modal dialog.
- **Expected Result:**
  - Table navigates 10 records per page.
  - Modal confirms deletion before removing row from Supabase.
  - Deletion is audited in `system_logs`.

---

### Test 21: ESP8266 Reconnection & Resiliency
- **Procedure:**
  1. Disconnect Wi-Fi router while ESP8266 is running.
  2. Trigger PIR motion locally.
  3. Reconnect Wi-Fi router.
- **Expected Result:**
  - ESP8266 does not freeze or crash.
  - Local buzzer, LCD, and sensors continue operating.
  - ESP8266 automatically rejoins Wi-Fi and resumes cloud polling.

---

### Test 22: Mobile Reconnection & Companion Resiliency
- **Procedure:**
  1. Toggle Airplane Mode ON on the Android phone for 10 seconds.
  2. Turn Airplane Mode OFF.
- **Expected Result:**
  - Video stream recovers automatically.
  - Heartbeat resumes sending and restores online status on Dashboard.
