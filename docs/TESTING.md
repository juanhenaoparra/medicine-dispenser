# Guía de Pruebas - Dispensador Inteligente

Esta guía describe cómo probar el sistema completo después de implementar la nueva arquitectura sin ESP32-CAM.

---

## Prerrequisitos

Antes de comenzar las pruebas, asegúrate de tener:

### Software
- ✅ Node.js instalado (v14 o superior)
- ✅ MongoDB corriendo (local o remoto)
- ✅ Arduino IDE con librerías instaladas
- ✅ Navegador web moderno en smartphone

### Hardware
- ✅ Arduino Mega 2560 programado
- ✅ ESP32 DevKit programado
- ✅ Componentes conectados según diagrama
- ✅ Fuente de alimentación conectada
- ✅ Smartphone con cámara y conexión a internet

### Configuración
- ✅ API backend configurado y corriendo
- ✅ Variables de entorno configuradas
- ✅ Datos de prueba en base de datos
- ✅ WiFi configurado en ESP32

---

## Fase 1: Pruebas Unitarias del API

### 1.1 Verificar Health Check

```bash
curl http://localhost:3000/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "message": "Medicine Dispenser API is running",
  "timestamp": "2024-...",
  "uptime": 123.45
}
```

### 1.2 Probar Endpoint de Validación QR

```bash
# Crear un código QR de prueba
# (usar qr-generator.html o similar)

curl -X POST http://localhost:3000/api/request-dispense \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "method": "qr",
    "dispenserId": "dispenser-01"
  }'
```

**Respuesta esperada (autorizado):**
```json
{
  "success": true,
  "authorized": true,
  "sessionId": "sess_...",
  "expiresIn": 90,
  "patient": "Juan Pérez",
  "medicine": "Aspirina",
  "dosage": "500mg",
  "remaining": 2,
  "message": "Autorizado. Presiona el botón en el dispensador dentro de 90 segundos."
}
```

### 1.3 Probar Verificación de Sesiones Pendientes

```bash
curl http://localhost:3000/api/check-pending/dispenser-01
```

**Respuesta esperada (con sesión pendiente):**
```json
{
  "hasPending": true,
  "sessionId": "sess_...",
  "patient": "Juan Pérez",
  "medicine": "Aspirina",
  "dosage": "500mg",
  "timeRemaining": 85,
  "authMethod": "qr"
}
```

### 1.4 Probar Confirmación de Dispensación

```bash
curl -X POST http://localhost:3000/api/confirm-dispense/sess_... \
  -H "Content-Type: application/json" \
  -d '{
    "dispenserId": "dispenser-01",
    "timestamp": "2024-11-08T10:30:00Z"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Dispensación confirmada y registrada",
  "dispenseId": "...",
  "sessionId": "sess_..."
}
```

---

## Fase 2: Pruebas de Hardware

### 2.1 Verificar Arduino Mega

1. **Abrir Serial Monitor** (115200 baud)
2. **Observar mensajes de inicio:**
   ```
   Sistema Iniciando...
   Sistema listo
   Estado: IDLE
   ```

3. **Verificar LCD:**
   - Debe mostrar: "Capture imagen" / "Luego presione"

4. **Verificar LEDs:**
   - Todos deben estar apagados en estado IDLE

### 2.2 Verificar ESP32

1. **Abrir Serial Monitor** del ESP32 (115200 baud)
2. **Observar mensajes de inicio:**
   ```
   ESP32_READY
   STATUS:Connecting WiFi
   WIFI_CONNECTED
   IP:192.168.1.xxx
   ```

3. **Verificar LED integrado:**
   - Debe estar encendido (indica WiFi conectado)

### 2.3 Probar Comunicación Serial

1. **En Arduino, presionar Botón 1** (Dispensar)
2. **Arduino debe enviar a ESP32:** `CHECK_PENDING`
3. **LCD debe mostrar:** "Verificando..." / "Espere"
4. **LED amarillo debe encender**

---

## Fase 3: Pruebas de Aplicación Móvil

### 3.1 Acceder a la App

