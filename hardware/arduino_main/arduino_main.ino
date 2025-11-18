/*
 * Dispensador Inteligente de Medicamentos
 * Arduino Mega 2560 - Controlador Principal
 *
 * NUEVA ARQUITECTURA (sin ESP32-CAM):
 * - Usuario captura imagen desde smartphone
 * - API valida y crea sesión temporal (90 seg)
 * - Usuario presiona botón en dispensador
 * - ESP32 consulta sesiones pendientes al API
 * - Arduino recibe autorización y dispensa
 *
 * Funciones:
 * - Control de interfaz de usuario (LCD, botones, LEDs, buzzer)
 * - Control de servo motor para dispensación
 * - Comunicación con ESP32 regular vía Serial
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
#define BTN_DISPENSE 7  // Botón para iniciar dispensación
#define BTN_CANCEL 6    // Botón para cancelar

// Comunicación Serial con ESP32 Regular
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
  STATE_IDLE,           // Esperando que usuario presione botón
  STATE_CHECKING,       // Consultando si hay sesión pendiente
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
String currentSessionId = "";
String currentPatient = "";
String currentMedicine = "";
String currentDosage = "";

unsigned long lastActionTime = 0;
const unsigned long TIMEOUT_CHECKING = 90000;      // 90 segundos timeout para verificación
const unsigned long STATE_SUCCESS_DURATION = 3000; // Mostrar éxito 3 segundos
const unsigned long STATE_ERROR_DURATION = 5000;   // Mostrar error 5 segundos

// ============================================
// SETUP
// ============================================

void setup() {
  // Inicializar Serial para debug
  Serial.begin(115200);
  Serial.println("Sistema Iniciando...");

  // Inicializar comunicación con ESP32 Regular
  ESP32_SERIAL.begin(115200);

  // Configurar pines
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BTN_DISPENSE, INPUT);
  pinMode(BTN_CANCEL, INPUT);

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
  bool btnDispensePressed = digitalRead(BTN_DISPENSE) == HIGH;
  bool btnCancelPressed = digitalRead(BTN_CANCEL) == HIGH;

  // Leer respuesta del ESP32 si hay datos disponibles
  if (ESP32_SERIAL.available()) {
    String response = ESP32_SERIAL.readStringUntil('\n');
    response.trim();
    handleESP32Response(response);
  }

  // Máquina de estados
  switch (currentState) {
    case STATE_IDLE:
      // Esperar que usuario presione botón de dispensación
      if (btnDispensePressed) {
        changeState(STATE_CHECKING);
      }
      break;

    case STATE_CHECKING:
      // Verificando si hay sesión pendiente
      // Timeout si no se encuentra sesión en 90 segundos
      if (millis() - lastActionTime > TIMEOUT_CHECKING) {
        ESP32_SERIAL.println("STOP_CHECK");
        showError("Timeout - Sin sesion");
        changeState(STATE_ERROR);
      }
      
      // Permitir cancelar
      if (btnCancelPressed) {
        ESP32_SERIAL.println("STOP_CHECK");
        changeState(STATE_IDLE);
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
      lcd.print("Capture imagen");
      lcd.setCursor(0, 1);
      lcd.print("Luego presione");
      Serial.println("Estado: IDLE");
      break;

    case STATE_CHECKING:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Verificando...");
      lcd.setCursor(0, 1);
      lcd.print("Espere");
      digitalWrite(LED_YELLOW, HIGH);
      // Solicitar al ESP32 que consulte sesiones pendientes
      ESP32_SERIAL.println("CHECK_PENDING");
      Serial.println("Estado: CHECKING");
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
// MANEJO DE RESPUESTAS DEL ESP32
// ============================================

void handleESP32Response(String response) {
  Serial.print("ESP32 response: ");
  Serial.println(response);

  if (response.startsWith("AUTHORIZED:")) {
    // Formato: AUTHORIZED:sessionId:Patient:Medicine:Dosage
    // Parsear la respuesta
    int firstColon = response.indexOf(':', 11);
    int secondColon = response.indexOf(':', firstColon + 1);
    int thirdColon = response.indexOf(':', secondColon + 1);
    
    if (firstColon > 0 && secondColon > 0 && thirdColon > 0) {
      currentSessionId = response.substring(11, firstColon);
      currentPatient = response.substring(firstColon + 1, secondColon);
      currentMedicine = response.substring(secondColon + 1, thirdColon);
      currentDosage = response.substring(thirdColon + 1);

      // Mostrar información del paciente
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print(currentPatient);
      lcd.setCursor(0, 1);
      lcd.print(currentMedicine);
      delay(2000);

      // Dispensar medicamento
      dispense();
    } else {
      showError("Error en respuesta");
      changeState(STATE_ERROR);
    }
  }
  else if (response.startsWith("ERROR:")) {
    // Error del ESP32 (WiFi, API, etc.)
    String errorMsg = response.substring(6);
    showError(errorMsg);
    changeState(STATE_ERROR);
  }
  else if (response == "WIFI_CONNECTED") {
    Serial.println("ESP32 conectado a WiFi");
  }
  else if (response == "WIFI_DISCONNECTED") {
    Serial.println("ESP32 desconectado de WiFi");
    if (currentState == STATE_CHECKING) {
      showError("Sin conexion WiFi");
      changeState(STATE_ERROR);
    }
  }
  else if (response == "CONFIRM_OK") {
    Serial.println("Dispensacion confirmada en servidor");
  }
  else if (response.startsWith("IP:")) {
    Serial.print("ESP32 IP: ");
    Serial.println(response.substring(3));
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

  // Confirmar dispensación con el servidor
  if (currentSessionId.length() > 0) {
    ESP32_SERIAL.print("CONFIRM:");
    ESP32_SERIAL.println(currentSessionId);
  }

  // Cambiar a estado de éxito
  changeState(STATE_SUCCESS);

  // Limpiar variables
  currentSessionId = "";
  currentPatient = "";
  currentMedicine = "";
  currentDosage = "";
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
 * PROTOCOLO DE COMUNICACIÓN CON ESP32 (nueva arquitectura):
 *
 * Arduino → ESP32:
 *   - "CHECK_PENDING"       : Solicitar verificación de sesión pendiente
 *   - "STOP_CHECK"          : Detener verificación
 *   - "CONFIRM:sessionId"   : Confirmar dispensación exitosa
 *
 * ESP32 → Arduino:
 *   - "ESP32_READY"                                 : ESP32 iniciado
 *   - "WIFI_CONNECTED"                              : Conectado a WiFi
 *   - "WIFI_DISCONNECTED"                           : Desconectado de WiFi
 *   - "IP:192.168.x.x"                              : Dirección IP
 *   - "AUTHORIZED:sessionId:Patient:Med:Dose"      : Sesión autorizada encontrada
 *   - "CONFIRM_OK"                                  : Confirmación enviada al API
 *   - "ERROR:Mensaje"                               : Error
 *
 * FLUJO DE OPERACIÓN (NUEVA ARQUITECTURA):
 *
 * 1. Usuario abre web app en smartphone
 * 2. Selecciona método (QR o Cédula) y captura foto
 * 3. Web app envía imagen al API
 * 4. API valida y crea sesión temporal de 90 segundos
 * 5. Web app muestra confirmación: "Presiona el botón del dispensador"
 * 6. Usuario presiona botón en dispensador físico
 * 7. Arduino envía "CHECK_PENDING" al ESP32
 * 8. ESP32 consulta al API cada 2 segundos
 * 9. Si hay sesión pendiente, ESP32 envía "AUTHORIZED:..." al Arduino
 * 10. Arduino muestra info del paciente y dispensa medicamento
 * 11. Arduino envía "CONFIRM:sessionId" al ESP32
 * 12. ESP32 confirma con el API que se dispensó
 * 13. Sistema vuelve a estado IDLE
 *
 * MEJORAS FUTURAS:
 * - Añadir sensor de presencia para activación automática
 * - Implementar log local con módulo SD
 * - Añadir RTC para timestamps precisos sin internet
 * - Sistema de notificaciones con buzzer más elaborado
 * - Contador de dosis restantes en el compartimento
 * - Modo de mantenimiento/recarga
 * - Pantalla LCD más grande para mostrar más información
 * - Múltiples compartimentos para diferentes medicamentos
 */
