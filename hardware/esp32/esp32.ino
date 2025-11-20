// /*
//  * Dispensador Medispen - ESP32 con Push Notifications
//  *
//  * Este código implementa:
//  * - WiFi + HTTP Server para recibir notificaciones
//  * - HTTP Client para registrar y confirmar dispensaciones
//  * - Control de servo motor
//  * - Control de buzzer
//  * - LEDs indicadores
//  * - Modo híbrido: Push notification + fallback a polling
//  */

// #include <WiFi.h>
// #include <HTTPClient.h>
// #include <WebServer.h>
// #include <ArduinoJson.h>
// #include <ESP32Servo.h>

// // ============================================
// // CONFIGURACIÓN DE WIFI
// // ============================================

// const char* ssid = "S25 Ultra de Julian";
// const char* password = "21jejAlo.";

// // Configuración de IP estática
// IPAddress staticIP(10, 65, 56, 200);      // IP fija del ESP32 (diferente a la Mac!)
// IPAddress gateway(10, 65, 56, 1);         // Gateway (router)
// IPAddress subnet(255, 255, 255, 0);       // Máscara de subred
// IPAddress dns1(8, 8, 8, 8);               // DNS primario (Google)
// IPAddress dns2(8, 8, 4, 4);               // DNS secundario (Google)

// // ============================================
// // CONFIGURACIÓN DE API
// // ============================================

// const char* apiBaseUrl = "http://10.65.56.119:3000/api";  // IP de tu Mac
// const char* dispenserId = "dispenser-01";

// // ============================================
// // CONFIGURACIÓN DE PINES
// // ============================================

// // Servo Motor
// #define SERVO_PIN 18
// #define SERVO_CLOSED 0
// #define SERVO_OPEN 90

// // Buzzer
// #define BUZZER_PIN 19

// // LEDs
// #define LED_GREEN 2    // LED integrado del ESP32
// #define LED_YELLOW 4
// #define LED_RED 5

// // Botones
// #define BTN_DISPENSE 0   // Botón BOOT del ESP32
// #define BTN_CANCEL 15

// // ============================================
// // OBJETOS GLOBALES
// // ============================================

// Servo servoMotor;
// WebServer server(8080);  // HTTP server en puerto 8080

// // ============================================
// // VARIABLES GLOBALES
// // ============================================

// // WiFi y conectividad
// bool wifiConnected = false;
// bool registeredWithServer = false;
// unsigned long lastHeartbeat = 0;
// const unsigned long HEARTBEAT_INTERVAL = 30000;  // 30 segundos

// // Sesión actual
// String currentSessionId = "";
// String currentPatient = "";
// String currentMedicine = "";
// String currentDosage = "";
// bool sessionReceived = false;

// // Servo control
// bool servoAttached = false;

// // Estados
// enum State {
//   IDLE,
//   WAITING_FOR_BUTTON,   // Push recibida, esperando botón
//   CHECKING,             // Modo fallback: polling
//   DISPENSING,
//   SUCCESS,
//   ERROR_STATE
// };

// State currentState = IDLE;
// unsigned long stateStartTime = 0;

// // Timeout para polling fallback
// const unsigned long POLLING_TIMEOUT = 15000;   // 15 segundos
// const unsigned long CHECK_INTERVAL = 2000;     // 2 segundos
// unsigned long lastCheckTime = 0;

// // ============================================
// // PROTOTIPOS DE FUNCIONES
// // ============================================

// void setupWebServer();
// void handleDispenseRequest();
// void handleHealthCheck();
// void handleNotFound();
// void registerWithServer();
// void sendHeartbeat();

// // ============================================
// // SETUP
// // ============================================

// void setup() {
//   Serial.begin(115200);
//   delay(1000);

//   Serial.println("\n\n=== Dispensador Medispen - ESP32 Push Mode ===");

//   // Configurar pines
//   pinMode(LED_GREEN, OUTPUT);
//   pinMode(LED_YELLOW, OUTPUT);
//   pinMode(LED_RED, OUTPUT);
//   pinMode(BUZZER_PIN, OUTPUT);
//   pinMode(BTN_DISPENSE, INPUT_PULLUP);
//   pinMode(BTN_CANCEL, INPUT_PULLUP);