1. En el smartphone, abrir navegador
2. Ir a: `http://IP_DEL_SERVIDOR:3000/dispenser-client.html`
   - Reemplazar `IP_DEL_SERVIDOR` con la IP de tu servidor
3. **Verificar que carga correctamente:**
   - Título: "Dispensador Inteligente"
   - Dos botones: "Código QR" y "Cédula"

### 3.2 Probar Captura de QR

1. **Seleccionar "Código QR"**
2. **Permitir acceso a cámara** cuando se solicite
3. **Generar código QR de prueba:**
   - Usar qr-generator.html
   - Código de paciente válido (ej: "abc123xyz456")
4. **Apuntar cámara al código QR**
5. **Presionar "Capturar"**
6. **Verificar preview de imagen**
7. **Presionar "Enviar"**
8. **Verificar pantalla de éxito:**
   - "✅ ¡Autorizado!"
   - Nombre del paciente
   - Medicamento y dosis
   - Countdown de 90 segundos
   - Instrucción: "Ahora presiona el botón en el dispensador físico"

### 3.3 Probar Captura de Cédula

1. **Seleccionar "Cédula"**
2. **Colocar cédula en superficie plana bien iluminada**
3. **Capturar foto de la cédula**
4. **Verificar que el número sea legible en preview**
5. **Enviar imagen**
6. **Verificar respuesta del servidor**

---

## Fase 4: Prueba de Integración Completa

### 4.1 Flujo QR Completo

**Paso 1: Usuario captura QR en smartphone**
1. Abrir app móvil
2. Seleccionar "Código QR"
3. Capturar código QR válido
4. Enviar imagen
5. **Verificar:** Pantalla de éxito con countdown

**Paso 2: Usuario presiona botón en dispensador**
1. Ir al dispensador físico
2. Presionar Botón 1 (Dispensar)
3. **Verificar Arduino:**
   - LCD: "Verificando..." / "Espere"
   - LED amarillo encendido
   - Serial: "Estado: CHECKING"
4. **Verificar ESP32:**
   - Serial: "STATUS:Checking for pending session"
   - Hace requests HTTP al API cada 2 segundos

**Paso 3: Sistema encuentra sesión y autoriza**
1. **ESP32 recibe respuesta del API:**
   ```
   AUTHORIZED:sess_...:Juan Pérez:Aspirina:500mg
   ```
2. **Arduino recibe datos:**
   - Serial: "ESP32 response: AUTHORIZED:..."
3. **Arduino muestra información:**
   - LCD línea 1: "Juan Pérez"
   - LCD línea 2: "Aspirina"
   - Espera 2 segundos

**Paso 4: Dispensación**
1. **Arduino cambia a STATE_DISPENSING:**
   - LCD: "Dispensando" / "medicamento..."
   - LED verde encendido
   - Buzzer: sonido de éxito
2. **Servo motor se mueve:**
   - Abre a 90° (2 segundos)
   - Cierra a 0°
3. **Arduino confirma al servidor:**
   - Envía a ESP32: `CONFIRM:sess_...`
4. **ESP32 envía confirmación al API:**
   - POST a `/api/confirm-dispense/sess_...`
   - Recibe: `CONFIRM_OK`

**Paso 5: Finalización**
1. **Arduino muestra éxito:**
   - LCD: "Dispensacion" / "exitosa!"
   - LED verde por 3 segundos
2. **Vuelve a IDLE:**
   - LCD: "Capture imagen" / "Luego presione"
   - Todos los LEDs apagados
3. **App móvil detecta dispensación:**
   - Muestra: "✅ ¡Medicamento Dispensado!"
   - Botón "Finalizar"

### 4.2 Flujo Cédula Completo

Repetir el proceso anterior pero:
1. Usar "Cédula" en la app móvil
2. Capturar foto de cédula física
3. El resto del flujo es idéntico

---

## Fase 5: Pruebas de Casos Límite

### 5.1 Sesión Expirada

**Objetivo:** Verificar que sesiones expiran correctamente después de 90 segundos

1. Capturar imagen en app móvil
2. **NO presionar botón en dispensador**
3. Esperar 90+ segundos
4. Presionar botón en dispensador
5. **Verificar:**
   - Arduino: "Timeout - Sin sesion"
   - LED rojo encendido
   - Estado: ERROR

