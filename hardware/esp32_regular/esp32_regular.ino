/*
 * Dispensador Inteligente de Medicamentos
 * ESP32 Regular (sin cámara) - Módulo de Comunicación
 *
 * Funciones:
 * - Conectividad WiFi
 * - Consulta de sesiones pendientes al API
 * - Comunicación Serial con Arduino Mega
 * 
 * NUEVA ARQUITECTURA:
 * El usuario captura la imagen desde su smartphone y el API crea una sesión.
 * Este ESP32 solo consulta periódicamente si hay sesiones pendientes.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============================================
// CONFIGURACIÓN DE WIFI
// ============================================

const char* ssid = "TU_WIFI_SSID";          // Cambiar por tu red WiFi
const char* password = "4D9697516085";  // Cambiar por tu contraseña

// ============================================
// CONFIGURACIÓN DE API
// ============================================

const char* apiBaseUrl = "http://192.168.1.8:3000/api"; // Cambiar por IP de tu servidor
const char* dispenserId = "dispenser-01";

// ============================================
// CONFIGURACIÓN DE PINES
// ============================================

#define LED_STATUS 2      // LED integrado del ESP32 para indicar estado WiFi
#define SERIAL_BAUD 115200

// ============================================
// VARIABLES GLOBALES
// ============================================

bool wifiConnected = false;
bool checkingSession = false;
unsigned long lastCheckTime = 0;
const unsigned long CHECK_INTERVAL = 2000; // Consultar cada 2 segundos
const unsigned long CHECK_TIMEOUT = 90000; // Timeout de 90 segundos

String currentSessionId = "";

// ============================================
// SETUP
// ============================================

void setup() {
  // Inicializar Serial para comunicación con Arduino
  Serial.begin(SERIAL_BAUD);
  
  // Pequeña pausa para estabilizar
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
  Serial.println("STATUS:Connecting WiFi");
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    digitalWrite(LED_STATUS, !digitalRead(LED_STATUS)); // Parpadear LED
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
      
      // Intentar reconectar
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
    // Arduino solicita verificar si hay sesión pendiente
    startSessionCheck();
  }
  else if (command == "STOP_CHECK") {
    // Arduino solicita detener la verificación
    stopSessionCheck();
  }
  else if (command.startsWith("CONFIRM:")) {
    // Arduino confirma que dispensó exitosamente
    // Formato: CONFIRM:sessionId
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
  lastCheckTime = 0; // Forzar verificación inmediata
  Serial.println("STATUS:Checking for pending session");
}

// ============================================
// DETENER VERIFICACIÓN DE SESIÓN
// ============================================

void stopSessionCheck() {
  checkingSession = false;
  currentSessionId = "";
  Serial.println("STATUS:Check stopped");
}

// ============================================
// CONSULTAR SESIÓN PENDIENTE
// ============================================

void checkPendingSession() {
  HTTPClient http;
  
  // Construir URL
  String url = String(apiBaseUrl) + "/check-pending/" + String(dispenserId);
  
  http.begin(url);
  http.setTimeout(10000); // 10 segundos timeout

  int httpCode = http.GET();

  if (httpCode > 0) {
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      parseSessionResponse(payload);
    } else {
      Serial.print("API_ERROR:HTTP ");
      Serial.println(httpCode);
    }
  } else {
    Serial.print("ERROR:HTTP request failed: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

// ============================================
// PARSEAR RESPUESTA DE SESIÓN
// ============================================

void parseSessionResponse(String payload) {
  // Parsear JSON
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, payload);

  if (error) {
    Serial.print("ERROR:JSON parse failed: ");
    Serial.println(error.c_str());
    return;
  }

  bool hasPending = doc["hasPending"] | false;

  if (hasPending) {
    // Hay una sesión pendiente - extraer información
    String sessionId = doc["sessionId"] | "";
    String patient = doc["patient"] | "";
    String medicine = doc["medicine"] | "";
    String dosage = doc["dosage"] | "";
    int timeRemaining = doc["timeRemaining"] | 0;

    // Guardar session ID actual
    currentSessionId = sessionId;

    // Detener verificación
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

  } else {
    // No hay sesión pendiente - el Arduino seguirá esperando
    // No enviar nada para evitar spam
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
  
  // Construir URL
  String url = String(apiBaseUrl) + "/confirm-dispense/" + sessionId;
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  // Crear JSON body
  StaticJsonDocument<128> doc;
  doc["dispenserId"] = dispenserId;
  doc["timestamp"] = ""; // El servidor usará su timestamp

  String jsonBody;
  serializeJson(doc, jsonBody);

  int httpCode = http.POST(jsonBody);

  if (httpCode > 0) {
    if (httpCode == HTTP_CODE_OK) {
      Serial.println("CONFIRM_OK");
    } else {
      Serial.print("CONFIRM_ERROR:HTTP ");
      Serial.println(httpCode);
    }
  } else {
    Serial.print("ERROR:Confirm request failed: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();

  // Limpiar session ID
  currentSessionId = "";
}

// ============================================
// NOTAS DE IMPLEMENTACIÓN
// ============================================

/*
 * PROTOCOLO DE COMUNICACIÓN CON ARDUINO:
 *
 * Arduino → ESP32:
 *   - "CHECK_PENDING"           : Iniciar consulta de sesiones pendientes
 *   - "STOP_CHECK"              : Detener consulta
 *   - "CONFIRM:sessionId"       : Confirmar dispensación exitosa
 *
 * ESP32 → Arduino:
 *   - "ESP32_READY"                              : ESP32 iniciado
 *   - "WIFI_CONNECTED"                           : Conectado a WiFi
 *   - "WIFI_DISCONNECTED"                        : Desconectado de WiFi
 *   - "IP:192.168.1.x"                           : Dirección IP obtenida
 *   - "STATUS:mensaje"                           : Mensajes de estado
 *   - "AUTHORIZED:sessionId:Patient:Med:Dose"   : Sesión autorizada encontrada
 *   - "CONFIRM_OK"                               : Confirmación enviada al API
 *   - "ERROR:mensaje"                            : Error
 *
 * FLUJO DE OPERACIÓN:
 * 
 * 1. Usuario captura imagen desde smartphone
 * 2. API valida y crea sesión de 90 segundos
 * 3. Usuario presiona botón en dispensador físico
 * 4. Arduino envía "CHECK_PENDING" al ESP32
 * 5. ESP32 consulta al API cada 2 segundos
 * 6. Si hay sesión pendiente, ESP32 envía "AUTHORIZED:..." al Arduino
 * 7. Arduino dispensa medicamento
 * 8. Arduino envía "CONFIRM:sessionId" al ESP32
 * 9. ESP32 confirma con el API
 * 10. Fin del ciclo
 *
 * MEJORAS FUTURAS:
 * 
 * - Implementar HTTPS para comunicación segura
 * - Añadir reconexión automática WiFi más robusta
 * - Implementar OTA (Over-The-Air) updates
 * - Añadir modo de configuración WiFi por Bluetooth
 * - Cachear última sesión autorizada localmente
 * - Añadir watchdog timer para reseteo automático
 * - Implementar logs locales en SPIFFS
 * 
 * CONFIGURACIÓN PARA PRODUCCIÓN:
 * 
 * - Cambiar ssid y password por tus credenciales WiFi
 * - Cambiar apiBaseUrl por la IP/dominio de tu servidor
 * - Ajustar dispenserId si tienes múltiples dispensadores
 * - Si usas HTTPS, incluir certificado SSL
 * - Considerar usar WiFiClientSecure para HTTPS
 *
 * CONEXIÓN CON ARDUINO MEGA:
 * 
 * - ESP32 TX (GPIO1) → Arduino RX3 (pin 15)
 * - ESP32 RX (GPIO3) → Arduino TX3 (pin 14)
 * - ESP32 GND → Arduino GND
 * - ESP32 5V → Arduino 5V (o fuente externa)
 * 
 * TROUBLESHOOTING:
 * 
 * - Si WiFi no conecta, verificar SSID y password
 * - Si API no responde, verificar URL y conectividad de red
 * - Para ver logs, abrir Serial Monitor a 115200 baud
 * - El LED integrado (GPIO2) indica estado WiFi
 * - Verificar que el servidor API esté corriendo
 */

