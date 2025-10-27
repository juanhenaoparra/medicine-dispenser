# Dispensador Inteligente de Medicamentos

## Objetivo

Desarrollar un dispensador automático de medicamentos controlado por Arduino que garantice la dispensación segura y trazable de medicamentos mediante dos métodos de autenticación:

1. **Código QR**: Escaneado desde un dispositivo móvil mediante cámara
2. **Cédula de Ciudadanía**: Lectura y validación de cédula colombiana mediante reconocimiento óptico

El sistema integra validación en tiempo real con un API backend que verifica:
- Identidad del paciente
- Prescripción médica válida
- Límite de dosis diarias para prevenir sobredosis
- Registro completo de dispensaciones

---

## Características Principales

- Autenticación dual: QR o cédula física
- Procesamiento de imágenes en servidor (API)
- Control de acceso por prescripción médica
- Prevención de sobredosis con límite de dosis
- Trazabilidad completa de dispensaciones
- Interfaz visual con LCD
- Alertas sonoras y visuales
- Conectividad WiFi

---

## Materiales Necesarios

### Hardware Principal

| Componente | Modelo Recomendado | Cantidad | Propósito |
|------------|-------------------|----------|-----------|
| **Microcontrolador** | Arduino Mega 2560 | 1 | Cerebro del sistema (más pines para expansión) |
| **Cámara** | ESP32-CAM (AI-Thinker) | 1 | Captura QR y cédulas, envío a API |
| **Módulo WiFi** | Integrado en ESP32-CAM | - | Comunicación con API backend |
| **Servo Motor** | SG90 o MG996R | 1 | Mecanismo de dispensación |
| **Display LCD** | LCD 16x2 I2C | 1 | Interfaz de usuario |
| **Buzzer** | Buzzer activo 5V | 1 | Alertas sonoras |
| **LEDs** | LED 5mm (verde, rojo, amarillo) | 3 | Indicadores de estado |
| **Botones** | Pulsador táctil | 2 | Selección de método y confirmación |
| **Resistencias** | 220Ω, 10kΩ | 5 | Pull-down y limitadoras de corriente |
| **Fuente de Alimentación** | 5V 3A | 1 | Alimentación del sistema |
| **Protoboard** | 830 puntos | 1 | Prototipado inicial |
| **Cables Dupont** | Macho-Macho, Macho-Hembra | 30+ | Conexiones |

### Estructura Física

| Material | Especificación | Propósito |
|----------|---------------|-----------|
| **Acrílico** | 3mm transparente y opaco | Carcasa del dispensador |
| **Compartimento** | Contenedor plástico pequeño | Almacenamiento de medicamentos |
| **Tornillos y soportes** | M3 x 10mm | Ensamblaje |

### Opcionales para Producción

- **Impresión 3D**: Diseño personalizado de carcasa
- **Fuente regulada**: Convertidor DC-DC para estabilidad
- **Módulo RTC**: DS3231 para timestamp preciso sin internet
- **Sensor de presencia**: HC-SR04 o PIR para detección de usuario

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    DISPENSADOR FÍSICO                        │
│  ┌──────────────┐         ┌─────────────┐                   │
│  │  ESP32-CAM   │────────▶│   Arduino   │                   │
│  │  (Captura)   │         │    Mega     │                   │
│  └──────────────┘         │  (Control)  │                   │
│         │                 └─────────────┘                   │
│         │                        │                           │
│         │                        ├──────▶ Servo Motor       │
│         │                        ├──────▶ LCD 16x2          │
│         │                        ├──────▶ LEDs/Buzzer       │
│         │                        └──────▶ Botones           │
└─────────┼─────────────────────────────────────────────────┘
          │
          │ WiFi (HTTP/HTTPS)
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                      API BACKEND                             │
│                   (Node.js + Express)                        │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Endpoints:                                            │ │
│  │  • POST /api/validate-qr       (Imagen QR)           │ │
│  │  • POST /api/validate-cedula   (Imagen cédula)       │ │
│  │  • POST /api/dispense          (Registro)            │ │
│  │  • GET  /api/patient/:id       (Info paciente)       │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Servicios:                                            │ │
│  │  • OCR (Tesseract.js / Cloud Vision API)             │ │
│  │  • QR Decoder (jsQR / OpenCV)                        │ │
│  │  • Validación de prescripciones                       │ │
│  │  • Control de dosis                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│                            ▼                                 │
│                   ┌──────────────┐                          │
│                   │   Database   │                          │
│                   │  (MongoDB)   │                          │
│                   └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Estructura del Proyecto

