# Guía de Hardware - Dispensador Medispen

## 🎯 Sistema Simple

El sistema tiene 2 componentes principales:

1. **Arduino Mega 2560** → Controla hardware físico (servo, LCD, LEDs, buzzer)
2. **ESP32 Regular** → Solo WiFi + HTTP calls al API

---

## 📦 Lo Que Necesitas Comprar

### Hardware Esencial

| Componente | Precio (USD) | Para Qué |
|------------|--------------|----------|
| Arduino Mega 2560 | $25-35 | Cerebro del sistema |
| ESP32 DevKit | $5-7 | WiFi (HTTP calls) |
| Servo Motor SG90 | $2-3 | Abrir/cerrar compartimento |
| LCD 16x2 I2C | $4-6 | Mostrar mensajes |
| LEDs (3x) | $0.30 | Verde/Rojo/Amarillo |
| Buzzer 5V | $1 | Sonidos |
| Botones (2x) | $0.40 | Dispensar/Cancelar |
| Resistencias 220Ω (3x) | $0.30 | Para LEDs |
| Resistencias 10kΩ (2x) | $0.20 | Para botones |
| Protoboard | $3-5 | Conexiones |
| Cables Dupont | $4 | Conexiones |
| Fuente 5V 3A | $5-8 | Alimentación |

**Total: ~$50-70 USD**

### Dónde Comprar (Colombia)
- Vistronica
- Sigma Electrónica
- MercadoLibre

---

## 🔌 Conexiones

### Arduino Mega → Componentes

```
LCD I2C:
  SDA → Pin 20
  SCL → Pin 21
  VCC → 5V
  GND → GND

Servo Motor:
  Señal (naranja) → Pin 9
  VCC (rojo) → 5V
  GND (negro) → GND

LEDs:
  Verde → Pin 13 + resistencia 220Ω → GND
  Amarillo → Pin 12 + resistencia 220Ω → GND
  Rojo → Pin 11 + resistencia 220Ω → GND

Buzzer:
  Positivo → Pin 10
  Negativo → GND

Botones (con resistencia pull-down):
  Botón 1 → Pin 7 + 10kΩ a GND
  Botón 2 → Pin 6 + 10kΩ a GND
```

### Arduino Mega ↔ ESP32 (Serial)

```
Arduino TX3 (Pin 14) → ESP32 RX (GPIO3)
Arduino RX3 (Pin 15) → ESP32 TX (GPIO1)
Arduino GND → ESP32 GND
Arduino 5V → ESP32 VIN
```

### Alimentación

```
Fuente 5V 3A → Arduino VIN
Arduino 5V → Protoboard rail +
Arduino GND → Protoboard rail -
```

---

## 💻 Software

### 1. Instalar Arduino IDE
- Descargar de: https://www.arduino.cc/en/software
- Instalar drivers CH340 si tu Arduino es clon

### 2. Instalar Librerías

En Arduino IDE: `Sketch → Include Library → Manage Libraries`

Buscar e instalar:
- `LiquidCrystal I2C` (por Frank de Brabander)
- `Servo` (incluida por defecto)
- `ArduinoJson` (por Benoit Blanchon) - Solo para ESP32
- `WiFi` (incluida por defecto en ESP32)
- `HTTPClient` (incluida por defecto en ESP32)

### 3. Configurar ESP32 en Arduino IDE

1. `File → Preferences`
2. En "Additional Board Manager URLs" agregar:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. `Tools → Board → Boards Manager`
4. Buscar "esp32" e instalar

---

## 🧪 Testing

### Paso 1: Test Servo Solo (SIN ESP32)

1. Conecta solo el servo al Arduino:
   - Señal → Pin 9
   - VCC → 5V
   - GND → GND

2. Abre `hardware/test_servo.ino` en Arduino IDE

3. Selecciona:
   - `Tools → Board → Arduino Mega 2560`
   - `Tools → Port → [tu puerto]`

4. Sube el código (botón →)

5. Abre Serial Monitor (115200 baud)

6. Deberías ver el servo abrir/cerrar cada 2 segundos

**Si funciona** → Tu servo y Arduino están OK ✅

---

### Paso 2: Sistema Completo (CON ESP32)

#### A) Configurar ESP32

1. Abre `hardware/esp32_regular/esp32_regular.ino`

2. **CAMBIAR** estas líneas (23-24 y 35):
   ```cpp
   const char* ssid = "TU_WIFI_SSID";       // Tu WiFi
   const char* password = "TU_WIFI_PASS";   // Tu contraseña
   const char* apiBaseUrl = "http://192.168.1.X:3000/api"; // IP de tu PC
   ```