//   // Configurar PWM timers (importante para evitar conflictos)
//   Serial.println("Configurando PWM para servo y buzzer...");
//   ESP32PWM::allocateTimer(0);  // Timer para servo
//   ESP32PWM::allocateTimer(1);  // Timer adicional
//   ESP32PWM::allocateTimer(2);  // Timer para buzzer

//   // Inicializar servo con configuración adecuada
//   servoMotor.setPeriodHertz(50);  // Frecuencia estándar para servos: 50Hz
//   servoMotor.attach(SERVO_PIN, 500, 2400);  // Pin, min pulse, max pulse
//   delay(100);
//   servoMotor.write(SERVO_CLOSED);
//   delay(500);  // Esperar que el servo alcance la posición
//   servoMotor.detach();  // Desconectar para liberar PWM
//   servoAttached = false;
//   Serial.println("Servo inicializado y desconectado");

//   // LEDs apagados
//   digitalWrite(LED_GREEN, LOW);
//   digitalWrite(LED_YELLOW, LOW);
//   digitalWrite(LED_RED, LOW);

//   // Conectar WiFi
//   connectWiFi();

//   if (wifiConnected) {
//     // Configurar servidor HTTP
//     setupWebServer();
//     server.begin();
//     Serial.print("HTTP Server started on port 8080\n");
//     Serial.print("IP Address: ");
//     Serial.println(WiFi.localIP());

//     // Registrar con el servidor
//     registerWithServer();

//     // Tono de inicio
//     playStartupTone();

//     Serial.println("\n=== Sistema listo ===");
//     Serial.println("Modo PUSH: Esperando notificaciones del servidor");
//     Serial.println("Modo FALLBACK: Presiona BOOT para activar polling");
//   } else {
//     showError("Sin WiFi", "Verifica SSID y password");
//   }

//   currentState = IDLE;
//   stateStartTime = millis();
// }

// // ============================================
// // LOOP PRINCIPAL
// // ============================================

// void loop() {
//   // Manejar requests HTTP entrantes
//   server.handleClient();

//   // Verificar WiFi
//   checkWiFiConnection();

//   // Enviar heartbeat periódico
//   if (wifiConnected && millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
//     sendHeartbeat();
//     lastHeartbeat = millis();
//   }

//   // Leer botones
//   bool btnDispense = !digitalRead(BTN_DISPENSE);
//   bool btnCancel = !digitalRead(BTN_CANCEL);

//   // Máquina de estados
//   switch (currentState) {
//     case IDLE:
//       // Modo IDLE: Esperando push notification o botón manual
//       if (sessionReceived) {
//         // Push notification recibida
//         currentState = WAITING_FOR_BUTTON;
//         stateStartTime = millis();
//         Serial.println("\n→ Sesión recibida! Presiona BOOT para dispensar");
//       } else if (btnDispense && wifiConnected) {
//         // Modo fallback: Usuario presiona botón sin push
//         Serial.println("\n→ Botón presionado (modo fallback)");
//         Serial.println("   Iniciando polling de sesión...");
//         startPolling();
//       }
//       break;

//     case WAITING_FOR_BUTTON:
//       // Esperando que usuario presione botón después de push
//       if (btnDispense) {
//         Serial.println("→ Botón presionado! Dispensando...");
//         dispense();
//       } else if (btnCancel) {
//         Serial.println("→ Cancelado por usuario");
//         clearSession();
//         currentState = IDLE;
//         clearLEDs();
//       } else if (millis() - stateStartTime > 30000) {  // 30 segundos
//         Serial.println("→ Timeout: Usuario no presionó botón");
//         showError("Timeout", "Sesion expirada");
//         clearSession();
//         currentState = ERROR_STATE;
//         stateStartTime = millis();
//       }
//       break;

//     case CHECKING:
//       // Modo fallback: Polling activo
//       if (btnCancel) {
//         stopPolling();
//         currentState = IDLE;
//         clearLEDs();
//       } else if (millis() - stateStartTime > POLLING_TIMEOUT) {
//         stopPolling();
//         showError("Timeout", "No se encontro sesion. Crea sesion en app primero.");
//         currentState = ERROR_STATE;
//         stateStartTime = millis();
//       } else if (millis() - lastCheckTime >= CHECK_INTERVAL) {
//         checkPendingSession();
//         lastCheckTime = millis();
//       }
//       break;

