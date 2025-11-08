# Lista Detallada de Componentes

## ⚠️ ACTUALIZACIÓN IMPORTANTE

**Arquitectura Modificada**: Esta lista refleja la nueva arquitectura **sin ESP32-CAM**. 
El usuario captura las imágenes desde su smartphone, lo que hace el sistema más económico y sencillo.

---

## Hardware Principal

### 1. Arduino Mega 2560
- **Función**: Controlador principal del sistema
- **Especificaciones**:
  - Microcontrolador: ATmega2560
  - 54 pines digitales I/O (15 PWM)
  - 16 entradas analógicas
  - Memoria Flash: 256 KB
  - SRAM: 8 KB
- **Voltaje**: 5V
- **Precio aproximado**: $25-35 USD
- **Dónde comprar**: Vistronica, ElectronicaEmbajadores (Colombia)

### 2. ESP32 DevKit (NodeMCU-32S o similar)
- **Función**: Comunicación WiFi con API backend
- **Especificaciones**:
  - Procesador: ESP32 Dual Core
  - WiFi: 802.11 b/g/n
  - Bluetooth: 4.2
  - Memoria: 4MB Flash
  - USB integrado (no necesita programador externo)
  - Múltiples GPIOs
- **Voltaje**: 5V (regulado internamente a 3.3V)
- **Precio aproximado**: $5-7 USD
- **Ventajas vs ESP32-CAM**:
  - Más económico
  - USB integrado (fácil programación)
  - No necesita cámara (usuario usa su smartphone)
- **Dónde comprar**: Vistronica, MercadoLibre Colombia

### 3. ~~ESP32-CAM (AI-Thinker)~~ [DEPRECADO]
- **Nota**: Ya no se necesita en la nueva arquitectura
- La captura de imágenes se realiza desde el smartphone del usuario
- Si ya tienes un ESP32-CAM, puedes usarlo sin la cámara conectada

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
  - Amarillo: Verificando sesión
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
  - Botón 1: Iniciar dispensación (después de capturar imagen en smartphone)
  - Botón 2: Cancelar verificación
- **Precio aproximado**: $0.20 cada uno

### 10. Smartphone con Cámara
- **Función**: Captura de imágenes (QR y cédulas)
- **Requisitos**:
  - Cámara funcional (cualquier resolución moderna)
  - Navegador web moderno (Chrome, Safari, Firefox)
  - Conexión a internet (WiFi o datos móviles)
- **Nota**: El usuario usa su propio smartphone, no requiere compra adicional

### 11. Fuente de Alimentación
- **Especificaciones**: 5V 3A (mínimo 2A)
- **Conector**: Barrel jack 5.5mm x 2.1mm
- **Precio aproximado**: $5-8 USD
- **Nota**: El ESP32 consume menos que el ESP32-CAM, por lo que 2A es suficiente

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

### Comparación de Costos

| Componente | Versión Anterior (ESP32-CAM) | Nueva Versión (ESP32 + Smartphone) |
|------------|------------------------------|-------------------------------------|
| Módulo WiFi/Cámara | ESP32-CAM: $10-12 | ESP32 DevKit: $5-7 |
| Programador FTDI | $3-5 | No necesario (USB integrado) |
| Smartphone | - | $0 (usuario lo tiene) |
| **Subtotal diferencia** | **$13-17** | **$5-7** |

### Presupuesto Total (Nueva Versión)

| Categoría | Precio (USD) |
|-----------|--------------|
| **Hardware electrónico** | $50-70 |
| **Cables y protoboard** | $10-15 |
| **Estructura física** | $15-20 |
| **Herramientas** (si no las tienes) | $30-50 |
| **Total básico** | **$75-105** |
| **Con opcionales** | **$90-130** |

**Ahorro estimado**: $10-15 USD vs versión con ESP32-CAM

*Precios en Colombia pueden variar. Recomendado comprar en: Vistronica, Sigma Electrónica, MercadoLibre*

---

## Notas de Compra

1. **Arduino Mega**: Asegúrate de que sea original o un clon de calidad (CH340 funciona bien)
2. **ESP32 DevKit**: Preferir modelos con USB-C o micro-USB integrado. Verificar que tenga WiFi funcional
3. **Servo**: Si el dispensador es pesado, usa MG996R en lugar de SG90
4. **Fuente**: No escatimar en la fuente, una mala puede dañar los componentes
5. **Cables**: Comprar cables Dupont de calidad, los muy baratos se desconectan fácilmente

## Ventajas de la Nueva Arquitectura

### ✅ Ventajas
- **Más económico**: Ahorro de $10-15 USD
- **Más simple**: Menos componentes que programar y conectar
- **Mejor calidad de imagen**: Cámaras de smartphones son superiores
- **Más fácil de programar**: ESP32 DevKit tiene USB integrado
- **Mayor flexibilidad**: Usuario puede estar en cualquier lugar con internet
- **PWA instalable**: App se puede instalar en el smartphone como nativa

### ⚠️ Consideraciones
- **Requiere smartphone**: Usuario debe tener un smartphone con cámara
- **Requiere internet**: Tanto smartphone como dispensador necesitan conexión
- **Dos pasos**: Usuario captura imagen Y presiona botón (vs un solo paso)

### 🔄 Migración desde ESP32-CAM
Si ya tienes un ESP32-CAM:
1. Puedes usarlo sin conectar la cámara
2. Solo carga el código de `esp32_regular.ino`
3. Funciona igual que un ESP32 DevKit normal

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
- Botón 1 (Dispensar): pin 7 + resistencia 10kΩ (pull-down)
- Botón 2 (Cancelar): pin 6 + resistencia 10kΩ (pull-down)

**Arduino Mega ↔ ESP32 DevKit (Comunicación Serial):**
- TX3 (pin 14) → RX (GPIO3 en ESP32)
- RX3 (pin 15) → TX (GPIO1 en ESP32)
- GND → GND
- 5V → VIN (el ESP32 tiene regulador interno a 3.3V)

**ESP32 DevKit:**
- No requiere configuración especial
- USB integrado para programación
- LED integrado en GPIO2 (indica estado WiFi)
- No requiere pines adicionales (no hay cámara)

**Alimentación:**
- Fuente 5V 3A → Arduino Vin
- Arduino 5V → Protoboard rail positivo
- Arduino GND → Protoboard rail negativo
