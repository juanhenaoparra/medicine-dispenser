/*
 * ESP32 Bridge - Versión Simplificada para Arduino 328P
 *
 * Funciones:
 * - Conectividad WiFi
 * - Consulta de sesiones pendientes al API
 * - Comunicación Serial con Arduino Uno/Nano (328P)
 *
 * DIFERENCIAS CON VERSIÓN MEGA:
 * - USA SERIAL HARDWARE (TX/RX en GPIO1/GPIO3)
 * - Compatible con Arduino Uno/Nano
 *
 * Conexiones:
 * ESP32 ↔ Arduino 328P:
 *   - ESP32 TX (GPIO1) → Arduino RX (Pin 0)
 *   - ESP32 RX (GPIO3) → Arduino TX (Pin 1)
 *   - ESP32 GND → Arduino GND
 *   - ESP32 VIN → Arduino 5V
 *
 * IMPORTANTE:
 * - Desconectar el cable USB del Arduino al conectar ESP32
 * - O desconectar los cables TX/RX al subir código
 * - Los pines 0 y 1 se usan para Serial, no para ESP32
 */

/*

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============================================
// CONFIGURACIÓN - CAMBIAR ESTOS VALORES
// ============================================

const char* ssid = "TU_WIFI_SSID";       // ← CAMBIAR: Nombre de tu red WiFi
const char* password = "TU_WIFI_PASS";   // ← CAMBIAR: Contraseña de tu WiFi

// ← CAMBIAR: IP de tu computadora donde corre el API
// Para encontrarla:
//   - Mac: ifconfig | grep "inet " | grep -v 127.0.0.1
//   - Windows: ipconfig (busca IPv4)
//   - Linux: ip addr | grep inet
const char* apiBaseUrl = "http://192.168.1.X:3000/api";
const char* dispenserId = "dispenser-01";

// ============================================
// CONFIGURACIÓN DE HARDWARE
// ============================================

#define LED_STATUS 2      // LED integrado del ESP32
#define SERIAL_BAUD 115200

// ============================================
// VARIABLES GLOBALES
// ============================================

bool wifiConnected = false;
bool checkingSession = false;
unsigned long lastCheckTime = 0;
const unsigned long CHECK_INTERVAL = 2000; // Consultar cada 2 segundos

String currentSessionId = "";

// ============================================
// SETUP
// ============================================

void setup() {
  // Inicializar Serial para comunicación con Arduino
  Serial.begin(SERIAL_BAUD);

  // Esperar a que Serial esté listo
  delay(100);

  Serial.println("ESP32_READY");

  // Configurar LED de estado
  pinMode(LED_STATUS, OUTPUT);
  digitalWrite(LED_STATUS, LOW);

  // Conectar a WiFi
  connectWiFi();
}

// ============================================
// LOOP PRINCIPAL
// ============================================

void loop() {
  // Verificar conexión WiFi
  checkWiFiConnection();

  // Leer comandos del Arduino
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    handleCommand(command);
  }

  // Si está en modo de verificación, consultar periódicamente
  if (checkingSession && wifiConnected) {
    if (millis() - lastCheckTime >= CHECK_INTERVAL) {
      checkPendingSession();
      lastCheckTime = millis();
    }
  }

  delay(50);
}

// ============================================
// CONEXIÓN WIFI
// ============================================

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    digitalWrite(LED_STATUS, !digitalRead(LED_STATUS));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    digitalWrite(LED_STATUS, HIGH);
    Serial.println("WIFI_CONNECTED");
    Serial.print("IP:");
    Serial.println(WiFi.localIP());
  } else {
    wifiConnected = false;
    digitalWrite(LED_STATUS, LOW);
    Serial.println("ERROR:WiFi connection failed");
  }
}

// ============================================
// VERIFICAR CONEXIÓN WIFI
// ============================================

void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      wifiConnected = false;
      digitalWrite(LED_STATUS, LOW);
      Serial.println("WIFI_DISCONNECTED");
      delay(1000);
      connectWiFi();
    }
  } else {
    if (!wifiConnected) {
      wifiConnected = true;
      digitalWrite(LED_STATUS, HIGH);
      Serial.println("WIFI_CONNECTED");
    }
  }
}

// ============================================
// MANEJO DE COMANDOS
// ============================================

void handleCommand(String command) {
  if (command == "CHECK_PENDING") {
    startSessionCheck();
  }
  else if (command == "STOP_CHECK") {
    stopSessionCheck();
  }
  else if (command.startsWith("CONFIRM:")) {
    String sessionId = command.substring(8);
    confirmDispense(sessionId);
  }
}

// ============================================
// INICIAR VERIFICACIÓN DE SESIÓN
// ============================================

void startSessionCheck() {
  if (!wifiConnected) {
    Serial.println("ERROR:No WiFi connection");
    return;
  }

  checkingSession = true;
  lastCheckTime = 0;
}

// ============================================
// DETENER VERIFICACIÓN DE SESIÓN
// ============================================

void stopSessionCheck() {
  checkingSession = false;
  currentSessionId = "";
}

// ============================================
// CONSULTAR SESIÓN PENDIENTE
// ============================================

void checkPendingSession() {
  HTTPClient http;

  String url = String(apiBaseUrl) + "/check-pending/" + String(dispenserId);

  http.begin(url);
  http.setTimeout(10000);

  int httpCode = http.GET();

  if (httpCode > 0) {
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      parseSessionResponse(payload);
    }
  }

  http.end();
}

// ============================================
// PARSEAR RESPUESTA DE SESIÓN
// ============================================

void parseSessionResponse(String payload) {
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, payload);

  if (error) {
    Serial.print("ERROR:JSON parse failed: ");
    Serial.println(error.c_str());
    return;
  }

  bool hasPending = doc["hasPending"] | false;

  if (hasPending) {
    String sessionId = doc["sessionId"] | "";
    String patient = doc["patient"] | "";
    String medicine = doc["medicine"] | "";
    String dosage = doc["dosage"] | "";

    currentSessionId = sessionId;
    checkingSession = false;

    // Enviar al Arduino
    Serial.print("AUTHORIZED:");
    Serial.print(sessionId);
    Serial.print(":");
    Serial.print(patient);
    Serial.print(":");
    Serial.print(medicine);
    Serial.print(":");
    Serial.println(dosage);
  }
}

// ============================================
// CONFIRMAR DISPENSACIÓN
// ============================================

void confirmDispense(String sessionId) {
  if (!wifiConnected) {
    Serial.println("ERROR:No WiFi for confirm");
    return;
  }

  HTTPClient http;

  String url = String(apiBaseUrl) + "/confirm-dispense/" + sessionId;

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  StaticJsonDocument<128> doc;
  doc["dispenserId"] = dispenserId;

  String jsonBody;
  serializeJson(doc, jsonBody);

  int httpCode = http.POST(jsonBody);

  if (httpCode > 0) {
    if (httpCode == HTTP_CODE_OK || httpCode == 200) {
      Serial.println("CONFIRM_OK");
    } else {
      Serial.print("CONFIRM_ERROR:HTTP ");
      Serial.println(httpCode);
    }
  }

  http.end();
  currentSessionId = "";
}

*/