//     case DISPENSING:
//       // Esperando a que termine (manejado en dispense())
//       break;

//     case SUCCESS:
//       // Mostrar éxito 3 segundos
//       if (millis() - stateStartTime > 3000) {
//         currentState = IDLE;
//         clearLEDs();
//       }
//       break;

//     case ERROR_STATE:
//       // Mostrar error 5 segundos
//       if (millis() - stateStartTime > 5000) {
//         currentState = IDLE;
//         clearLEDs();
//       }
//       break;
//   }

//   // Actualizar LEDs según estado
//   updateLEDs();

//   delay(50);
// }

// // ============================================
// // CONFIGURACIÓN DE SERVIDOR WEB
// // ============================================

// void setupWebServer() {
//   // Endpoint para recibir notificaciones de dispensación
//   server.on("/dispense", HTTP_POST, handleDispenseRequest);

//   // Endpoint de health check
//   server.on("/health", HTTP_GET, handleHealthCheck);

//   // 404 handler
//   server.onNotFound(handleNotFound);
// }

// void handleDispenseRequest() {
//   Serial.println("\n=== PUSH NOTIFICATION RECEIVED ===");

//   // Leer body
//   String body = server.arg("plain");
//   Serial.print("Body: ");
//   Serial.println(body);

//   // Parsear JSON
//   StaticJsonDocument<512> doc;
//   DeserializationError error = deserializeJson(doc, body);

//   if (error) {
//     Serial.print("Error parseando JSON: ");
//     Serial.println(error.c_str());
//     server.send(400, "application/json", "{\"success\":false,\"error\":\"Invalid JSON\"}");
//     return;
//   }

//   // Extraer datos
//   currentSessionId = doc["sessionId"] | "";
//   currentPatient = doc["patient"] | "";
//   currentMedicine = doc["medicine"] | "";
//   currentDosage = doc["dosage"] | "";

//   if (currentSessionId.length() == 0) {
//     Serial.println("Error: sessionId vacío");
//     server.send(400, "application/json", "{\"success\":false,\"error\":\"Missing sessionId\"}");
//     return;
//   }

//   Serial.println("Session ID: " + currentSessionId);
//   Serial.println("Patient: " + currentPatient);
//   Serial.println("Medicine: " + currentMedicine);
//   Serial.println("Dosage: " + currentDosage);
//   Serial.println("=================================");

//   // Marcar sesión recibida
//   sessionReceived = true;

//   // Responder OK
//   server.send(200, "application/json", "{\"success\":true,\"message\":\"Session received\"}");

//   // Tono de notificación
//   playToneCustom(1500, 200);
// }

// void handleHealthCheck() {
//   StaticJsonDocument<256> doc;
//   doc["status"] = "ok";
//   doc["dispenserId"] = dispenserId;
//   doc["wifiConnected"] = wifiConnected;
//   doc["registeredWithServer"] = registeredWithServer;
//   doc["currentState"] = currentState;
//   doc["uptime"] = millis() / 1000;
//   doc["freeHeap"] = ESP.getFreeHeap();

//   String response;
//   serializeJson(doc, response);

//   server.send(200, "application/json", response);
// }

// void handleNotFound() {
//   server.send(404, "application/json", "{\"error\":\"Not found\"}");
// }

// // ============================================
// // REGISTRO CON SERVIDOR
// // ============================================

// void registerWithServer() {
//   if (!wifiConnected) {
//     Serial.println("ERROR: Sin WiFi para registrar");
//     return;
//   }

//   HTTPClient http;
//   String url = String(apiBaseUrl) + "/dispensers/register";

//   http.begin(url);
//   http.addHeader("Content-Type", "application/json");
//   http.setTimeout(10000);

//   // Preparar JSON
//   StaticJsonDocument<256> doc;
//   doc["dispenserId"] = dispenserId;
//   doc["ipAddress"] = WiFi.localIP().toString();
//   doc["port"] = 8080;
//   doc["metadata"]["firmware"] = "1.0.0";
//   doc["metadata"]["chipModel"] = "ESP32";

//   String jsonBody;
//   serializeJson(doc, jsonBody);

//   Serial.println("\n→ Registrando con servidor...");
//   Serial.println("   URL: " + url);
//   Serial.println("   IP: " + WiFi.localIP().toString());

