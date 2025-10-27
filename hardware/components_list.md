# Lista Detallada de Componentes

## Hardware Principal

### 1. Arduino Mega 2560
- **Función**: Controlador principal del sistema
- **Especificaciones**:
  - Microcontrolador: ATmega2560
  - 54 pines digitales I/O (15 PWM)
  - 16 entradas analógicas
  - Memoria Flash: 256 KB
  - SRAM: 8 KB
- **Precio aproximado**: $25-35 USD
- **Dónde comprar**: Vistronica, ElectronicaEmbajadores (Colombia)

### 2. ESP32-CAM (AI-Thinker)
- **Función**: Captura de imágenes (QR y cédulas), comunicación WiFi
- **Especificaciones**:
  - Procesador: ESP32-S Dual Core
  - Cámara: OV2640 (2MP)
  - WiFi: 802.11 b/g/n
  - Bluetooth: 4.2
  - Memoria: 4MB Flash
  - MicroSD slot
- **Voltaje**: 5V
- **Precio aproximado**: $8-12 USD
- **Nota**: Incluye módulo WiFi integrado

### 3. Programador FTDI para ESP32-CAM
- **Función**: Programar el ESP32-CAM (no tiene USB integrado)
- **Modelo**: FT232RL USB a TTL Serial
- **Precio aproximado**: $3-5 USD

### 4. Servo Motor
- **Opciones**:
  - **SG90**: Para cargas ligeras (<500g)
    - Torque: 1.8 kg/cm
    - Precio: $2-3 USD
  - **MG996R**: Para cargas más pesadas
    - Torque: 9.4 kg/cm (metal gear)
    - Precio: $5-8 USD
- **Voltaje**: 4.8-6V
- **Ángulo**: 180°

### 5. Display LCD 16x2 I2C
- **Función**: Mostrar mensajes al usuario
- **Especificaciones**:
  - 16 caracteres x 2 líneas
  - Backlight azul/verde
  - Interfaz I2C (solo 2 cables: SDA, SCL)
  - Controlador: PCF8574
- **Voltaje**: 5V
- **Precio aproximado**: $4-6 USD

### 6. Buzzer Activo 5V
- **Función**: Alertas sonoras
- **Tipo**: Activo (genera tono automáticamente)
- **Voltaje**: 5V
- **Frecuencia**: ~2300 Hz
- **Precio aproximado**: $0.50-1 USD

### 7. LEDs Indicadores
- **Cantidad**: 3 unidades
- **Colores**:
  - Verde: Dispensación exitosa
  - Rojo: Error/Denegado
  - Amarillo: Procesando
- **Especificaciones**: 5mm, 20mA
- **Precio aproximado**: $0.10 cada uno

### 8. Resistencias
| Valor | Cantidad | Propósito |
|-------|----------|-----------|
| 220Ω  | 3 | Limitadoras para LEDs |
| 10kΩ  | 2 | Pull-down para botones |

### 9. Botones Pulsadores
- **Cantidad**: 2
- **Tipo**: Pulsador táctil (Push button)
- **Función**:
  - Botón 1: Seleccionar método (QR/Cédula)
  - Botón 2: Confirmar/Cancelar
- **Precio aproximado**: $0.20 cada uno

### 10. Fuente de Alimentación
- **Especificaciones**: 5V 3A (mínimo 2A)
- **Conector**: Barrel jack 5.5mm x 2.1mm
- **Precio aproximado**: $5-8 USD

---

## Cables y Conectores

| Item | Cantidad | Precio Aprox. |
|------|----------|---------------|
| Cables Dupont Macho-Macho | 20 | $2 (pack) |
| Cables Dupont Macho-Hembra | 20 | $2 (pack) |
| Protoboard 830 puntos | 1 | $3-5 |
| Cable USB A-B (Arduino) | 1 | $2 |

---

## Estructura Física

### Opción 1: Acrílico
- **Material**: Acrílico 3mm
- **Colores**: Transparente para frente, negro/blanco para laterales
- **Piezas necesarias**:
  - Base: 20cm x 15cm
  - Frente: 20cm x 25cm (con ventana para cámara)
  - Laterales: 15cm x 25cm (x2)
  - Tapa: 20cm x 15cm
  - Compartimento interno: 8cm x 8cm x 10cm
