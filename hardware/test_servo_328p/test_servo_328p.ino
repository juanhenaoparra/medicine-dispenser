/*
 * TEST SIMPLE - Servo Motor con Arduino 328P
 *
 * Propósito: Solo probar que el servo funciona
 *
 * Conexiones:
 * - Servo señal (naranja/amarillo) → Pin 9
 * - Servo VCC (rojo) → 5V
 * - Servo GND (negro/marrón) → GND
 *
 * Qué hace:
 * - Abre el servo (90°)
 * - Espera 2 segundos
 * - Cierra el servo (0°)
 * - Espera 2 segundos
 * - Repite
 */

#include <Servo.h>

Servo servoMotor;

#define SERVO_PIN 9
#define SERVO_CLOSED 0
#define SERVO_OPEN 90

void setup() {
  Serial.begin(115200);
  Serial.println("Test de Servo - ATmega328P");

  servoMotor.attach(SERVO_PIN);
  servoMotor.write(SERVO_CLOSED);

  Serial.println("Servo inicializado en posicion cerrada");
  delay(1000);
}

void loop() {
  Serial.println("Abriendo servo...");
  servoMotor.write(SERVO_OPEN);
  delay(2000);

  Serial.println("Cerrando servo...");
  servoMotor.write(SERVO_CLOSED);
  delay(2000);
}