//   int httpCode = http.POST(jsonBody);

//   if (httpCode > 0) {
//     if (httpCode == HTTP_CODE_OK || httpCode == 200) {
//       Serial.println("✓ Registro exitoso!");
//       registeredWithServer = true;
//       blinkLED(LED_GREEN, 2, 200);
//     } else {
//       Serial.print("✗ Error HTTP ");
//       Serial.println(httpCode);
//       Serial.println("   Response: " + http.getString());
//       registeredWithServer = false;
//     }
//   } else {
//     Serial.print("✗ Error de conexión: ");
//     Serial.println(http.errorToString(httpCode));
//     registeredWithServer = false;
//   }

//   http.end();
// }

// void sendHeartbeat() {
//   if (!registeredWithServer) {
//     return;  // No enviar heartbeat si no estamos registrados
//   }

//   HTTPClient http;
//   String url = String(apiBaseUrl) + "/dispensers/" + String(dispenserId) + "/heartbeat";

//   http.begin(url);
//   http.addHeader("Content-Type", "application/json");
//   http.setTimeout(5000);

//   int httpCode = http.POST("{}");

//   if (httpCode == HTTP_CODE_OK || httpCode == 200) {
//     Serial.println("♥ Heartbeat OK");
//   } else {
//     Serial.print("♥ Heartbeat failed: ");
//     Serial.println(httpCode);
//   }

//   http.end();
// }

// // ============================================
// // WIFI
// // ============================================

// void connectWiFi() {
//   Serial.print("Conectando a WiFi: ");
//   Serial.println(ssid);

//   WiFi.mode(WIFI_STA);

//   // Configurar IP estática
//   Serial.println("Configurando IP estática...");
//   if (!WiFi.config(staticIP, gateway, subnet, dns1, dns2)) {
//     Serial.println("✗ Error configurando IP estática");
//   } else {
//     Serial.print("  IP configurada: ");
//     Serial.println(staticIP);
//   }

//   WiFi.begin(ssid, password);

//   int attempts = 0;
//   while (WiFi.status() != WL_CONNECTED && attempts < 30) {
//     delay(500);
//     Serial.print(".");
//     digitalWrite(LED_YELLOW, !digitalRead(LED_YELLOW));
//     attempts++;
//   }

//   if (WiFi.status() == WL_CONNECTED) {
//     wifiConnected = true;
//     digitalWrite(LED_YELLOW, LOW);
//     Serial.println("\n✓ WiFi conectado!");
//     Serial.print("  IP: ");
//     Serial.println(WiFi.localIP());
//     Serial.print("  SSID: ");
//     Serial.println(ssid);
//     blinkLED(LED_GREEN, 3, 200);
//   } else {
//     wifiConnected = false;
//     Serial.println("\n✗ ERROR: No se pudo conectar a WiFi");
//     Serial.println("  Verifica:");
//     Serial.print("  - SSID: ");
//     Serial.println(ssid);
//     Serial.println("  - Password configurado correctamente");
//     blinkLED(LED_RED, 5, 100);
//   }
// }

// void checkWiFiConnection() {
//   if (WiFi.status() != WL_CONNECTED) {
//     if (wifiConnected) {
//       wifiConnected = false;
//       registeredWithServer = false;
//       Serial.println("✗ WiFi desconectado");
//       if (currentState == CHECKING || currentState == WAITING_FOR_BUTTON) {
//         showError("Sin WiFi", "Conexion perdida");
//         clearSession();
//         currentState = ERROR_STATE;
//         stateStartTime = millis();
//       }
//     }
//   } else {
//     if (!wifiConnected) {
//       wifiConnected = true;
//       Serial.println("✓ WiFi reconectado");
//       registerWithServer();
//     }
//   }
// }

// // ============================================
// // POLLING (MODO FALLBACK)
// // ============================================

// void startPolling() {
//   if (!wifiConnected) {
//     showError("Sin WiFi", "Conecta a WiFi primero");
//     currentState = ERROR_STATE;
//     stateStartTime = millis();
//     return;
//   }

//   currentState = CHECKING;
//   stateStartTime = millis();
//   lastCheckTime = 0;  // Forzar check inmediato
//   Serial.println("→ Iniciando polling (modo fallback)...");
// }

