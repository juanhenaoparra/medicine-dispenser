# Guía de Instalación

Instrucciones detalladas para configurar el Dispensador Inteligente de Medicamentos.

---

## Requisitos Previos

### Software

- **Node.js**: v18.0.0 o superior
- **MongoDB**: v5.0 o superior
- **Arduino IDE**: v2.0 o superior
- **Git**: Para clonar el repositorio

### Conocimientos

- Programación básica en C/C++ (Arduino)
- Programación básica en JavaScript (Node.js)
- Uso de terminal/línea de comandos
- Conexiones electrónicas básicas

---

## Parte 1: Instalación del Backend (API)

### 1.1 Instalar MongoDB

#### En Ubuntu/Debian:
```bash
# Importar clave pública
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Añadir repositorio
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Actualizar e instalar
sudo apt-get update
sudo apt-get install -y mongodb-org

# Iniciar servicio
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### En macOS:
```bash
# Usando Homebrew
brew tap mongodb/brew
brew install mongodb-community@6.0

# Iniciar servicio
brew services start mongodb-community@6.0
```

#### En Windows:
1. Descargar MongoDB Community Server desde [mongodb.com](https://www.mongodb.com/try/download/community)
2. Ejecutar el instalador
3. Seleccionar "Complete" installation
4. Instalar como servicio de Windows

#### Verificar instalación:
```bash
mongosh
# Debe abrir la shell de MongoDB
```

### 1.2 Configurar el Proyecto

```bash
# Navegar a la carpeta del API
cd api

# Instalar dependencias
npm install

# Crear archivo de configuración
cp .env.example .env

# Editar configuración
nano .env
```

### 1.3 Configurar Variables de Entorno

Edita el archivo `.env`:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/medicine-dispenser
JWT_SECRET=tu_clave_secreta_muy_segura_aqui
MAX_IMAGE_SIZE=5
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CEDULA_MIN_LENGTH=6
CEDULA_MAX_LENGTH=10
MAX_DAILY_DOSES=3
DISPENSE_COOLDOWN_MINUTES=30
```

**IMPORTANTE:** Cambia `JWT_SECRET` por una clave segura aleatoria.

### 1.4 Poblar Base de Datos (Datos de Prueba)

Crea un archivo `seed.js` para datos de prueba:

```bash
node seed.js
```

O usa MongoDB Compass para insertar datos manualmente.

### 1.5 Iniciar el Servidor

#### Modo desarrollo (con auto-reload):
```bash
npm run dev
```

#### Modo producción:
```bash
npm start
```

**Verificar:**
Abre en el navegador: `http://localhost:3000/health`

Debes ver:
```json
{
  "status": "ok",
  "message": "Medicine Dispenser API is running"
}
```

---

## Parte 2: Configuración del Hardware

### 2.1 Instalar Arduino IDE

