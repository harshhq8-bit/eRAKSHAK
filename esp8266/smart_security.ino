#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <Wire.h>
#include <ArduinoJson.h>

// =====================================================
// WIFI CONFIGURATION (User Hotspot Credentials)
// =====================================================

const char* ssid = "Vansh iphone";
const char* password = "1234567809";

// =====================================================
// CLOUD / SUPABASE CONFIGURATION
// =====================================================

// Device credentials registered in Supabase
const char* DEVICE_ID = "erakshak-nodemcu-01";
const char* DEVICE_API_KEY = "erakshak_default_key";

// Backend API URL communicating directly with Supabase
// For local testing: use your PC's IP, e.g. "http://192.168.65.77:5000"
// For cloud deployment: use Render URL, e.g. "https://your-erakshak-api.onrender.com"
const char* BACKEND_API_URL = "http://192.168.65.77:5000";

// =====================================================
// PINS (DO NOT CHANGE)
// =====================================================

#define PIR_PIN     D5
#define TRIG_PIN    D6
#define ECHO_PIN    D7   // NOTE: Use Voltage Divider (5V to 3.3V)
#define BUZZER_PIN  D0
#define LED_PIN     D4

// =====================================================
// LCD I2C
// SDA = D3
// SCL = D2
// Address = 0x27
// =====================================================

#define LCD_ADDR       0x27
#define LCD_BACKLIGHT  0x08
#define LCD_ENABLE     0x04

// =====================================================
// WEB SERVER (Port 80 for Local Testing)
// =====================================================

ESP8266WebServer server(80);

// =====================================================
// VARIABLES & TIMERS
// =====================================================

bool personDetected = false;
bool authorized = false;
bool faceResultReceived = false;

float distanceCM = -1;

unsigned long lastSensorRead = 0;
unsigned long lastLCDUpdate = 0;
unsigned long lastWiFiCheck = 0;

// Non-blocking Cloud Timers
unsigned long lastCommandPoll = 0;
unsigned long lastSensorUpload = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastPirEventTime = 0;

const unsigned long SENSOR_INTERVAL = 500;
const unsigned long LCD_INTERVAL = 1000;
const unsigned long WIFI_CHECK_INTERVAL = 10000;

const unsigned long COMMAND_POLL_INTERVAL = 4000;   // Poll commands every 4 seconds
const unsigned long SENSOR_UPLOAD_INTERVAL = 10000; // Upload sensor data every 10 seconds
const unsigned long HEARTBEAT_INTERVAL = 12000;     // Heartbeat to Supabase every 12 seconds
const unsigned long PIR_COOLDOWN_MS = 8000;         // Debounce PIR triggers by 8 seconds

// =====================================================
// LCD LOW-LEVEL FUNCTIONS (Preserved Exact Implementation)
// =====================================================

void lcdPulseEnable(byte data)
{
  Wire.beginTransmission(LCD_ADDR);
  Wire.write(data | LCD_ENABLE);
  Wire.endTransmission();

  delayMicroseconds(1);

  Wire.beginTransmission(LCD_ADDR);
  Wire.write(data & ~LCD_ENABLE);
  Wire.endTransmission();

  delayMicroseconds(50);
}

void lcdWrite4Bits(byte data)
{
  data |= LCD_BACKLIGHT;

  Wire.beginTransmission(LCD_ADDR);
  Wire.write(data);
  Wire.endTransmission();

  lcdPulseEnable(data);
}

void lcdSend(byte value, byte mode)
{
  byte highNibble = value & 0xF0;
  byte lowNibble = (value << 4) & 0xF0;

  lcdWrite4Bits(highNibble | mode);
  lcdWrite4Bits(lowNibble | mode);
}

void lcdCommand(byte command)
{
  lcdSend(command, 0x00);
}

void lcdData(byte data)
{
  lcdSend(data, 0x01);
}

void lcdClear()
{
  lcdCommand(0x01);
  delay(2);
}

void lcdSetCursor(byte col, byte row)
{
  byte address;

  if (row == 0)
    address = 0x00 + col;
  else
    address = 0x40 + col;

  lcdCommand(0x80 | address);
}

void lcdPrint(String text)
{
  for (unsigned int i = 0; i < text.length(); i++)
  {
    lcdData(text[i]);
  }
}

void lcdShow(String line1, String line2)
{
  // Truncate to maximum 16 characters per line
  if (line1.length() > 16) line1 = line1.substring(0, 16);
  if (line2.length() > 16) line2 = line2.substring(0, 16);

  // Pad to 16 characters to clear remaining characters cleanly
  while (line1.length() < 16) line1 += " ";
  while (line2.length() < 16) line2 += " ";

  lcdClear();

  lcdSetCursor(0, 0);
  lcdPrint(line1);

  lcdSetCursor(0, 1);
  lcdPrint(line2);
}