// void stopPolling() {
//   Serial.println("→ Polling detenido");
//   clearSession();
// }

// void checkPendingSession() {
//   HTTPClient http;
//   String url = String(apiBaseUrl) + "/check-pending/" + String(dispenserId);

//   http.begin(url);
//   http.setTimeout(10000);

//   int httpCode = http.GET();

//   if (httpCode > 0) {
//     if (httpCode == HTTP_CODE_OK) {
//       String payload = http.getString();
//       parseSessionResponse(payload);
//     } else {
//       Serial.print("✗ Error HTTP ");
//       Serial.println(httpCode);
//     }
//   } else {
//     Serial.print("✗ Error de conexión: ");
//     Serial.println(http.errorToString(httpCode));
//     Serial.print("   URL: ");
//     Serial.println(url);
//     Serial.println("   Verifica que el API esté corriendo");
//   }

//   http.end();
// }

// void parseSessionResponse(String payload) {
//   StaticJsonDocument<512> doc;
//   DeserializationError error = deserializeJson(doc, payload);

//   if (error) {
//     Serial.print("✗ Error parseando JSON: ");
//     Serial.println(error.c_str());
//     return;
//   }

//   bool hasPending = doc["hasPending"] | false;

//   if (hasPending) {
//     currentSessionId = doc["sessionId"] | "";
//     currentPatient = doc["patient"] | "";
//     currentMedicine = doc["medicine"] | "";
//     currentDosage = doc["dosage"] | "";

//     Serial.println("\n=== SESIÓN ENCONTRADA (Polling) ===");
//     Serial.println("Session ID: " + currentSessionId);
//     Serial.println("Patient: " + currentPatient);
//     Serial.println("Medicine: " + currentMedicine);
//     Serial.println("===================================");

//     stopPolling();
//     dispense();
//   } else {
//     Serial.print(".");  // Indicador de polling activo
//   }
// }

// // ============================================
// // DISPENSACIÓN
// // ============================================

// // Helper: Mover servo de forma segura
// void moveServoSafe(int angle) {
//   Serial.print("  Servo -> ");
//   Serial.print(angle);
//   Serial.println("°");

//   // Attach si no está conectado
//   if (!servoAttached) {
//     servoMotor.attach(SERVO_PIN, 500, 2400);
//     servoAttached = true;
//     delay(50);  // Estabilizar conexión
//   }

//   servoMotor.write(angle);
//   delay(15);  // Permitir que el servo comience a moverse
// }

// // Helper: Desconectar servo
// void detachServo() {
//   if (servoAttached) {
//     servoMotor.detach();
//     servoAttached = false;
//     Serial.println("  Servo desconectado (PWM liberado)");
//   }
// }

// // Helper: Tono personalizado sin conflictos PWM
// void playToneCustom(int frequency, int duration) {
//   ledcAttach(BUZZER_PIN, frequency, 8);  // Nuevo API: pin, freq, resolution
//   ledcWrite(BUZZER_PIN, 128);  // 50% duty cycle
//   delay(duration);
//   ledcWrite(BUZZER_PIN, 0);
//   ledcDetach(BUZZER_PIN);
// }

// void dispense() {
//   currentState = DISPENSING;
//   stateStartTime = millis();

//   Serial.println("\n→ DISPENSANDO...");

//   // LED verde
//   digitalWrite(LED_GREEN, HIGH);

//   // Reducir WiFi durante operación del servo (opcional pero recomendado)
//   WiFi.setSleep(true);

//   // Abrir servo
//   Serial.println("  Abriendo servo...");
//   moveServoSafe(SERVO_OPEN);
//   delay(2000);  // Mantener abierto 2 segundos

//   // Cerrar servo
//   Serial.println("  Cerrando servo...");
//   moveServoSafe(SERVO_CLOSED);
//   delay(1000);  // Esperar que alcance la posición

//   // Desconectar servo para liberar PWM
//   detachServo();

//   // Reactivar WiFi
//   WiFi.setSleep(false);

//   // Ahora es seguro usar el buzzer (PWM del servo liberado)
//   playSuccessTone();

//   // Confirmar con API
//   if (currentSessionId.length() > 0) {
//     confirmDispense(currentSessionId);
//   }