```
automatizacion/
├── README.md                          # Este archivo
├── hardware/
│   ├── arduino_main/
│   │   └── arduino_main.ino          # Código principal Arduino Mega
│   ├── esp32_cam/
│   │   └── esp32_cam.ino             # Código ESP32-CAM
│   ├── wiring_diagram.png            # Diagrama de conexiones
│   └── components_list.md            # Lista detallada de componentes
├── api/
│   ├── package.json
│   ├── server.js                     # Servidor Express
│   ├── routes/
│   │   ├── validation.routes.js     # Rutas de validación
│   │   └── dispense.routes.js       # Rutas de dispensación
│   ├── services/
│   │   ├── qr.service.js            # Procesamiento QR
│   │   ├── ocr.service.js           # OCR para cédulas
│   │   └── prescription.service.js   # Validación prescripciones
│   ├── models/
│   │   ├── Patient.js               # Modelo de paciente
│   │   ├── Prescription.js          # Modelo de prescripción
│   │   └── Dispense.js              # Modelo de dispensación
│   └── config/
│       └── database.js              # Configuración DB
├── mobile-example/
│   └── qr-generator.html            # Ejemplo generador QR
└── docs/
    ├── API.md                       # Documentación del API
    ├── INSTALLATION.md              # Guía de instalación
    └── ASSEMBLY.md                  # Guía de ensamblaje
```

---

## Flujo de Operación

### Opción 1: Validación con QR

1. Paciente abre aplicación móvil y genera código QR con su ID
2. Paciente presiona botón "QR" en el dispensador
3. LCD muestra: "Muestre el código QR"
4. ESP32-CAM captura imagen del código QR
5. Arduino envía imagen al API via WiFi
6. API procesa QR, valida identidad y prescripción
7. API responde: AUTORIZADO o DENEGADO
8. Si autorizado: servo dispensa medicamento, LED verde
9. Si denegado: LED rojo, buzzer, LCD muestra razón
10. API registra la dispensación

### Opción 2: Validación con Cédula

1. Paciente presiona botón "Cédula" en el dispensador
2. LCD muestra: "Muestre su cédula"
3. ESP32-CAM captura imagen de la cédula
4. Arduino envía imagen al API
5. API procesa imagen con OCR, extrae número de cédula
6. API valida identidad y prescripción
7. API responde: AUTORIZADO o DENEGADO
8. Proceso de dispensación igual que opción QR

---

## Tecnologías Utilizadas

### Hardware
- **Arduino IDE**: Programación de microcontroladores
- **C/C++**: Lenguaje para Arduino

### Backend
- **Node.js**: Runtime de JavaScript
- **Express.js**: Framework web
- **MongoDB**: Base de datos NoSQL
- **Mongoose**: ODM para MongoDB

### Procesamiento de Imágenes
- **jsQR**: Decodificación de códigos QR
- **Tesseract.js**: OCR para lectura de cédulas
- **Sharp**: Procesamiento de imágenes
- **OpenCV (opcional)**: Procesamiento avanzado

### Librerías Arduino
- `WiFi.h` o `ESP8266WiFi.h`: Conectividad WiFi
- `HTTPClient.h`: Cliente HTTP
- `LiquidCrystal_I2C.h`: Control de LCD
- `Servo.h`: Control de servo motor
- `ArduinoJson.h`: Manejo de JSON
- `esp_camera.h`: Control de ESP32-CAM

---

## Instalación Rápida

### 1. Configurar Hardware
```bash
# Ver guía detallada en docs/ASSEMBLY.md
```

### 2. Instalar Dependencias del API
```bash
cd api
npm install
```

### 3. Configurar Variables de Entorno
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

### 4. Cargar Código en Arduino
```bash
# Abrir hardware/arduino_main/arduino_main.ino
# Configurar WiFi SSID y password
# Cargar en Arduino Mega

# Abrir hardware/esp32_cam/esp32_cam.ino
# Cargar en ESP32-CAM
```

### 5. Iniciar API
```bash
cd api
npm start
```

---

## Seguridad y Consideraciones

### Seguridad
- Comunicación HTTPS con el API
- Autenticación JWT para endpoints sensibles
- Encriptación de datos de pacientes
- Logs de auditoría de todas las dispensaciones
- Límite de intentos fallidos

### Consideraciones Médicas
- Este es un prototipo educativo
- Requiere aprobación regulatoria para uso médico real
- Debe cumplir normativas de dispositivos médicos (INVIMA en Colombia)
- Se recomienda supervisión de personal médico

### Mantenimiento
- Limpieza regular del compartimento
- Verificación de calibración del servo
- Limpieza de lente de cámara
- Actualización de firmware y API
- Respaldo regular de base de datos

---

## Próximos Pasos

1. ✅ Documentación inicial
2. ⬜ Implementar API backend
3. ⬜ Desarrollar código Arduino
4. ⬜ Crear esquemático de conexiones
5. ⬜ Diseñar carcasa 3D
6. ⬜ Pruebas de integración
7. ⬜ Documentación de API completa

---

## Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

---

## Licencia

Este proyecto es de código abierto bajo licencia MIT.

---

## Autor

Juan Henao Parra

---

## Soporte

Para preguntas o problemas, por favor abre un issue en el repositorio.
