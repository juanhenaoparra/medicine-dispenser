# ESP32 Todo-en-Uno - Dispensador Medispen

## 🎯 ¿Qué hace este código?

**TODO en un solo ESP32:**
- ✅ WiFi + HTTP calls al API
- ✅ Control de servo motor
- ✅ Control de buzzer
- ✅ LEDs indicadores
- ✅ Botones

**NO necesitas Arduino Mega** - Solo ESP32!

---

## 🔌 Conexiones

```
Servo Motor:
  Señal (naranja) → GPIO18
  VCC (rojo) → 5V
  GND (negro) → GND

Buzzer:
  Positivo → GPIO19
  Negativo → GND

Botón Dispensar:
  → GPIO0 (botón BOOT del ESP32)
  O conecta a cualquier GPIO con INPUT_PULLUP

Botón Cancelar (opcional):
  → GPIO15
```

---

## ⚙️ Configuración

1. Abre `esp32_all_in_one.ino` en Arduino IDE

2. **CAMBIAR** estas líneas (al inicio del archivo):
   ```cpp
   const char* ssid = "TU_WIFI_SSID";       // Tu WiFi
   const char* password = "TU_WIFI_PASS";   // Tu contraseña
   const char* apiBaseUrl = "http://192.168.1.X:3000/api"; // IP de tu PC
   ```

3. Para encontrar IP de tu PC:
   - **Mac**: `ifconfig` → busca `inet`
   - **Windows**: `ipconfig` → busca `IPv4`
   - **Linux**: `ip addr` → busca `inet`

---

## 📤 Subir Código

1. `Tools → Board → ESP32 Dev Module`
2. `Tools → Port → [tu puerto ESP32]`
3. Click botón "Upload" (→)
4. Abre Serial Monitor (115200 baud)

---

## 🧪 Probar

1. **Conecta servo y buzzer** según conexiones arriba
2. **Sube el código** al ESP32
3. **Abre Serial Monitor** - Deberías ver:
   ```
   WiFi conectado!
   IP: 192.168.1.X
   Sistema listo. Presiona botón para dispensar.
   ```
4. **Desde mobile app**: Toma foto de cédula → Crea sesión
5. **Presiona botón BOOT** del ESP32
6. **ESP32 consulta API** cada 2 segundos
7. **Si hay sesión** → Servo se mueve automáticamente ✅

---

## 🎛️ Cambiar Pines

Si necesitas usar otros GPIOs, cambia estas líneas:

```cpp
#define SERVO_PIN 18      // Cambia a otro GPIO
#define BUZZER_PIN 19     // Cambia a otro GPIO
#define LED_GREEN 2       // Cambia a otro GPIO
#define BTN_DISPENSE 0    // Cambia a otro GPIO
```

**Nota:** Algunos GPIOs tienen restricciones:
- GPIO0: Usado para botón BOOT (puede usarse pero cuidado)
- GPIO1, GPIO3: Serial (no usar)
- GPIO6-11: Flash (no usar)
- GPIO34-39: Solo entrada (no PWM para servo)

**GPIOs seguros para servo:** 2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33

---

## 🐛 Troubleshooting

### WiFi no conecta
- Verificar SSID y password (case-sensitive)
- WiFi debe ser 2.4GHz (ESP32 no soporta 5GHz)
- Acercarse al router

### API no responde
- Verificar que API esté corriendo (`cd api && npm start`)
- Verificar IP del servidor (puede cambiar)
- Hacer ping: `ping 192.168.1.X`

### Servo no se mueve
- Verificar conexión (señal, 5V, GND)
- Verificar que GPIO18 esté correcto
- Probar con otro GPIO

### Botón no funciona
- GPIO0 (BOOT) funciona pero puede ser sensible
- Usar otro GPIO y cambiar `BTN_DISPENSE`
- Verificar que sea `INPUT_PULLUP`

---

## 💡 Ventajas vs Arduino Mega + ESP32

- ✅ **Más barato**: Solo $5-7 vs $30-40
- ✅ **Más simple**: 1 componente vs 2
- ✅ **Menos cables**: No hay comunicación Serial
- ✅ **Menos puntos de falla**: Todo en un chip
- ✅ **Más rápido**: Sin latencia Serial

---

## 📝 Notas

- Servo consume corriente → Usar fuente externa 5V 2A mínimo
- LEDs son opcionales → Puedes quitar si no los necesitas
- Buzzer es opcional → Puedes comentar las funciones `tone()`
- El código usa el LED integrado del ESP32 (GPIO2) como LED verde

---

**¡Listo! Solo necesitas ESP32 + servo + buzzer = Sistema completo** 🚀