- **Precio aproximado**: $15-20 USD (corte incluido)

### Opción 2: Impresión 3D
- **Material**: PLA o PETG
- **Peso estimado**: 300-400g
- **Tiempo de impresión**: 15-20 horas
- **Precio aproximado**: $8-12 USD (material)

---

## Componentes Opcionales

### 1. Módulo RTC DS3231
- **Función**: Reloj en tiempo real (timestamp sin internet)
- **Precio**: $2-3 USD

### 2. Sensor Ultrasónico HC-SR04
- **Función**: Detectar presencia del usuario
- **Precio**: $2 USD

### 3. Módulo MicroSD
- **Función**: Log local de dispensaciones (respaldo)
- **Precio**: $1-2 USD
- **Nota**: ESP32-CAM ya incluye slot MicroSD

### 4. Batería de Respaldo
- **Tipo**: UPS Shield para Arduino o batería LiPo 3.7V
- **Función**: Mantener funcionamiento en caso de corte de energía
- **Precio**: $10-15 USD

---

## Herramientas Necesarias

- Soldador de estaña (30W o más)
- Estaño con flux
- Alicate de corte
- Multímetro
- Destornilladores (Phillips y plano)
- Pistola de silicona caliente (para ensamblaje)
- Cautín para corte de acrílico (opcional)

---

## Presupuesto Total Estimado

| Categoría | Precio (USD) |
|-----------|--------------|
| **Hardware electrónico** | $60-85 |
| **Cables y protoboard** | $10-15 |
| **Estructura física** | $15-20 |
| **Herramientas** (si no las tienes) | $30-50 |
| **Total básico** | **$85-120** |
| **Con opcionales** | **$100-150** |

*Precios en Colombia pueden variar. Recomendado comprar en: Vistronica, Sigma Electrónica, MercadoLibre*

---

## Notas de Compra

1. **Arduino Mega**: Asegúrate de que sea original o un clon de calidad (CH340 funciona bien)
2. **ESP32-CAM**: Comprar con antena externa para mejor señal WiFi
3. **Servo**: Si el dispensador es pesado, usa MG996R en lugar de SG90
4. **Fuente**: No escatimar en la fuente, una mala puede dañar los componentes
5. **Cables**: Comprar cables Dupont de calidad, los muy baratos se desconectan fácilmente

---

## Distribuidores Recomendados en Colombia

- **Vistronica**: [www.vistronica.com](https://www.vistronica.com)
- **Sigma Electrónica**: Bogotá, Medellín
- **ElectronicaEmbajadores**: Bogotá
- **MercadoLibre Colombia**: Para componentes individuales
- **Amazon**: Para kits completos (envío internacional)

---

## Diagrama de Conexiones

Ver archivo `wiring_diagram.png` en este directorio para el esquemático completo.

### Resumen de Conexiones

**Arduino Mega ↔ Componentes:**
- LCD I2C: SDA (pin 20), SCL (pin 21)
- Servo: PWM (pin 9)
- LED Verde: pin 13 + resistencia 220Ω
- LED Amarillo: pin 12 + resistencia 220Ω
- LED Rojo: pin 11 + resistencia 220Ω
- Buzzer: pin 10
- Botón 1 (QR): pin 7 + resistencia 10kΩ (pull-down)
- Botón 2 (Cédula): pin 6 + resistencia 10kΩ (pull-down)

**Arduino Mega ↔ ESP32-CAM (Comunicación Serial):**
- TX3 (pin 14) → RX (ESP32)
- RX3 (pin 15) → TX (ESP32)
- GND → GND
- 5V → 5V

**ESP32-CAM:**
- GPIO 0 → GND (para programación, luego desconectar)
- Flash LED: GPIO 4 (integrado, para iluminación en captura)

**Alimentación:**
- Fuente 5V 3A → Arduino Vin
- Arduino 5V → Protoboard rail positivo
- Arduino GND → Protoboard rail negativo