### 5.2 Sin Conexión WiFi

**Objetivo:** Verificar manejo de errores de conectividad

1. Desconectar WiFi del ESP32 (apagar router momentáneamente)
2. Intentar dispensación
3. **Verificar:**
   - ESP32: "WIFI_DISCONNECTED"
   - Arduino recibe mensaje
   - LCD: "Sin conexion WiFi"
   - LED rojo encendido

### 5.3 Paciente No Autorizado

**Objetivo:** Verificar rechazo de pacientes sin prescripción

1. Usar código QR de paciente sin prescripción válida
2. Capturar en app móvil
3. **Verificar:**
   - App muestra: "❌ Error"
   - Mensaje específico: "No prescription found" o similar
   - NO se crea sesión
   - Dispensador permanece en IDLE

### 5.4 Límite de Dosis Alcanzado

**Objetivo:** Verificar control de dosis diarias

1. Dispensar medicamento 3 veces para el mismo paciente
2. Intentar 4ta dispensación
3. **Verificar:**
   - App muestra: "Límite de dosis diarias alcanzado"
   - NO se crea sesión
   - Dispensador no dispensa

### 5.5 Imagen QR Ilegible

**Objetivo:** Verificar manejo de imágenes de mala calidad

1. Capturar imagen borrosa o mal enfocada
2. Enviar al servidor
3. **Verificar:**
   - App muestra: "No se pudo leer código QR"
   - Usuario puede reintentar
   - NO se crea sesión

### 5.6 Cancelación de Verificación

**Objetivo:** Verificar que usuario puede cancelar

1. Capturar imagen en app móvil (crear sesión)
2. Presionar Botón 1 en dispensador (inicia verificación)
3. Presionar Botón 2 (Cancelar)
4. **Verificar:**
   - ESP32 recibe: "STOP_CHECK"
   - Arduino vuelve a IDLE
   - LCD: "Capture imagen" / "Luego presione"
   - LED amarillo se apaga

---

## Fase 6: Pruebas de Rendimiento

### 6.1 Tiempo de Respuesta

**Objetivo:** Medir tiempos en el flujo completo

1. **Captura en app móvil:**
   - Tiempo: < 2 segundos (depende de conexión)
2. **Validación en API:**
   - Tiempo: < 3 segundos (QR), < 5 segundos (cédula)
3. **Consulta de sesión por ESP32:**
   - Tiempo: < 1 segundo por consulta
4. **Dispensación física:**
   - Tiempo: 2.5 segundos (servo + delays)
5. **Confirmación al servidor:**
   - Tiempo: < 1 segundo

**Tiempo total esperado:** 8-12 segundos desde captura hasta dispensación

### 6.2 Múltiples Sesiones Simultáneas

**Objetivo:** Verificar que solo una sesión activa por paciente

1. Crear sesión para Paciente A
2. Antes de que expire, crear otra sesión para Paciente A
3. **Verificar:**
   - Primera sesión se marca como "cancelled"
   - Solo la segunda sesión está "pending"
   - Dispensador obtiene la sesión más reciente

### 6.3 Stress Test del API

**Objetivo:** Verificar estabilidad bajo carga

```bash
# Usar herramienta como Apache Bench
ab -n 100 -c 10 http://localhost:3000/api/check-pending/dispenser-01
```

**Verificar:**
- Todas las requests completan exitosamente
- Tiempo de respuesta se mantiene < 500ms
- No hay memory leaks

---

## Fase 7: Checklist Final

### ✅ Backend
- [ ] API responde en `/health`
- [ ] Endpoint `/request-dispense` funciona con QR
- [ ] Endpoint `/request-dispense` funciona con cédula
- [ ] Endpoint `/check-pending` retorna sesiones correctamente
- [ ] Endpoint `/confirm-dispense` registra dispensaciones
- [ ] Sesiones expiran después de 90 segundos
- [ ] Rate limiting funciona
- [ ] Logs se guardan correctamente

