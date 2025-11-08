# Dispensador Inteligente de Medicamentos

## Objetivo

Desarrollar un dispensador automático de medicamentos controlado por Arduino que garantice la dispensación segura y trazable de medicamentos mediante dos métodos de autenticación:

1. **Código QR**: Capturado desde el smartphone del usuario
2. **Cédula de Ciudadanía**: Capturada desde el smartphone del usuario mediante reconocimiento óptico

El sistema integra validación en tiempo real con un API backend que verifica:
- Identidad del paciente
- Prescripción médica válida
- Límite de dosis diarias para prevenir sobredosis
- Registro completo de dispensaciones

**Arquitectura actualizada**: El usuario captura la imagen desde su smartphone mediante una aplicación web progresiva (PWA), eliminando la necesidad del ESP32-CAM. Esta solución es más económica y ofrece mejor calidad de imagen.

---

## Características Principales

- Autenticación dual: QR o cédula física
- Captura de imágenes desde smartphone del usuario
- Procesamiento de imágenes en servidor (API)
- Sistema de sesiones temporales para autorización
- Control de acceso por prescripción médica
- Prevención de sobredosis con límite de dosis
- Trazabilidad completa de dispensaciones
- Interfaz visual con LCD
- Alertas sonoras y visuales
- Conectividad WiFi
- Aplicación web progresiva (PWA) para móviles

---

## Materiales Necesarios

### Hardware Principal

| Componente | Modelo Recomendado | Cantidad | Propósito |
|------------|-------------------|----------|-----------|
| **Microcontrolador** | Arduino Mega 2560 | 1 | Cerebro del sistema (más pines para expansión) |
| **Módulo WiFi** | ESP32 DevKit | 1 | Comunicación con API backend |
| **Smartphone** | Cualquier smartphone con cámara | 1 | Captura de QR y cédulas (usuario) |
| **Servo Motor** | SG90 o MG996R | 1 | Mecanismo de dispensación |
| **Display LCD** | LCD 16x2 I2C | 1 | Interfaz de usuario |
| **Buzzer** | Buzzer activo 5V | 1 | Alertas sonoras |
| **LEDs** | LED 5mm (verde, rojo, amarillo) | 3 | Indicadores de estado |
| **Botones** | Pulsador táctil | 2 | Iniciar dispensación y cancelar |
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
│                   SMARTPHONE DEL USUARIO                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Aplicación Web (PWA)                           │ │
│  │  • Captura QR o Cédula con cámara                     │ │
│  │  • Envía imagen al API                                 │ │
│  │  • Muestra confirmación al usuario                     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────┬───────────────────────────────────────────────────┘
          │ WiFi/4G (HTTP/HTTPS)
          ▼
┌─────────────────────────────────────────────────────────────┐
│                      API BACKEND                             │
│                   (Node.js + Express)                        │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Endpoints:                                            │ │
│  │  • POST /api/request-dispense   (Crea sesión 90s)    │ │
│  │  • GET  /api/check-pending      (Consulta sesiones)  │ │
│  │  • POST /api/confirm-dispense   (Confirma)           │ │
│  │  • GET  /api/session/:id        (Estado sesión)      │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Servicios:                                            │ │
│  │  • OCR (Tesseract.js)                                 │ │
│  │  • QR Decoder (jsQR)                                  │ │
│  │  • Validación de prescripciones                       │ │
│  │  • Gestión de sesiones temporales                     │ │
│  │  • Control de dosis                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
│                            ▼                                 │
│                   ┌──────────────┐                          │
│                   │   Database   │                          │
│                   │  (MongoDB)   │                          │
│                   └──────────────┘                          │
└─────────┬───────────────────────────────────────────────────┘
          │ WiFi (HTTP)
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    DISPENSADOR FÍSICO                        │
│  ┌──────────────┐         ┌─────────────┐                   │
│  │     ESP32    │────────▶│   Arduino   │                   │
│  │  (WiFi/HTTP) │  Serial │    Mega     │                   │
│  └──────────────┘         │  (Control)  │                   │
│                           └─────────────┘                   │
│                                  │                           │
│                                  ├──────▶ Servo Motor       │
│                                  ├──────▶ LCD 16x2          │
│                                  ├──────▶ LEDs/Buzzer       │
│                                  └──────▶ Botones           │
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
│   ├── esp32_regular/
│   │   └── esp32_regular.ino         # Código ESP32 (sin cámara)
│   ├── esp32_cam/                    # [DEPRECADO - ver nota]
│   │   └── esp32_cam.ino             # Código ESP32-CAM (referencia)
│   ├── wiring_diagram.png            # Diagrama de conexiones
│   └── components_list.md            # Lista detallada de componentes
├── api/
│   ├── package.json
│   ├── server.js                     # Servidor Express
│   ├── routes/
│   │   ├── validation.routes.js     # Rutas de validación
│   │   ├── dispense.routes.js       # Rutas de dispensación
│   │   └── session.routes.js        # Rutas de sesiones (NUEVO)
│   ├── services/
│   │   ├── qr.service.js            # Procesamiento QR
│   │   ├── ocr.service.js           # OCR para cédulas
│   │   └── prescription.service.js   # Validación prescripciones
│   ├── models/
│   │   ├── Patient.js               # Modelo de paciente
│   │   ├── Prescription.js          # Modelo de prescripción
│   │   ├── Dispense.js              # Modelo de dispensación
│   │   └── DispenseSession.js       # Modelo de sesiones (NUEVO)
│   └── config/
│       └── database.js              # Configuración DB
├── mobile-app/
│   ├── dispenser-client.html        # App web móvil (PWA) (NUEVO)
│   ├── manifest.json                # Configuración PWA (NUEVO)
│   ├── service-worker.js            # Service worker (NUEVO)
│   └── qr-generator.html            # Ejemplo generador QR
└── docs/
    ├── API.md                       # Documentación del API
    ├── INSTALLATION.md              # Guía de instalación
    └── ASSEMBLY.md                  # Guía de ensamblaje
