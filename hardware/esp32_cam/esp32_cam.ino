/*
 * Dispensador Inteligente de Medicamentos
 * ESP32-CAM - Módulo de Captura y Comunicación
 *
 * Funciones:
 * - Captura de imágenes (QR y cédulas)
 * - Conectividad WiFi
 * - Comunicación HTTP con API backend
 * - Comunicación Serial con Arduino Mega
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <base64.h>

// ============================================
// CONFIGURACIÓN DE WIFI
// ============================================

const char* ssid = "TU_WIFI_SSID";          // Cambiar por tu red WiFi
const char* password = "TU_WIFI_PASSWORD";  // Cambiar por tu contraseña

// ============================================
// CONFIGURACIÓN DE API
// ============================================

const char* apiBaseUrl = "http://192.168.1.100:3000/api"; // Cambiar por IP de tu servidor
const char* apiValidateQR = "/validate-qr";
const char* apiValidateCedula = "/validate-cedula";

// ============================================
// CONFIGURACIÓN DE CÁMARA (AI-Thinker ESP32-CAM)
// ============================================

#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// Flash LED
#define FLASH_LED_PIN 4

// ============================================
// VARIABLES GLOBALES
// ============================================

bool wifiConnected = false;
String currentMode = ""; // "QR" o "CEDULA"

// ============================================
// SETUP
// ============================================

void setup() {
  // Inicializar Serial para comunicación con Arduino
  Serial.begin(115200);
  Serial.setDebugOutput(false); // Desactivar debug para no interferir con protocolo

  // Configurar Flash LED
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);

  // Inicializar cámara
  if (!initCamera()) {
    Serial.println("ERROR:Camera init failed");
    delay(1000);
    ESP.restart();
  }

  // Conectar a WiFi
  connectWiFi();
}

// ============================================
// LOOP PRINCIPAL
// ============================================

void loop() {
  // Verificar conexión WiFi
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      wifiConnected = false;
      Serial.println("WIFI_DISCONNECTED");
      connectWiFi(); // Intentar reconectar
    }
  } else {
    if (!wifiConnected) {
      wifiConnected = true;
      Serial.println("WIFI_CONNECTED");
    }
  }

  // Leer comandos del Arduino
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    handleCommand(command);
  }

  delay(100);
}

// ============================================
// INICIALIZACIÓN DE CÁMARA
// ============================================

bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Configuración de calidad según PSRAM
  if (psramFound()) {
    config.frame_size = FRAMESIZE_SVGA;  // 800x600 para buena calidad OCR
    config.jpeg_quality = 10;            // 0-63, menor = mejor calidad
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_VGA;   // 640x480
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  // Inicializar cámara
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    return false;
  }

  // Ajustes de sensor para mejor captura
  sensor_t * s = esp_camera_sensor_get();
  s->set_brightness(s, 0);     // -2 a 2
  s->set_contrast(s, 0);       // -2 a 2
  s->set_saturation(s, 0);     // -2 a 2
  s->set_special_effect(s, 0); // 0 = sin efectos
  s->set_whitebal(s, 1);       // 0 = desactivar, 1 = activar
  s->set_awb_gain(s, 1);       // 0 = desactivar, 1 = activar
  s->set_wb_mode(s, 0);        // 0 a 4
  s->set_exposure_ctrl(s, 1);  // 0 = desactivar, 1 = activar
  s->set_aec2(s, 0);           // 0 = desactivar, 1 = activar
  s->set_ae_level(s, 0);       // -2 a 2
  s->set_aec_value(s, 300);    // 0 a 1200
  s->set_gain_ctrl(s, 1);      // 0 = desactivar, 1 = activar
  s->set_agc_gain(s, 0);       // 0 a 30
  s->set_gainceiling(s, (gainceiling_t)0); // 0 a 6
  s->set_bpc(s, 0);            // 0 = desactivar, 1 = activar
  s->set_wpc(s, 1);            // 0 = desactivar, 1 = activar
  s->set_raw_gma(s, 1);        // 0 = desactivar, 1 = activar
  s->set_lenc(s, 1);           // 0 = desactivar, 1 = activar
  s->set_hmirror(s, 0);        // 0 = desactivar, 1 = activar
  s->set_vflip(s, 0);          // 0 = desactivar, 1 = activar
  s->set_dcw(s, 1);            // 0 = desactivar, 1 = activar
  s->set_colorbar(s, 0);       // 0 = desactivar, 1 = activar

  return true;
}

// ============================================
// CONEXIÓN WIFI
// ============================================

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("WIFI_CONNECTED");
  } else {
    wifiConnected = false;
    Serial.println("ERROR:WiFi connection failed");
  }
}

// ============================================
// MANEJO DE COMANDOS
// ============================================

void handleCommand(String command) {
  if (command == "CAPTURE_QR") {
    currentMode = "QR";
    captureAndSend(apiValidateQR);
  }
  else if (command == "CAPTURE_CEDULA") {
    currentMode = "CEDULA";
    captureAndSend(apiValidateCedula);
  }
}

// ============================================
// CAPTURA Y ENVÍO DE IMAGEN
// ============================================

void captureAndSend(const char* endpoint) {
  Serial.println("CAPTURING");

  if (!wifiConnected) {
    Serial.println("ERROR:No WiFi connection");
    return;
  }

  // Encender flash LED para mejor iluminación
  digitalWrite(FLASH_LED_PIN, HIGH);
  delay(200); // Dar tiempo al sensor para ajustarse

  // Capturar imagen
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    digitalWrite(FLASH_LED_PIN, LOW);
    Serial.println("ERROR:Camera capture failed");
    return;
  }

  // Apagar flash
  digitalWrite(FLASH_LED_PIN, LOW);

  // Convertir imagen a Base64
  String imageBase64 = base64::encode(fb->buf, fb->len);

  // Crear JSON payload
  String payload = "{\"image\":\"data:image/jpeg;base64," + imageBase64 + "\"}";

  // Liberar buffer de cámara
  esp_camera_fb_return(fb);

  // Enviar a API
  HTTPClient http;
  String fullUrl = String(apiBaseUrl) + String(endpoint);
  http.begin(fullUrl);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(15000); // 15 segundos timeout

  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    if (httpCode == HTTP_CODE_OK) {
      String response = http.getString();
      parseAPIResponse(response);
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
// PARSEO DE RESPUESTA DEL API
// ============================================

void parseAPIResponse(String response) {
  // El API debe responder con JSON:
  // {"authorized": true, "patient": "Juan Perez", "medicine": "Aspirina"}
  // o
  // {"authorized": false, "reason": "No prescription found"}

  // Buscar campo "authorized"
  int authIndex = response.indexOf("\"authorized\"");
  if (authIndex == -1) {
    Serial.println("API_ERROR:Invalid response format");
    return;
  }

  // Determinar si está autorizado
  bool authorized = response.indexOf("true", authIndex) != -1;

  if (authorized) {
    // Extraer nombre del paciente
    String patientName = extractJSONField(response, "patient");
    String medicine = extractJSONField(response, "medicine");

    if (patientName.length() > 0 && medicine.length() > 0) {
      Serial.print("API_OK:AUTHORIZED:");
      Serial.print(patientName);
      Serial.print(":");
      Serial.println(medicine);
    } else {
      Serial.println("API_OK:AUTHORIZED");
    }
  } else {
    // Extraer razón de denegación
    String reason = extractJSONField(response, "reason");
    if (reason.length() > 0) {
      Serial.print("API_ERROR:");
      Serial.println(reason);
    } else {
      Serial.println("API_ERROR:Unauthorized");
    }
  }
}

// ============================================
// FUNCIÓN AUXILIAR: EXTRAER CAMPO JSON
// ============================================

String extractJSONField(String json, String fieldName) {
  String searchStr = "\"" + fieldName + "\"";
  int startIndex = json.indexOf(searchStr);
  if (startIndex == -1) return "";

  startIndex = json.indexOf("\"", startIndex + searchStr.length());
  if (startIndex == -1) return "";
  startIndex++; // Saltar comilla de apertura

  int endIndex = json.indexOf("\"", startIndex);
  if (endIndex == -1) return "";

  return json.substring(startIndex, endIndex);
}

// ============================================
// NOTAS DE IMPLEMENTACIÓN
// ============================================

/*
 * MEJORAS FUTURAS:
 *
 * 1. Guardar imágenes en tarjeta SD para auditoría
 * 2. Implementar compresión de imágenes antes de enviar
 * 3. Añadir reintentos automáticos en caso de fallo
 * 4. Implementar HTTPS para comunicación segura con API
 * 5. Añadir modo de calibración de cámara
 * 6. Optimizar configuración de cámara según tipo de captura (QR vs Cédula)
 * 7. Implementar detección de movimiento antes de capturar
 * 8. Añadir modo de depuración con streaming de video
 *
 * CONFIGURACIÓN PARA PRODUCCIÓN:
 *
 * - Cambiar ssid y password por tus credenciales WiFi
 * - Cambiar apiBaseUrl por la IP/dominio de tu servidor
 * - Si usas HTTPS, incluir certificado SSL
 * - Ajustar calidad de imagen según velocidad de red
 * - Considerar usar WiFiClientSecure para HTTPS
 *
 * TROUBLESHOOTING:
 *
 * - Si la cámara no inicializa, verificar conexiones de pines
 * - Si WiFi no conecta, verificar SSID y password
 * - Si API no responde, verificar firewall y conectividad
 * - Para programar: conectar GPIO0 a GND, después desconectar
 * - Usar fuente de al menos 2A, el ESP32-CAM consume mucho con WiFi
 */