1. Descargar desde [arduino.cc](https://www.arduino.cc/en/software)
2. Instalar la aplicación
3. Abrir Arduino IDE

### 2.2 Configurar Placa Arduino Mega

1. Conectar Arduino Mega por USB
2. En Arduino IDE:
   - **Tools → Board → Arduino AVR Boards → Arduino Mega 2560**
   - **Tools → Port → [Seleccionar puerto COM/ttyUSB]**

### 2.3 Instalar Librerías Arduino

En Arduino IDE:
1. **Sketch → Include Library → Manage Libraries**
2. Buscar e instalar:
   - `LiquidCrystal I2C` (por Frank de Brabander)
   - `Servo` (incluida por defecto)

### 2.4 Configurar ESP32-CAM

#### Instalar soporte ESP32:
1. **File → Preferences**
2. En "Additional Board Manager URLs", añadir:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. **Tools → Board → Boards Manager**
4. Buscar "esp32" e instalar "ESP32 by Espressif Systems"

#### Instalar librerías ESP32-CAM:
1. **Sketch → Include Library → Manage Libraries**
2. Buscar e instalar:
   - `base64` (por Densaugeo)

**NOTA:** Las librerías `esp_camera`, `WiFi` y `HTTPClient` están incluidas con ESP32.

### 2.5 Cargar Código en Arduino Mega

1. Abrir `hardware/arduino_main/arduino_main.ino`
2. No requiere configuración adicional (usa Serial3 para ESP32)
3. **Sketch → Upload**
4. Esperar a que compile y cargue

### 2.6 Cargar Código en ESP32-CAM

**IMPORTANTE:** ESP32-CAM no tiene USB integrado, necesitas programador FTDI.

#### Conexiones para programación:
```
FTDI → ESP32-CAM
5V   → 5V
GND  → GND
TX   → RX (GPIO3)
RX   → TX (GPIO1)

Para entrar en modo programación:
GPIO0 → GND (conectar antes de encender)
```

#### Configurar código:
1. Abrir `hardware/esp32_cam/esp32_cam.ino`
2. Editar credenciales WiFi:
   ```cpp
   const char* ssid = "TU_WIFI_SSID";
   const char* password = "TU_WIFI_PASSWORD";
   ```
3. Editar URL del API:
   ```cpp
   const char* apiBaseUrl = "http://192.168.1.100:3000/api";
   ```
   Reemplazar `192.168.1.100` con la IP de tu servidor.

#### Cargar código:
1. Conectar GPIO0 a GND
2. Conectar FTDI a USB
3. **Tools → Board → ESP32 Arduino → AI Thinker ESP32-CAM**
4. **Tools → Port → [Seleccionar puerto]**
5. **Sketch → Upload**
6. Esperar a que compile y cargue
7. **DESCONECTAR GPIO0 de GND**
8. Presionar botón RESET en ESP32-CAM

#### Verificar:
1. Abrir Serial Monitor (115200 baud)
2. Debe aparecer: `WIFI_CONNECTED`

---

## Parte 3: Ensamblaje del Hardware

### 3.1 Diagrama de Conexiones

Ver archivo `hardware/wiring_diagram.png` (próximamente).

### 3.2 Conexiones Principales

#### Arduino Mega ↔ Componentes:

**LCD I2C:**
- VCC → 5V
- GND → GND
- SDA → Pin 20 (SDA)
- SCL → Pin 21 (SCL)

**Servo Motor:**
- Rojo (VCC) → 5V
- Negro/Marrón (GND) → GND
- Naranja/Amarillo (Signal) → Pin 9

**LEDs:**
- LED Verde:
  - Ánodo (+) → Pin 13
  - Cátodo (-) → Resistencia 220Ω → GND
- LED Amarillo:
  - Ánodo (+) → Pin 12
  - Cátodo (-) → Resistencia 220Ω → GND
- LED Rojo:
  - Ánodo (+) → Pin 11
  - Cátodo (-) → Resistencia 220Ω → GND

**Buzzer:**
- Positivo → Pin 10
- Negativo → GND

**Botones:**
- Botón 1 (QR):
  - Un terminal → Pin 7
  - Otro terminal → GND
  - Pin 7 → Resistencia 10kΩ → GND (pull-down)
- Botón 2 (Cédula):
  - Un terminal → Pin 6
  - Otro terminal → GND
  - Pin 6 → Resistencia 10kΩ → GND (pull-down)

#### Arduino Mega ↔ ESP32-CAM (Serial):
- TX3 (Pin 14) → RX (GPIO3) ESP32
- RX3 (Pin 15) → TX (GPIO1) ESP32
- GND → GND
- 5V → 5V

**NOTA:** Asegúrate de que ESP32-CAM reciba al menos 5V 2A.

### 3.3 Verificar Conexiones

1. Verificar continuidad con multímetro
2. Verificar que no haya cortocircuitos
3. Verificar polaridad de componentes
4. Verificar que servomotor pueda girar libremente

---

## Parte 4: Pruebas

### 4.1 Prueba del API

#### Crear paciente de prueba:

Usando MongoDB Compass o mongo shell:

```javascript
// Paciente
db.patients.insertOne({
  cedula: "1234567890",
  firstName: "Juan",
  lastName: "Perez",
  email: "juan@example.com",
  phone: "3001234567",
  qrCode: "abc123xyz456",
  active: true,
  registeredAt: new Date()
});

// Prescripción
db.prescriptions.insertOne({
  patient: ObjectId("..."), // ID del paciente creado
  medicineName: "Aspirina",
  medicineCode: "ASP-500",
  dosage: {
    amount: 500,
    unit: "mg"
  },
  frequency: {
    times: 3,
    period: "diario"
  },
  maxDailyDoses: 3,
  doctor: {
    name: "Dr. Carlos Rodriguez",
    license: "12345678",
    specialty: "Medicina General"
  },
  startDate: new Date(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
  status: "activa"
});
```

#### Probar endpoints (en modo desarrollo):

```bash
# Probar validación por cédula
curl http://localhost:3000/api/test-cedula/1234567890

# Probar validación por QR
curl http://localhost:3000/api/test-qr/abc123xyz456
```

Debe responder con `"authorized": true`.

### 4.2 Prueba del Hardware

1. **Encender sistema**
   - LCD debe mostrar mensaje de bienvenida
   - LEDs deben estar apagados
   - Después debe mostrar: "Seleccione modo"

2. **Probar botón QR**
   - Presionar botón QR
   - LED amarillo debe encenderse
   - LCD: "Muestre codigo QR al lector"
   - ESP32 debe enviar request al API

3. **Probar botón Cédula**
   - Presionar botón Cédula
   - LED amarillo debe encenderse
   - LCD: "Muestre cedula al lector"
   - ESP32 debe enviar request al API

4. **Probar dispensación**
   - Usar QR Generator (ver `mobile-example/qr-generator.html`)
   - Generar QR con código `abc123xyz456`
   - Mostrar al ESP32-CAM
   - Debe autorizar y dispensar

### 4.3 Prueba de QR Generator

1. Abrir `mobile-example/qr-generator.html` en navegador móvil
2. Ingresar código: `abc123xyz456`
3. Generar QR
4. Mostrar al dispensador

---

## Parte 5: Solución de Problemas

### API no inicia

**Error:** `Error connecting to MongoDB`
- **Solución:** Verificar que MongoDB esté corriendo: `sudo systemctl status mongod`

**Error:** `Port 3000 already in use`
- **Solución:** Cambiar puerto en `.env` o matar proceso: `lsof -ti:3000 | xargs kill`

### ESP32-CAM no conecta a WiFi

- Verificar SSID y contraseña
- Verificar que red sea 2.4GHz (ESP32 no soporta 5GHz)
- Verificar alcance de señal

### ESP32-CAM no carga código

- Verificar que GPIO0 esté conectado a GND al cargar
- Verificar conexiones FTDI (TX ↔ RX cruzados)
- Probar con velocidad de carga más baja: **Tools → Upload Speed → 115200**

### Arduino no se comunica con ESP32

- Verificar conexiones Serial (TX3 ↔ RX, RX3 ↔ TX)
- Verificar baud rate (debe ser 115200 en ambos)
- Verificar GND común

### Servo no funciona

- Verificar alimentación (servo consume mucha corriente)
- Usar fuente externa de 5V si es necesario
- Verificar señal PWM en pin 9

### LCD no muestra nada

- Verificar dirección I2C (puede ser 0x27 o 0x3F)
- Ajustar contraste con potenciómetro en módulo I2C
- Probar con scanner I2C para encontrar dirección

### Cámara no captura bien

- Limpiar lente
- Ajustar iluminación (usar flash LED)
- Ajustar enfoque girando lente suavemente
- Verificar calidad de imagen en Serial Monitor

---

## Parte 6: Puesta en Producción

### 6.1 Seguridad

1. **Cambiar credenciales:**
   - JWT_SECRET en `.env`
   - Contraseña de MongoDB

2. **Activar HTTPS:**
   - Obtener certificado SSL (Let's Encrypt)
   - Configurar Nginx como reverse proxy

3. **Firewall:**
   ```bash
   sudo ufw allow 3000/tcp
   sudo ufw allow 27017/tcp
   sudo ufw enable
   ```

### 6.2 Deployment

#### Usando PM2 (recomendado):

```bash
# Instalar PM2
npm install -g pm2

# Iniciar API
cd api
pm2 start server.js --name medicine-api

# Auto-start al reiniciar
pm2 startup
pm2 save
```

### 6.3 Monitoreo

```bash
# Ver logs
pm2 logs medicine-api

# Ver status
pm2 status

# Monitorear recursos
pm2 monit
```

---

## Recursos Adicionales

- [Documentación del API](./API.md)
- [README principal](../README.md)
- [Arduino Reference](https://www.arduino.cc/reference/en/)
- [ESP32 Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/)
- [MongoDB Manual](https://docs.mongodb.com/manual/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)

---

## Soporte

Si encuentras problemas, consulta:
- Issues en GitHub
- Documentación oficial de cada tecnología
- Foros de Arduino y ESP32