void lcdInit()
{
  Wire.begin(D3, D2);
  Wire.setClock(100000);

  delay(50);

  lcdWrite4Bits(0x30);
  delay(5);

  lcdWrite4Bits(0x30);
  delayMicroseconds(150);

  lcdWrite4Bits(0x30);
  delayMicroseconds(150);

  lcdWrite4Bits(0x20);

  lcdCommand(0x28);   // 4-bit, 2-line
  lcdCommand(0x0C);   // Display ON, cursor OFF
  lcdCommand(0x06);   // Entry mode
  lcdClear();

  // Backlight remains ON
}

// =====================================================
// WIFI CONNECTION
// =====================================================

bool connectWiFi()
{
  Serial.println();
  Serial.println("Connecting to WiFi...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  unsigned long startTime = millis();

  while (WiFi.status() != WL_CONNECTED &&
         millis() - startTime < 20000)
  {
    delay(500);
    Serial.print(".");
    yield();
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println("WiFi CONNECTED");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    return true;
  }

  Serial.println("WiFi connection FAILED");

  return false;
}

// =====================================================
// DISTANCE SENSOR
// =====================================================

float readDistance()
{
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(3);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);

  digitalWrite(TRIG_PIN, LOW);

  unsigned long duration =
    pulseIn(ECHO_PIN, HIGH, 25000);

  if (duration == 0)
  {
    return -1;
  }

  float distance = duration * 0.0343 / 2.0;

  if (distance < 2 || distance > 400)
  {
    return -1;
  }

  return distance;
}

// =====================================================
// CLOUD / SUPABASE OUTBOUND METHODS
// =====================================================

// 1. Heartbeat to Supabase via Backend API (Updates device status & last_seen)
void sendCloudHeartbeat()
{
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  HTTPClient http;

  String url = String(BACKEND_API_URL) + "/api/devices/" + String(DEVICE_ID) + "/heartbeat";
  if (http.begin(client, url))
  {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-id", DEVICE_ID);
    http.addHeader("x-device-key", DEVICE_API_KEY);

    StaticJsonDocument<128> doc;
    doc["localIp"] = WiFi.localIP().toString();
    String reqBody;
    serializeJson(doc, reqBody);

    int httpCode = http.POST(reqBody);
    if (httpCode > 0)
    {
      Serial.printf("[Cloud/Supabase] Heartbeat OK (%d)\n", httpCode);
    }
    http.end();
  }
}

// 2. Upload Sensor Data to Supabase (sensor_readings table)
void sendCloudSensorData(bool pirVal, float dist)
{
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  HTTPClient http;

  String url = String(BACKEND_API_URL) + "/api/devices/" + String(DEVICE_ID) + "/sensor-data";
  if (http.begin(client, url))
  {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-id", DEVICE_ID);
    http.addHeader("x-device-key", DEVICE_API_KEY);

    StaticJsonDocument<128> doc;
    doc["pirDetected"] = pirVal;
    doc["distanceCm"] = (dist > 0) ? dist : 45.0;
    String reqBody;
    serializeJson(doc, reqBody);

    int httpCode = http.POST(reqBody);
    if (httpCode > 0)
    {
      Serial.printf("[Cloud/Supabase] Sensor data uploaded (%d)\n", httpCode);
    }
    http.end();
  }
}

// 3. Notify Cloud of Person Detected (debounced event trigger)
void notifyCloudPersonDetected(float dist)
{
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  HTTPClient http;

  String url = String(BACKEND_API_URL) + "/api/devices/" + String(DEVICE_ID) + "/sensor-data";
  if (http.begin(client, url))
  {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-id", DEVICE_ID);
    http.addHeader("x-device-key", DEVICE_API_KEY);

    StaticJsonDocument<128> doc;
    doc["pirDetected"] = true;
    doc["distanceCm"] = (dist > 0) ? dist : 45.0;
    String reqBody;
    serializeJson(doc, reqBody);

    http.POST(reqBody);
    http.end();
  }
}

// Forward declarations
void authorizedAccess();
void unauthorizedAccess();
void resetSystem();

