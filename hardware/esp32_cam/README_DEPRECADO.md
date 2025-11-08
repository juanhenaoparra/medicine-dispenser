# ⚠️ DIRECTORIO DEPRECADO

## Arquitectura Anterior (con ESP32-CAM)

Este directorio contiene el código original para ESP32-CAM que capturaba imágenes directamente en el dispensador.

### Por qué se cambió

La arquitectura se modificó para eliminar la necesidad del ESP32-CAM porque:

1. **Costo**: ESP32-CAM ($10-12) + Programador FTDI ($3-5) vs ESP32 regular ($5-7)
2. **Complejidad**: ESP32-CAM requiere programador externo y configuración de cámara
3. **Calidad**: Cámaras de smartphones modernos son superiores a la OV2640
4. **UX**: Usuario puede capturar desde cualquier lugar con internet

### Nueva Arquitectura

- Usuario captura imagen desde su smartphone (PWA)
- Imagen se envía al API directamente
- API crea sesión temporal de 90 segundos
- ESP32 regular (sin cámara) consulta sesiones pendientes
- Arduino dispensa cuando encuentra sesión autorizada

### Archivos en este directorio

- `esp32_cam.ino` - Código original para ESP32-CAM
  - Incluye captura de imágenes
  - Comunicación con cámara OV2640
  - Envío de imágenes en base64

### Si quieres usar ESP32-CAM con la nueva arquitectura

Puedes usar un ESP32-CAM sin la cámara conectada:
1. Usa el código de `../esp32_regular/esp32_regular.ino`
2. Carga en el ESP32-CAM (sin conectar la cámara)
3. Funciona igual que un ESP32 DevKit normal

### Documentación

Para la nueva arquitectura, consulta:
- `../esp32_regular/` - Código actualizado para ESP32 sin cámara
- `../arduino_main/` - Código actualizado de Arduino
- `/mobile-app/` - Aplicación web móvil para captura
- `/api/routes/session.routes.js` - Endpoints de sesiones

---

## Código de Referencia

El código en `esp32_cam.ino` se mantiene como referencia por si:
- Quieres entender la arquitectura original
- Necesitas implementar captura en el dispensador por requisitos específicos
- Quieres estudiar cómo funciona la cámara OV2640
- Necesitas migrar de vuelta a ESP32-CAM por alguna razón

**Fecha de deprecación**: Noviembre 2024

**Última versión funcional**: v1.0 (con ESP32-CAM)

**Versión actual**: v2.0 (sin ESP32-CAM, con smartphone)