3. Para encontrar la IP de tu PC:
   - **Mac**: Terminal → `ifconfig` → busca `inet`
   - **Windows**: CMD → `ipconfig` → busca `IPv4`
   - **Linux**: Terminal → `ip addr` → busca `inet`

4. Selecciona:
   - `Tools → Board → ESP32 Dev Module`
   - `Tools → Port → [tu puerto ESP32]`

5. Sube el código

6. Abre Serial Monitor (115200 baud)

7. Deberías ver:
   ```
   ESP32_READY
   WIFI_CONNECTED
   IP:192.168.1.X
   ```

**Si conecta** → ESP32 está OK ✅

#### B) Configurar Arduino Mega

1. **Desconecta el ESP32** del Arduino (para evitar conflictos Serial)

2. Abre `hardware/arduino_main/arduino_main.ino`

3. No necesitas cambiar nada

4. Selecciona:
   - `Tools → Board → Arduino Mega 2560`
   - `Tools → Port → [tu puerto Arduino]`

5. Sube el código

6. **Reconecta el ESP32** al Arduino (pines TX3/RX3)

7. Deberías ver en el LCD: "Capture imagen / Luego presione"

**Si funciona** → Sistema listo ✅

---

## 🚀 Flujo de Uso

1. **Usuario abre mobile app** en smartphone
2. **Toma foto** de cédula o QR
3. **API valida** y crea sesión (90 seg)
4. **Usuario va al dispensador** físico
5. **Presiona botón** en el Arduino
6. **Arduino pide al ESP32**: "CHECK_PENDING"
7. **ESP32 consulta API** cada 2 seg
8. **API responde** con info del paciente
9. **ESP32 envía a Arduino**: "AUTHORIZED:..."
10. **Arduino mueve servo** → Dispensa
11. **Arduino confirma**: "CONFIRM:sessionId"
12. **ESP32 confirma al API** → Registra en DB

---

## 🐛 Troubleshooting

### Arduino no compila
- Instalar librería `LiquidCrystal I2C`
- Instalar librería `Servo`

### ESP32 no conecta WiFi
- Verificar SSID y password (case-sensitive)
- Verificar que el WiFi sea 2.4GHz (ESP32 no soporta 5GHz)
- Acercarse al router

### ESP32 no encuentra API
- Verificar que el API esté corriendo (`cd api && npm start`)
- Verificar IP del servidor (puede cambiar)
- Hacer ping desde otra PC: `ping 192.168.1.X`
- Verificar firewall no bloquee puerto 3000

### Servo no se mueve
- Verificar conexión de alimentación (5V, GND)
- Verificar cable de señal en Pin 9
- Probar con `test_servo.ino` primero

### LCD no muestra nada
- Verificar conexión I2C (SDA pin 20, SCL pin 21)
- Ajustar contraste con potenciómetro en el módulo I2C
- Verificar dirección I2C (común: 0x27 o 0x3F)

---

## ✅ Checklist de Ensamblaje

- [ ] Arduino Mega conectado a USB
- [ ] Servo conectado (Pin 9, 5V, GND)
- [ ] LCD I2C conectado (Pin 20, 21, 5V, GND)
- [ ] LEDs con resistencias (Pins 11, 12, 13)
- [ ] Buzzer conectado (Pin 10, GND)
- [ ] Botones con pull-down (Pins 6, 7)
- [ ] ESP32 conectado Serial (TX3→RX, RX3→TX, GND, 5V)
- [ ] Código Arduino subido
- [ ] Código ESP32 subido y configurado (WiFi + IP)
- [ ] API corriendo en PC (`npm start`)
- [ ] Mobile app accesible desde smartphone

---

## 📝 Notas

- **ESP32-CAM ya NO se usa** → Sistema usa smartphone + OpenAI OCR
- **ATmega 328P (Arduino Uno) NO sirve** → Necesitas Mega 2560
- **Sistema es simple**: Arduino mueve cosas, ESP32 solo hace HTTP
- **Sin ESP32 no hay WiFi** → Arduino Mega no tiene WiFi integrado
- **Servo consume corriente** → Usar fuente externa, no USB
- **WiFi debe ser 2.4GHz** → ESP32 no soporta 5GHz

---

## 🔗 Referencias

- Arduino IDE: https://www.arduino.cc/
- ESP32 Docs: https://docs.espressif.com/
- LiquidCrystal I2C: https://github.com/johnrickman/LiquidCrystal_I2C
- ArduinoJson: https://arduinojson.org/
