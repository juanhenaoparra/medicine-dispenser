/*
 * Dispensador Medispen - ESP32 Todo-en-Uno
 * 
 * Este código hace TODO:
 * - WiFi + HTTP calls al API
 * - Control de servo motor
 * - Control de buzzer
 * - LEDs indicadores
 * - Botones

 */



#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>  // Use ESP32-specific servo library

// ============================================
// CONFIGURACIÓN DE WIFI
// ============================================

const char* ssid = "TU_WIFI_SSID";       // ← CAMBIAR: Tu WiFi
const char* password = "TU_WIFI_PASS";   // ← CAMBIAR: Tu contraseña

// ============================================
// CONFIGURACIÓN DE API
// ============================================

// ← CAMBIAR: IP de tu computadora donde corre el API
const char* apiBaseUrl = "http://192.168.1.X:3000/api";
const char* dispenserId = "dispenser-01";

// ============================================
// CONFIGURACIÓN DE PINES
// ============================================

// Servo Motor
#define SERVO_PIN 18          // GPIO18 (puedes cambiar)
#define SERVO_CLOSED 0
#define SERVO_OPEN 90

// Buzzer
#define BUZZER_PIN 19         // GPIO19 (puedes cambiar)

// LEDs
#define LED_GREEN 2           // GPIO2 (LED integrado del ESP32)
#define LED_YELLOW 4          // GPIO4
#define LED_RED 5             // GPIO5

// Botones
#define BTN_DISPENSE 0        // GPIO0 (botón BOOT del ESP32, o usa otro pin)
#define BTN_CANCEL 15         // GPIO15

// ============================================
// OBJETOS GLOBALES
// ============================================

Servo servoMotor;

// ============================================
// VARIABLES GLOBALES
// ============================================

bool wifiConnected = false;
bool checkingSession = false;
unsigned long lastCheckTime = 0;
const unsigned long CHECK_INTERVAL = 2000;  // Consultar cada 2 segundos
const unsigned long CHECK_TIMEOUT = 90000;   // Timeout 90 segundos

String currentSessionId = "";
String currentPatient = "";
String currentMedicine = "";
String currentDosage = "";

// Estados
enum State {
  IDLE,
  CHECKING,
  DISPENSING,
  SUCCESS,
  ERROR_STATE
};

State currentState = IDLE;

// ============================================
// SETUP
// ============================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=== Dispensador Medispen - ESP32 ===");
  
  // Configurar pines
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BTN_DISPENSE, INPUT_PULLUP);  // Pull-up interno
  pinMode(BTN_CANCEL, INPUT_PULLUP);
  
  // Inicializar servo
  servoMotor.attach(SERVO_PIN);
  servoMotor.write(SERVO_CLOSED);
  
  // LEDs apagados
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, LOW);
  
  // Conectar WiFi
  connectWiFi();
  
  // Tono de inicio
  playStartupTone();
  
  Serial.println("Sistema listo. Presiona botón para dispensar.");
  currentState = IDLE;
}

// ============================================
// LOOP PRINCIPAL
// ============================================

void loop() {
  // Verificar WiFi
  checkWiFiConnection();
  
  // Leer botones (invertidos por INPUT_PULLUP)
  bool btnDispense = !digitalRead(BTN_DISPENSE);
  bool btnCancel = !digitalRead(BTN_CANCEL);
  
  // Máquina de estados
  switch (currentState) {
    case IDLE:
      if (btnDispense && wifiConnected) {
        startSessionCheck();
      }
      break;
      
    case CHECKING:
      if (btnCancel) {
        stopSessionCheck();
        currentState = IDLE;
      } else if (millis() - lastCheckTime > CHECK_TIMEOUT) {
        stopSessionCheck();
        showError("Timeout - Sin sesion");
        currentState = ERROR_STATE;
      } else if (millis() - lastCheckTime >= CHECK_INTERVAL) {
        checkPendingSession();
        lastCheckTime = millis();
      }
      break;
      
    case DISPENSING:
      // Esperar a que termine (se maneja en dispense())
      break;
      
    case SUCCESS:
      // Mostrar éxito 3 segundos
      if (millis() - lastCheckTime > 3000) {
        currentState = IDLE;
        clearLEDs();
      }
      break;
      
    case ERROR_STATE:
      // Mostrar error 5 segundos
      if (millis() - lastCheckTime > 5000) {
        currentState = IDLE;
        clearLEDs();
      }
      break;
  }
  
  // Actualizar LEDs según estado
  updateLEDs();
  
  delay(50);
}

// ============================================
// WIFI
// ============================================

void connectWiFi() {
  Serial.print("Conectando a WiFi: ");
  Serial.println(ssid);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_YELLOW, !digitalRead(LED_YELLOW)); // Parpadear
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    digitalWrite(LED_YELLOW, LOW);
    Serial.println("\nWiFi conectado!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    blinkLED(LED_GREEN, 3, 200);
  } else {
    wifiConnected = false;
    Serial.println("\nERROR: No se pudo conectar a WiFi");
    blinkLED(LED_RED, 5, 100);
  }
}

void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      wifiConnected = false;
      Serial.println("WiFi desconectado");
      if (currentState == CHECKING) {
        stopSessionCheck();
        showError("Sin conexion WiFi");
        currentState = ERROR_STATE;
      }
    }
  } else {
    if (!wifiConnected) {
      wifiConnected = true;
      Serial.println("WiFi reconectado");
    }
  }
}