//   // Éxito
//   currentState = SUCCESS;
//   stateStartTime = millis();
//   Serial.println("✓ Dispensación exitosa!");

//   // Limpiar variables
//   clearSession();
// }

// void confirmDispense(String sessionId) {
//   if (!wifiConnected) {
//     Serial.println("✗ Sin WiFi para confirmar");
//     return;
//   }

//   HTTPClient http;
//   String url = String(apiBaseUrl) + "/confirm-dispense/" + sessionId;

//   http.begin(url);
//   http.addHeader("Content-Type", "application/json");
//   http.setTimeout(10000);

//   StaticJsonDocument<128> doc;
//   doc["dispenserId"] = dispenserId;

//   String jsonBody;
//   serializeJson(doc, jsonBody);

//   int httpCode = http.POST(jsonBody);

//   if (httpCode > 0) {
//     if (httpCode == HTTP_CODE_OK || httpCode == 200) {
//       Serial.println("✓ Dispensación confirmada en servidor");
//     } else {
//       Serial.print("✗ Error confirmando: HTTP ");
//       Serial.println(httpCode);
//     }
//   } else {
//     Serial.print("✗ Error de conexión: ");
//     Serial.println(http.errorToString(httpCode));
//   }

//   http.end();
// }

// void clearSession() {
//   currentSessionId = "";
//   currentPatient = "";
//   currentMedicine = "";
//   currentDosage = "";
//   sessionReceived = false;
// }

// // ============================================
// // LEDS
// // ============================================

// void clearLEDs() {
//   digitalWrite(LED_GREEN, LOW);
//   digitalWrite(LED_YELLOW, LOW);
//   digitalWrite(LED_RED, LOW);
// }

// void updateLEDs() {
//   static unsigned long lastBlink = 0;

//   switch (currentState) {
//     case IDLE:
//       clearLEDs();
//       break;

//     case WAITING_FOR_BUTTON:
//       // Parpadear amarillo (esperando botón)
//       if (millis() - lastBlink >= 500) {
//         digitalWrite(LED_YELLOW, !digitalRead(LED_YELLOW));
//         lastBlink = millis();
//       }
//       break;

//     case CHECKING:
//       // Parpadear amarillo (polling)
//       if (millis() - lastBlink >= 500) {
//         digitalWrite(LED_YELLOW, !digitalRead(LED_YELLOW));
//         lastBlink = millis();
//       }
//       break;

//     case DISPENSING:
//       digitalWrite(LED_GREEN, HIGH);
//       break;

//     case SUCCESS:
//       // Parpadear verde rápido
//       if (millis() - lastBlink >= 200) {
//         digitalWrite(LED_GREEN, !digitalRead(LED_GREEN));
//         lastBlink = millis();
//       }
//       break;

//     case ERROR_STATE:
//       // Parpadear rojo rápido
//       if (millis() - lastBlink >= 100) {
//         digitalWrite(LED_RED, !digitalRead(LED_RED));
//         lastBlink = millis();
//       }
//       break;
//   }
// }

// void blinkLED(int pin, int times, int delayMs) {
//   for (int i = 0; i < times; i++) {
//     digitalWrite(pin, HIGH);
//     delay(delayMs);
//     digitalWrite(pin, LOW);
//     delay(delayMs);
//   }
// }

// // ============================================
// // BUZZER
// // ============================================

// void playStartupTone() {
//   playToneCustom(1000, 100);
//   delay(150);
//   playToneCustom(1500, 100);
//   delay(150);
//   playToneCustom(2000, 100);
// }

// void playSuccessTone() {
//   playToneCustom(2000, 200);
//   delay(250);
//   playToneCustom(2500, 200);
// }

// void showError(String title, String message) {
//   Serial.println("\n╔═══════════════════════════════╗");
//   Serial.print("║ ERROR: ");
//   Serial.println(title);
//   Serial.print("║ ");
//   Serial.println(message);
//   Serial.println("╚═══════════════════════════════╝");

//   // Parpadear rojo + buzzer
//   for (int i = 0; i < 5; i++) {
//     digitalWrite(LED_RED, HIGH);
//     playToneCustom(400, 200);
//     delay(250);
//     digitalWrite(LED_RED, LOW);
//     delay(250);
//   }

//   currentState = ERROR_STATE;
//   stateStartTime = millis();
// }