### ✅ Aplicación Móvil
- [ ] App carga correctamente en smartphone
- [ ] Cámara se activa y captura imágenes
- [ ] Botón QR funciona
- [ ] Botón Cédula funciona
- [ ] Preview de imagen se muestra
- [ ] Pantalla de éxito aparece cuando autorizado
- [ ] Countdown funciona correctamente
- [ ] Mensajes de error son claros
- [ ] Botón "Cancelar" funciona
- [ ] App es responsiva en diferentes tamaños de pantalla

### ✅ ESP32
- [ ] Se conecta a WiFi automáticamente
- [ ] LED indica estado de WiFi
- [ ] Recibe comandos del Arduino
- [ ] Consulta API correctamente
- [ ] Parsea respuestas JSON
- [ ] Envía datos al Arduino en formato correcto
- [ ] Confirma dispensaciones al servidor
- [ ] Maneja errores de conectividad

### ✅ Arduino
- [ ] Muestra mensajes correctos en LCD
- [ ] Botones responden correctamente
- [ ] LEDs se encienden en momentos apropiados
- [ ] Buzzer suena en éxito/error
- [ ] Servo motor dispensa correctamente
- [ ] Comunicación Serial con ESP32 funciona
- [ ] Estados cambian correctamente
- [ ] Timeouts funcionan

### ✅ Integración Completa
- [ ] Flujo QR completo funciona de inicio a fin
- [ ] Flujo Cédula completo funciona de inicio a fin
- [ ] Tiempo total es aceptable (< 15 segundos)
- [ ] Sesiones expiran correctamente
- [ ] Errores se manejan apropiadamente
- [ ] Sistema vuelve a IDLE después de dispensar
- [ ] Múltiples dispensaciones consecutivas funcionan
- [ ] No hay memory leaks después de 10+ ciclos

---

## Solución de Problemas Comunes

### Problema: ESP32 no conecta a WiFi

**Solución:**
1. Verificar SSID y password en código
2. Verificar que router está encendido
3. Verificar que ESP32 está dentro del rango
4. Probar con hotspot del smartphone

### Problema: API no responde

**Solución:**
1. Verificar que Node.js está corriendo: `ps aux | grep node`
2. Verificar puerto 3000: `lsof -i :3000`
3. Verificar MongoDB está corriendo
4. Revisar logs del servidor
5. Verificar firewall no bloquea puerto

### Problema: App móvil no accede a cámara

**Solución:**
1. Verificar permisos de cámara en navegador
2. Probar en navegador diferente (Chrome, Safari)
3. Verificar que app se sirve vía HTTPS o localhost
4. Recargar página y permitir permisos de nuevo

### Problema: Arduino no recibe datos de ESP32

**Solución:**
1. Verificar conexiones Serial: TX ↔ RX, GND ↔ GND
2. Verificar baud rate (debe ser 115200 en ambos)
3. Usar multímetro para verificar continuidad
4. Probar intercambiar TX y RX (error común)

### Problema: Servo no se mueve

**Solución:**
1. Verificar alimentación del servo (5V y GND)
2. Verificar cable de señal conectado a pin 9
3. Probar servo con código simple de prueba
4. Verificar que servo no está dañado

---

## Métricas de Éxito

Un sistema completamente funcional debe cumplir:

| Métrica | Objetivo | Resultado |
|---------|----------|-----------|
| Tiempo de captura a dispensación | < 15 segundos | _____ segundos |
| Tasa de éxito QR | > 95% | _____ % |
| Tasa de éxito Cédula | > 85% | _____ % |
| Uptime del API | > 99% | _____ % |
| Falsos positivos | < 1% | _____ % |
| Falsos negativos | < 2% | _____ % |

---

## Conclusión

Si todas las pruebas pasan exitosamente, el sistema está listo para:
1. ✅ Despliegue en entorno de pruebas
2. ✅ Pruebas con usuarios reales (beta)
3. ✅ Ajustes finales basados en feedback
4. ✅ Despliegue en producción (con aprobaciones regulatorias)

**Próximos pasos recomendados:**
- Implementar logging más robusto
- Añadir monitoreo con Prometheus/Grafana
- Configurar backups automáticos de base de datos
- Implementar HTTPS en producción
- Crear dashboard administrativo
- Documentar procedimientos de mantenimiento