// 4. Poll Cloud Commands from Supabase (LCD, LED, Authorized, Unauthorized, Reset)
void pollCloudCommands()
{
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  HTTPClient http;

  String url = String(BACKEND_API_URL) + "/api/devices/" + String(DEVICE_ID) + "/commands";
  if (http.begin(client, url))
  {
    http.addHeader("x-device-id", DEVICE_ID);
    http.addHeader("x-device-key", DEVICE_API_KEY);

    int httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK)
    {
      String payload = http.getString();
      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, payload);

      if (!error && doc["hasCommand"] == true)
      {
        Serial.println("[Cloud/Supabase] Received command from Cloud!");

        // 1. Process LCD command from Supabase lcd_commands table
        if (!doc["lcd"].isNull())
        {
          String l1 = doc["lcd"]["line1"].as<String>();
          String l2 = doc["lcd"]["line2"].as<String>();
          lcdShow(l1, l2);
          faceResultReceived = true;
          Serial.println("[Cloud] LCD updated to: " + l1 + " / " + l2);
        }

        // 2. Process LED command from Supabase led_commands table
        if (!doc["led"].isNull())
        {
          String state = doc["led"]["state"].as<String>();
          if (state == "ON")
          {
            digitalWrite(LED_PIN, HIGH);
          }
          else
          {
            digitalWrite(LED_PIN, LOW);
          }
          Serial.println("[Cloud] Physical LED set to: " + state);
        }

        // 3. Process Generic/Security Device Commands (Authorized, Unauthorized, Reset)
        if (!doc["deviceCommand"].isNull())
        {
          String cmdType = doc["deviceCommand"]["type"].as<String>();
          if (cmdType == "AUTHORIZED")
          {
            authorizedAccess();
          }
          else if (cmdType == "UNAUTHORIZED")
          {
            unauthorizedAccess();
          }
          else if (cmdType == "RESET")
          {
            resetSystem();
          }
        }
      }
    }
    http.end();
  }
}

// =====================================================
// AUTHORIZED ACCESS
// =====================================================

void authorizedAccess()
{
  authorized = true;
  faceResultReceived = true;

  digitalWrite(LED_PIN, HIGH);
  digitalWrite(BUZZER_PIN, LOW);

  lcdShow("ACCESS:", "AUTHORIZED");

  Serial.println("================================");
  Serial.println("AUTHORIZED ACCESS");
  Serial.println("================================");
}

// =====================================================
// UNAUTHORIZED ACCESS
// =====================================================

void unauthorizedAccess()
{
  authorized = false;
  faceResultReceived = true;

  digitalWrite(LED_PIN, HIGH);
  digitalWrite(BUZZER_PIN, HIGH);

  lcdShow("ACCESS:", "UNAUTHORIZED");

  Serial.println("================================");
  Serial.println("UNAUTHORIZED ACCESS");
  Serial.println("================================");
}

// =====================================================
// RESET SYSTEM
// =====================================================

void resetSystem()
{
  authorized = false;
  faceResultReceived = false;

  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  lcdShow("SYSTEM READY", "WAITING...");

  Serial.println("System reset");
}

// =====================================================
// WEB: AUTHORIZED
// =====================================================

void handleAuthorized()
{
  authorizedAccess();

  server.send(
    200,
    "text/plain",
    "AUTHORIZED"
  );
}

// =====================================================
// WEB: UNAUTHORIZED
// =====================================================

void handleUnauthorized()
{
  unauthorizedAccess();

  server.send(
    200,
    "text/plain",
    "UNAUTHORIZED"
  );
}

// =====================================================
// WEB: RESET
// =====================================================

void handleReset()
{
  resetSystem();

  server.send(
    200,
    "text/plain",
    "RESET"
  );
}

// =====================================================
// WEB: STATUS
// =====================================================

void handleStatus()
{
  String json = "{";

  json += "\"person\":";
  json += personDetected ? "true" : "false";

  json += ",\"distance\":";
  json += String(distanceCM, 1);

  json += ",\"authorized\":";
  json += authorized ? "true" : "false";

  json += ",\"faceResult\":";
  json += faceResultReceived ? "true" : "false";

  json += "}";

  server.send(
    200,
    "application/json",
    json
  );
}

// =====================================================
// WEB ROOT
// =====================================================

void handleRoot()
{
  String page = "";

  page += "<html>";
  page += "<head>";
  page += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  page += "<title>ESP8266 Security System</title>";
  page += "</head>";

  page += "<body>";
  page += "<h1>ESP8266 Security System</h1>";

  page += "<p><a href='/authorized'>";
  page += "AUTHORIZED";
  page += "</a></p>";

  page += "<p><a href='/unauthorized'>";
  page += "UNAUTHORIZED";
  page += "</a></p>";

  page += "<p><a href='/reset'>";
  page += "RESET";
  page += "</a></p>";

  page += "<p><a href='/status'>";
  page += "STATUS";
  page += "</a></p>";

  page += "</body>";
  page += "</html>";

  server.send(
    200,
    "text/html",
    page
  );
}

// =====================================================
// SETUP
// =====================================================