```

---

## Flujo de Operación

### Flujo General (Nueva Arquitectura)

1. Paciente abre la aplicación web en su smartphone
2. Selecciona método de autenticación (QR o Cédula)
3. Captura imagen con la cámara de su smartphone
4. La app envía imagen al API para validación
5. API procesa imagen, valida identidad y prescripción
6. Si autorizado: API crea sesión temporal de 90 segundos
7. App muestra confirmación: "Presiona el botón del dispensador"
8. Paciente presiona botón en el dispensador físico
9. Arduino solicita al ESP32 verificar sesiones pendientes
10. ESP32 consulta al API cada 2 segundos
11. API responde con la sesión pendiente
12. ESP32 envía datos al Arduino (paciente, medicamento)
13. Arduino muestra información en LCD
14. Servo dispensa medicamento, LED verde
15. Arduino confirma dispensación al servidor
16. API registra la dispensación y marca sesión como completada

### Opción 1: Validación con QR

1. En la app móvil, seleccionar "Código QR"
2. Mostrar código QR generado previamente
3. Capturar foto del código QR con la cámara
4. App valida y crea sesión de 90 segundos
5. Presionar botón en dispensador para recibir medicamento

### Opción 2: Validación con Cédula

1. En la app móvil, seleccionar "Cédula"
2. Colocar cédula en superficie plana con buena iluminación
3. Capturar foto de la cédula con la cámara
4. App procesa con OCR y crea sesión de 90 segundos
5. Presionar botón en dispensador para recibir medicamento

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

### 4. Cargar Código en Microcontroladores
```bash
# Abrir hardware/arduino_main/arduino_main.ino en Arduino IDE
# Cargar en Arduino Mega 2560

# Abrir hardware/esp32_regular/esp32_regular.ino en Arduino IDE
# Configurar WiFi SSID y password
# Configurar URL del API
# Cargar en ESP32 DevKit
```

### 5. Iniciar API
```bash
cd api
npm start
```

### 6. Acceder a la Aplicación Móvil
```bash
# Abrir en el navegador del smartphone:
http://IP_DEL_SERVIDOR:3000/dispenser-client.html

# O configurar un servidor web (nginx/apache) para servir mobile-app/
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

## Estado del Proyecto

1. ✅ Documentación inicial
2. ✅ API backend implementado
3. ✅ Código Arduino desarrollado
4. ✅ Código ESP32 desarrollado
5. ✅ Aplicación web móvil (PWA)
6. ✅ Sistema de sesiones temporales
7. ⬜ Crear esquemático de conexiones
8. ⬜ Diseñar carcasa 3D
9. ⬜ Pruebas de integración completas
10. ⬜ Documentación de API completa

## Notas Importantes

### Cambios de Arquitectura

**Versión anterior (con ESP32-CAM)**:
- Requería ESP32-CAM (~$10-12 USD)
- Captura de imágenes en el dispensador
- Complejidad adicional de hardware

**Versión actual (sin ESP32-CAM)**:
- Usa ESP32 regular (~$5-7 USD) - Más económico
- Usuario captura desde su smartphone (mejor calidad)
- Hardware más simple
- Mismo nivel de seguridad
- Mejor experiencia de usuario

Los archivos de la versión anterior se mantienen en `hardware/esp32_cam/` como referencia.

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