// ============================================
// SESIONES
// ============================================

void startSessionCheck() {
  if (!wifiConnected) {
    showError("Sin WiFi");
    currentState = ERROR_STATE;
    return;
  }
  
  checkingSession = true;
  lastCheckTime = 0; // Forzar verificación inmediata
  currentState = CHECKING;
  Serial.println("Iniciando verificación de sesión...");
}

void stopSessionCheck() {
  checkingSession = false;
  currentSessionId = "";
  Serial.println("Verificación detenida");
}

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
    } else {
      Serial.print("Error HTTP: ");
      Serial.println(httpCode);
    }
  } else {
    Serial.print("Error de conexión: ");
    Serial.println(http.errorToString(httpCode));
  }
  
  http.end();
}

void parseSessionResponse(String payload) {
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, payload);
  
  if (error) {
    Serial.print("Error parseando JSON: ");
    Serial.println(error.c_str());
    return;
  }
  
  bool hasPending = doc["hasPending"] | false;
  
  if (hasPending) {
    currentSessionId = doc["sessionId"] | "";
    currentPatient = doc["patient"] | "";
    currentMedicine = doc["medicine"] | "";
    currentDosage = doc["dosage"] | "";
    
    Serial.println("\n=== SESIÓN ENCONTRADA ===");
    Serial.print("Session ID: ");
    Serial.println(currentSessionId);
    Serial.print("Paciente: ");
    Serial.println(currentPatient);
    Serial.print("Medicamento: ");
    Serial.println(currentMedicine);
    Serial.println("========================\n");
    
    stopSessionCheck();
    dispense();
  }
}

// ============================================
// DISPENSACIÓN
// ============================================

void dispense() {
  currentState = DISPENSING;
  lastCheckTime = millis();
  
  Serial.println("Dispensando medicamento...");
  
  // LED verde + buzzer
  digitalWrite(LED_GREEN, HIGH);
  playSuccessTone();
  
  // Abrir servo
  Serial.println("Abriendo servo...");
  servoMotor.write(SERVO_OPEN);
  delay(2000);
  
  // Cerrar servo
  Serial.println("Cerrando servo...");
  servoMotor.write(SERVO_CLOSED);
  delay(500);
  
  // Confirmar con API
  if (currentSessionId.length() > 0) {
    confirmDispense(currentSessionId);
  }
  
  // Éxito
  currentState = SUCCESS;
  lastCheckTime = millis();
  Serial.println("Dispensación exitosa!");
  
  // Limpiar variables
  currentSessionId = "";
  currentPatient = "";
  currentMedicine = "";
  currentDosage = "";
}

void confirmDispense(String sessionId) {
  if (!wifiConnected) {
    Serial.println("ERROR: Sin WiFi para confirmar");
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
      Serial.println("Dispensación confirmada en servidor");
    } else {
      Serial.print("Error confirmando: HTTP ");
      Serial.println(httpCode);
    }
  } else {
    Serial.print("Error de conexión: ");
    Serial.println(http.errorToString(httpCode));
  }
  
  http.end();
}

// ============================================
// LEDS
// ============================================

void clearLEDs() {
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, LOW);
}

void updateLEDs() {
  switch (currentState) {
    case IDLE:
      clearLEDs();
      break;
      
    case CHECKING:
      // Parpadear amarillo
      static unsigned long lastBlink = 0;
      if (millis() - lastBlink >= 500) {
        digitalWrite(LED_YELLOW, !digitalRead(LED_YELLOW));
        lastBlink = millis();
      }
      break;
      
    case DISPENSING:
      digitalWrite(LED_GREEN, HIGH);
      break;
      
    case SUCCESS:
      // Parpadear verde rápido
      static unsigned long lastSuccessBlink = 0;
      if (millis() - lastSuccessBlink >= 200) {
        digitalWrite(LED_GREEN, !digitalRead(LED_GREEN));
        lastSuccessBlink = millis();
      }
      break;
      
    case ERROR_STATE:
      // Parpadear rojo rápido
      static unsigned long lastErrorBlink = 0;
      if (millis() - lastErrorBlink >= 100) {
        digitalWrite(LED_RED, !digitalRead(LED_RED));
        lastErrorBlink = millis();
      }
      break;
  }
}

void blinkLED(int pin, int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(pin, HIGH);
    delay(delayMs);
    digitalWrite(pin, LOW);
    delay(delayMs);
  }
}

// ============================================
// BUZZER
// ============================================

void playStartupTone() {
  tone(BUZZER_PIN, 1000, 100);
  delay(150);
  tone(BUZZER_PIN, 1500, 100);
  delay(150);
  tone(BUZZER_PIN, 2000, 100);
}

void playSuccessTone() {
  tone(BUZZER_PIN, 2000, 200);
  delay(250);
  tone(BUZZER_PIN, 2500, 200);
}

void showError(String message) {
  Serial.print("ERROR: ");
  Serial.println(message);
  
  // Parpadear rojo
  for (int i = 0; i < 5; i++) {
    digitalWrite(LED_RED, HIGH);
    tone(BUZZER_PIN, 400, 200);
    delay(250);
    digitalWrite(LED_RED, LOW);
    delay(250);
  }
  
  currentState = ERROR_STATE;
  lastCheckTime = millis();
}

