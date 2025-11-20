/*
 * Test Servo Motor - ESP32 with BOOT Button
 *
 * Press BOOT button to cycle through different servo configurations
 * Find which one works best for your servo
 */

#include <ESP32Servo.h>

 ============================================
// CONFIGURACIÓN
// ============================================

#define SERVO_PIN 18
#define BOOT_BUTTON 0   // Built-in BOOT button

Servo myServo;

// Diferentes configuraciones a probar
struct ServoConfig {
  int minPulse;
  int maxPulse;
  String name;
};

ServoConfig configs[] = {
  {500, 2400, "Standard (500-2400)"},
  {544, 2400, "ESP32 Default (544-2400)"},
  {1000, 2000, "Conservative (1000-2000)"},
  {600, 2300, "Narrow (600-2300)"},
  {400, 2600, "Wide (400-2600)"},
  {700, 2100, "SG90 Optimized (700-2100)"}
};

int numConfigs = 6;
int currentConfig = 0;

// Debounce button
unsigned long lastButtonPress = 0;
const unsigned long debounceDelay = 300;

// ============================================
// SETUP
// ============================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(BOOT_BUTTON, INPUT_PULLUP);

  Serial.println("\n\n╔════════════════════════════════════╗");
  Serial.println("║  TEST SERVO - PRESIONA BOOT        ║");
  Serial.println("╚════════════════════════════════════╝\n");

  // Configurar PWM
  Serial.println("→ Configurando PWM...");
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  Serial.println("✓ PWM listo\n");

  printInstructions();
  loadConfig(currentConfig);
}

// ============================================
// LOOP
// ============================================

void loop() {
  // Leer botón BOOT (activo en LOW por INPUT_PULLUP)
  if (digitalRead(BOOT_BUTTON) == LOW) {
    unsigned long currentTime = millis();

    // Debounce
    if (currentTime - lastButtonPress > debounceDelay) {
      lastButtonPress = currentTime;

      // Esperar a que suelte el botón
      while (digitalRead(BOOT_BUTTON) == LOW) {
        delay(10);
      }

      // Siguiente configuración
      currentConfig++;
      if (currentConfig >= numConfigs) {
        currentConfig = 0;  // Loop back to start
        Serial.println("\n═══════════════════════════════════");
        Serial.println("  REINICIANDO CICLO");
        Serial.println("═══════════════════════════════════\n");
        delay(500);
      }

      loadConfig(currentConfig);
    }
  }

  delay(50);
}

// ============================================
// FUNCIONES
// ============================================

void loadConfig(int configIndex) {
  Serial.println("\n╔════════════════════════════════════╗");
  Serial.print("║  CONFIG ");
  Serial.print(configIndex + 1);
  Serial.print("/");
  Serial.print(numConfigs);
  Serial.println("                          ║");
  Serial.println("╚════════════════════════════════════╝");

  ServoConfig config = configs[configIndex];

  Serial.print("→ ");
  Serial.println(config.name);
  Serial.print("  Pulso: ");
  Serial.print(config.minPulse);
  Serial.print(" - ");
  Serial.print(config.maxPulse);
  Serial.println(" µs");
  Serial.println();

  // Detach si ya estaba conectado
  if (myServo.attached()) {
    myServo.detach();
    delay(100);
  }

  // Configurar con nuevos parámetros
  myServo.setPeriodHertz(50);
  myServo.attach(SERVO_PIN, config.minPulse, config.maxPulse);
  delay(100);

  // Test sequence
  Serial.println("→ Test sequence:");

  // Posición 0°
  Serial.println("  1. Moviendo a 0° (cerrado)");
  myServo.write(0);
  delay(1500);

  // Posición 90°
  Serial.println("  2. Moviendo a 90° (abierto)");
  myServo.write(90);
  delay(2000);

  // Posición 180°
  Serial.println("  3. Moviendo a 180° (máximo)");
  myServo.write(180);
  delay(1500);

  // Volver a 0°
  Serial.println("  4. Volviendo a 0° (cerrado)");
  myServo.write(0);
  delay(1000);

  Serial.println("\n✓ Test completado!");
  Serial.println("\n¿Funcionó bien?");
  Serial.println("  SÍ → Anota este config");
  Serial.println("  NO → Presiona BOOT para siguiente config\n");
  Serial.println("═══════════════════════════════════\n");
}

void printInstructions() {
  Serial.println("═══════════════════════════════════");
  Serial.println("   INSTRUCCIONES");
  Serial.println("═══════════════════════════════════");
  Serial.println("1. Observa el servo motor");
  Serial.println("2. Presiona BOOT para probar configs");
  Serial.println("3. Encuentra cuál funciona mejor");
  Serial.println("4. Anota el número de config");
  Serial.println("═══════════════════════════════════\n");
  Serial.println("Empezando en 2 segundos...\n");
  delay(2000);
}