void setup()
{
  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println("==============================");
  Serial.println("ESP8266 SECURITY SYSTEM");
  Serial.println("==============================");

  // Pin configuration
  pinMode(PIR_PIN, INPUT);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);

  digitalWrite(TRIG_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  // LCD
  lcdInit();

  lcdShow(
    "SECURITY SYSTEM",
    "STARTING..."
  );

  delay(1500);

  // WiFi
  lcdShow(
    "CONNECTING WIFI",
    "PLEASE WAIT"
  );

  bool wifiOK = connectWiFi();

  if (wifiOK)
  {
    server.on("/", handleRoot);
    server.on("/authorized", handleAuthorized);
    server.on("/unauthorized", handleUnauthorized);
    server.on("/reset", handleReset);
    server.on("/status", handleStatus);

    server.begin();

    Serial.println("SERVER STARTED");

    lcdShow(
      "WIFI CONNECTED",
      "SERVER READY"
    );

    delay(1500);

    lcdShow(
      "IP ADDRESS:",
      WiFi.localIP().toString()
    );

    delay(3000);

    // Initial Supabase Heartbeat
    sendCloudHeartbeat();
  }
  else
  {
    lcdShow(
      "WIFI FAILED",
      "CHECK WIFI"
    );

    delay(2000);
  }

  lcdShow(
    "SYSTEM READY",
    "WAITING..."
  );

  Serial.println();
  Serial.println("SYSTEM READY");
}

// =====================================================
// LOOP
// =====================================================

void loop()
{
  unsigned long currentMillis = millis();

  // ---------------------------------------------
  // 1. Handle local web server
  // ---------------------------------------------

  if (WiFi.status() == WL_CONNECTED)
  {
    server.handleClient();
  }

  // ---------------------------------------------
  // 2. Check WiFi periodically
  // ---------------------------------------------

  if (currentMillis - lastWiFiCheck >= WIFI_CHECK_INTERVAL)
  {
    lastWiFiCheck = currentMillis;

    if (WiFi.status() != WL_CONNECTED)
    {
      Serial.println("WiFi disconnected, reconnecting...");

      WiFi.disconnect();
      WiFi.begin(ssid, password);
    }
  }

  // ---------------------------------------------
  // 3. Read sensors (PIR + Ultrasonic)
  // ---------------------------------------------

  if (currentMillis - lastSensorRead >= SENSOR_INTERVAL)
  {
    lastSensorRead = currentMillis;

    personDetected = digitalRead(PIR_PIN);
    distanceCM = readDistance();

    Serial.print("PIR: ");
    Serial.print(personDetected);
    Serial.print(" | Distance: ");

    if (distanceCM < 0)
    {
      Serial.println("Invalid");
    }
    else
    {
      Serial.print(distanceCM);
      Serial.println(" cm");
    }

    // Trigger person detected event with debouncing
    if (personDetected && !faceResultReceived)
    {
      if (currentMillis - lastPirEventTime > PIR_COOLDOWN_MS)
      {
        lastPirEventTime = currentMillis;
        notifyCloudPersonDetected(distanceCM);
      }
    }
  }

  // ---------------------------------------------
  // 4. Cloud / Supabase Polling & Telemetry
  // ---------------------------------------------

  // Poll cloud commands (LCD, LED, Access result) every 4 seconds
  if (currentMillis - lastCommandPoll >= COMMAND_POLL_INTERVAL)
  {
    lastCommandPoll = currentMillis;
    pollCloudCommands();
  }

  // Send sensor telemetry to Supabase every 10 seconds
  if (currentMillis - lastSensorUpload >= SENSOR_UPLOAD_INTERVAL)
  {
    lastSensorUpload = currentMillis;
    sendCloudSensorData(personDetected, distanceCM);
  }

  // Send heartbeat to Supabase every 12 seconds
  if (currentMillis - lastHeartbeat >= HEARTBEAT_INTERVAL)
  {
    lastHeartbeat = currentMillis;
    sendCloudHeartbeat();
  }

  // ---------------------------------------------
  // 5. LCD periodic display update
  // ---------------------------------------------

  if (currentMillis - lastLCDUpdate >= LCD_INTERVAL)
  {
    lastLCDUpdate = currentMillis;

    // Don't overwrite access result
    if (!faceResultReceived)
    {
      if (personDetected)
      {
        lcdShow(
          "PERSON DETECTED",
          "FACE CHECKING"
        );
      }
      else
      {
        lcdShow(
          "SYSTEM READY",
          "NO PERSON"
        );
      }
    }
  }

  // ---------------------------------------------
  // 6. Keep ESP8266 responsive (feed watchdog)
  // ---------------------------------------------

  yield();
}