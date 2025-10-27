/*
 * Dispensador Inteligente de Medicamentos
 * Arduino Mega 2560 - Controlador Principal
 *
 * Funciones:
 * - Control de interfaz de usuario (LCD, botones, LEDs, buzzer)
 * - Control de servo motor para dispensación
 * - Comunicación con ESP32-CAM vía Serial
 * - Lógica de estados del sistema
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

// ============================================
// CONFIGURACIÓN DE PINES
// ============================================

// LCD I2C
#define LCD_ADDR 0x27
#define LCD_COLS 16
#define LCD_ROWS 2

// Servo Motor
#define SERVO_PIN 9

// LEDs Indicadores
#define LED_GREEN 13    // Dispensación exitosa
#define LED_YELLOW 12   // Procesando
#define LED_RED 11      // Error/Denegado

// Buzzer
#define BUZZER_PIN 10

// Botones
#define BTN_QR 7        // Botón método QR
#define BTN_CEDULA 6    // Botón método Cédula

// Comunicación Serial con ESP32-CAM
#define ESP32_SERIAL Serial3  // TX3=14, RX3=15

// ============================================
// OBJETOS GLOBALES
// ============================================

LiquidCrystal_I2C lcd(LCD_ADDR, LCD_COLS, LCD_ROWS);
Servo servoMotor;

// ============================================
// ESTADOS DEL SISTEMA
// ============================================

enum SystemState {
  STATE_IDLE,           // Esperando selección de método
  STATE_WAIT_QR,        // Esperando código QR
  STATE_WAIT_CEDULA,    // Esperando cédula
  STATE_PROCESSING,     // Procesando imagen en API
  STATE_DISPENSING,     // Dispensando medicamento
  STATE_SUCCESS,        // Dispensación exitosa
  STATE_ERROR           // Error en validación
};

SystemState currentState = STATE_IDLE;

// ============================================
// CONFIGURACIÓN DE SERVO
// ============================================

#define SERVO_POS_CLOSED 0      // Posición cerrada
#define SERVO_POS_OPEN 90       // Posición abierta
#define DISPENSE_DURATION 2000  // Duración de apertura (ms)

// ============================================
// VARIABLES GLOBALES
// ============================================

String apiResponse = "";
unsigned long lastActionTime = 0;
const unsigned long TIMEOUT_CAPTURE = 10000;  // 10 segundos timeout para captura
const unsigned long TIMEOUT_PROCESSING = 15000; // 15 segundos timeout para API
const unsigned long STATE_SUCCESS_DURATION = 3000; // Mostrar éxito 3 segundos
const unsigned long STATE_ERROR_DURATION = 5000;   // Mostrar error 5 segundos

// ============================================
// SETUP
// ============================================

void setup() {
  // Inicializar Serial para debug
  Serial.begin(115200);
  Serial.println("Sistema Iniciando...");

  // Inicializar comunicación con ESP32-CAM
  ESP32_SERIAL.begin(115200);

  // Configurar pines
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BTN_QR, INPUT);
  pinMode(BTN_CEDULA, INPUT);

  // Inicializar LEDs apagados
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, LOW);

  // Inicializar servo
  servoMotor.attach(SERVO_PIN);
  servoMotor.write(SERVO_POS_CLOSED);

  // Inicializar LCD
  lcd.init();
  lcd.backlight();
  lcd.clear();

  // Mensaje de bienvenida
  showWelcome();
  delay(2000);

  // Cambiar a estado inicial
  changeState(STATE_IDLE);

  Serial.println("Sistema listo");
}

// ============================================
// LOOP PRINCIPAL
// ============================================

void loop() {
  // Leer botones
  bool btnQRPressed = digitalRead(BTN_QR) == HIGH;
  bool btnCedulaPressed = digitalRead(BTN_CEDULA) == HIGH;

  // Leer respuesta del ESP32-CAM si hay datos disponibles
  if (ESP32_SERIAL.available()) {
    String response = ESP32_SERIAL.readStringUntil('\n');
    response.trim();
    handleESP32Response(response);
  }

  // Máquina de estados
  switch (currentState) {
    case STATE_IDLE:
      // Esperar selección de método
      if (btnQRPressed) {
        changeState(STATE_WAIT_QR);
      } else if (btnCedulaPressed) {
        changeState(STATE_WAIT_CEDULA);
      }
      break;

    case STATE_WAIT_QR:
      // Timeout si no se captura en tiempo
      if (millis() - lastActionTime > TIMEOUT_CAPTURE) {
        showError("Timeout captura");
        delay(2000);
        changeState(STATE_IDLE);
      }
      break;

    case STATE_WAIT_CEDULA:
      // Timeout si no se captura en tiempo
      if (millis() - lastActionTime > TIMEOUT_CAPTURE) {
        showError("Timeout captura");
        delay(2000);
        changeState(STATE_IDLE);
      }
      break;

    case STATE_PROCESSING:
      // Timeout si API no responde
      if (millis() - lastActionTime > TIMEOUT_PROCESSING) {
        changeState(STATE_ERROR);
        showError("Timeout API");
      }
      break;

    case STATE_DISPENSING:
      // Dispensación en progreso, esperar a que termine
      // (el cambio de estado se maneja en dispense())
      break;

    case STATE_SUCCESS:
      // Mostrar éxito por tiempo definido
      if (millis() - lastActionTime > STATE_SUCCESS_DURATION) {
        changeState(STATE_IDLE);
      }
      break;

    case STATE_ERROR:
      // Mostrar error por tiempo definido
      if (millis() - lastActionTime > STATE_ERROR_DURATION) {
        changeState(STATE_IDLE);
      }
      break;
  }

  delay(50); // Anti-rebote para botones
}

// ============================================
// FUNCIONES DE CAMBIO DE ESTADO
// ============================================

void changeState(SystemState newState) {
  currentState = newState;
  lastActionTime = millis();

  // Apagar todos los LEDs al cambiar estado
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, LOW);

  switch (newState) {
    case STATE_IDLE:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Seleccione modo");
      lcd.setCursor(0, 1);
      lcd.print("QR    /  Cedula");
      Serial.println("Estado: IDLE");
      break;

    case STATE_WAIT_QR:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Muestre codigo");
      lcd.setCursor(0, 1);
      lcd.print("QR al lector");
      digitalWrite(LED_YELLOW, HIGH);
      // Enviar comando al ESP32-CAM para capturar QR
      ESP32_SERIAL.println("CAPTURE_QR");
      Serial.println("Estado: WAIT_QR");
      break;

    case STATE_WAIT_CEDULA:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Muestre cedula");
      lcd.setCursor(0, 1);
      lcd.print("al lector");
      digitalWrite(LED_YELLOW, HIGH);
      // Enviar comando al ESP32-CAM para capturar cédula
      ESP32_SERIAL.println("CAPTURE_CEDULA");
      Serial.println("Estado: WAIT_CEDULA");
      break;

    case STATE_PROCESSING:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Validando...");
      lcd.setCursor(0, 1);
      lcd.print("Espere");
      digitalWrite(LED_YELLOW, HIGH);
      Serial.println("Estado: PROCESSING");
      break;

    case STATE_DISPENSING:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Dispensando");
      lcd.setCursor(0, 1);
      lcd.print("medicamento...");
      digitalWrite(LED_GREEN, HIGH);
      playSuccessTone();
      Serial.println("Estado: DISPENSING");
      break;

    case STATE_SUCCESS:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Dispensacion");
      lcd.setCursor(0, 1);
      lcd.print("exitosa!");
      digitalWrite(LED_GREEN, HIGH);
      Serial.println("Estado: SUCCESS");
      break;

    case STATE_ERROR:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Acceso");
      lcd.setCursor(0, 1);
      lcd.print("DENEGADO");
      digitalWrite(LED_RED, HIGH);
      playErrorTone();
      Serial.println("Estado: ERROR");
      break;
  }
}

// ============================================
// MANEJO DE RESPUESTAS DEL ESP32-CAM
// ============================================

void handleESP32Response(String response) {
  Serial.print("ESP32 response: ");
  Serial.println(response);

  if (response.startsWith("CAPTURING")) {
    changeState(STATE_PROCESSING);
  }
  else if (response.startsWith("API_OK:AUTHORIZED")) {
    // Extraer información adicional si está disponible
    // Formato: API_OK:AUTHORIZED:NombrePaciente:Medicamento
    int firstColon = response.indexOf(':', 7);
    if (firstColon > 0) {
      int secondColon = response.indexOf(':', firstColon + 1);
      String patientName = response.substring(firstColon + 1, secondColon);
      String medicine = response.substring(secondColon + 1);

      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print(patientName);
      lcd.setCursor(0, 1);
      lcd.print(medicine);
      delay(2000);
    }

    // Dispensar medicamento
    dispense();
  }
  else if (response.startsWith("API_ERROR:")) {
    // Extraer razón del error
    String errorReason = response.substring(10);
    showError(errorReason);
    changeState(STATE_ERROR);
  }
  else if (response.startsWith("ERROR:")) {
    // Error del ESP32-CAM (captura, WiFi, etc.)
    String errorMsg = response.substring(6);
    showError(errorMsg);
    changeState(STATE_ERROR);
  }
  else if (response == "WIFI_CONNECTED") {
    Serial.println("ESP32-CAM conectado a WiFi");
  }
  else if (response == "WIFI_DISCONNECTED") {
    Serial.println("ESP32-CAM desconectado de WiFi");
    showError("Sin conexion");
    delay(2000);
    changeState(STATE_IDLE);
  }
}

// ============================================
// FUNCIÓN DE DISPENSACIÓN
// ============================================

void dispense() {
  changeState(STATE_DISPENSING);

  // Abrir compartimento
  servoMotor.write(SERVO_POS_OPEN);
  delay(DISPENSE_DURATION);

  // Cerrar compartimento
  servoMotor.write(SERVO_POS_CLOSED);
  delay(500);

  // Cambiar a estado de éxito
  changeState(STATE_SUCCESS);
}

// ============================================
// FUNCIONES DE INTERFAZ
// ============================================

void showWelcome() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("  Dispensador");
  lcd.setCursor(0, 1);
  lcd.print("  Inteligente");
  playStartupTone();
}

void showError(String message) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("ERROR:");
  lcd.setCursor(0, 1);
  // Truncar mensaje si es muy largo
  if (message.length() > 16) {
    message = message.substring(0, 16);
  }
  lcd.print(message);
  Serial.print("Error: ");
  Serial.println(message);
}

// ============================================
// FUNCIONES DE AUDIO (Buzzer)
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

void playErrorTone() {
  tone(BUZZER_PIN, 400, 300);
  delay(350);
  tone(BUZZER_PIN, 400, 300);
  delay(350);
  tone(BUZZER_PIN, 400, 300);
}

// ============================================
// NOTAS DE IMPLEMENTACIÓN
// ============================================

/*
 * PROTOCOLO DE COMUNICACIÓN CON ESP32-CAM:
 *
 * Arduino → ESP32:
 *   - "CAPTURE_QR"      : Solicitar captura de código QR
 *   - "CAPTURE_CEDULA"  : Solicitar captura de cédula
 *
 * ESP32 → Arduino:
 *   - "CAPTURING"                            : Iniciando captura
 *   - "API_OK:AUTHORIZED[:Nombre:Med]"      : Autorizado para dispensar
 *   - "API_ERROR:Razon"                     : Denegado por API
 *   - "ERROR:Mensaje"                       : Error de ESP32 (WiFi, cámara, etc.)
 *   - "WIFI_CONNECTED"                      : Conectado a WiFi
 *   - "WIFI_DISCONNECTED"                   : Desconectado de WiFi
 *
 * MEJORAS FUTURAS:
 * - Añadir sensor de presencia para activación automática
 * - Implementar log local con módulo SD
 * - Añadir RTC para timestamps precisos sin internet
 * - Sistema de notificaciones con buzzer más elaborado
 * - Contador de dosis restantes en el compartimento
 * - Modo de mantenimiento/recarga
 */
