# Documentación del API

API REST para el Dispensador Inteligente de Medicamentos.

## URL Base

```
http://localhost:3000/api
```

En producción, reemplazar con la URL de tu servidor.

---

## Autenticación

Actualmente el API no requiere autenticación para los endpoints del dispensador. En producción se recomienda implementar:
- API Keys para los dispositivos
- JWT para usuarios administrativos
- HTTPS obligatorio

---

## Endpoints

### 1. Health Check

**GET** `/health`

Verifica que el servidor esté funcionando.

**Respuesta:**
```json
{
  "status": "ok",
  "message": "Medicine Dispenser API is running",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.5
}
```

---

### 2. Validar Código QR

**POST** `/api/validate-qr`

Valida un código QR capturado por la cámara y autoriza la dispensación.

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA..."
}
```

**Respuesta Exitosa (200):**
```json
{
  "authorized": true,
  "patient": "Juan Perez",
  "medicine": "Aspirina",
  "dosage": "500 mg",
  "remaining": 2,
  "message": "Autorizado: Juan Perez"
}
```

**Respuesta Denegada (200):**
```json
{
  "authorized": false,
  "reason": "Límite de dosis diarias alcanzado"
}
```

**Errores:**
- `400`: Imagen no proporcionada
- `500`: Error interno del servidor

---

### 3. Validar Cédula

**POST** `/api/validate-cedula`

Valida una cédula colombiana mediante OCR y autoriza la dispensación.

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA..."
}
```

**Respuesta Exitosa (200):**
```json
{
  "authorized": true,
  "patient": "Maria Garcia",
  "medicine": "Ibuprofeno",
  "dosage": "400 mg",
  "remaining": 1,
  "message": "Autorizado: Maria Garcia"
}
```

**Respuesta Denegada (200):**
```json
{
  "authorized": false,
  "reason": "No se pudo leer cédula"
}
```

---

### 4. Registrar Dispensación

**POST** `/api/dispense`

Registra una dispensación exitosa en la base de datos.

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "identifier": "1234567890",
  "identifierType": "cedula",
  "authMethod": "cedula"
}
```

**Parámetros:**
- `identifier`: Cédula o código QR del paciente
- `identifierType`: `"cedula"` o `"qr"`
- `authMethod`: `"qr"` o `"cedula"`

**Respuesta Exitosa (201):**
```json
{
  "success": true,
  "message": "Dispensación registrada exitosamente",
  "dispense": {
    "id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "dispensedAt": "2024-01-15T10:30:00.000Z",
    "medicine": "Aspirina"
  }
}
```

**Errores:**
- `400`: Parámetros faltantes
- `403`: No autorizado para dispensar
- `500`: Error interno

---

### 5. Historial de Paciente

**GET** `/api/patient/:identifier/history`

Obtiene el historial de dispensaciones de un paciente.

**Parámetros de URL:**
- `identifier`: Cédula o código QR del paciente

**Query Parameters:**
- `type`: `"cedula"` o `"qr"` (default: `"cedula"`)
- `limit`: Número de registros (default: `50`)

**Ejemplo:**
```
GET /api/patient/1234567890/history?type=cedula&limit=10
```

**Respuesta (200):**
```json
{
  "success": true,
  "patient": {
    "name": "Juan Perez",
    "cedula": "1234567890"
  },
  "count": 10,
  "dispenses": [
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "medicine": {
        "name": "Aspirina",
        "dosage": {
          "amount": 500,
          "unit": "mg"
        }
      },
      "dispensedAt": "2024-01-15T10:30:00.000Z",
      "authMethod": "cedula",
      "status": "exitosa"
    }
  ]
}
```

---

### 6. Estadísticas de Paciente

**GET** `/api/patient/:identifier/stats`

Obtiene estadísticas de dispensación de un paciente.

**Parámetros de URL:**
- `identifier`: Cédula o código QR del paciente

**Query Parameters:**
- `type`: `"cedula"` o `"qr"` (default: `"cedula"`)
- `days`: Número de días (default: `30`)

**Ejemplo:**
```
GET /api/patient/1234567890/stats?type=cedula&days=7
```

**Respuesta (200):**
```json
{
  "success": true,
  "patient": {
    "name": "Juan Perez",
    "cedula": "1234567890"
  },
  "period": "7 días",
  "stats": {
    "total": 15,
    "successful": 14,
    "failed": 1,
    "successRate": "93.33",
    "recentDispenses": [...]
  }
}
```

---

### 7. Dispensaciones Recientes

**GET** `/api/dispenses/recent`

Obtiene las dispensaciones más recientes de todos los pacientes.

**Query Parameters:**
- `limit`: Número de registros (default: `20`)

**Ejemplo:**
```
GET /api/dispenses/recent?limit=5
```

**Respuesta (200):**
```json
{
  "success": true,
  "count": 5,
  "dispenses": [
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "patient": {
        "firstName": "Juan",
        "lastName": "Perez",
        "cedula": "1234567890"
      },
      "prescription": {
        "medicineName": "Aspirina",
        "dosage": {
          "amount": 500,
          "unit": "mg"
        }
      },
      "dispensedAt": "2024-01-15T10:30:00.000Z",
      "authMethod": "cedula",
      "status": "exitosa"
    }
  ]
}
```

---

### 8. Dispensaciones del Día

**GET** `/api/dispenses/today`

Obtiene todas las dispensaciones realizadas hoy.

**Respuesta (200):**
```json
{
  "success": true,
  "date": "2024-01-15",
  "summary": {
    "total": 25,
    "successful": 23,
    "failed": 2
  },
  "dispenses": [...]
}
```

---

## Endpoints de Prueba (Solo Development)

Estos endpoints solo están disponibles cuando `NODE_ENV=development`.

### Test QR

**GET** `/api/test-qr/:qrCode`

Valida un código QR sin necesidad de enviar imagen.

**Ejemplo:**
```
GET /api/test-qr/abc123xyz456
```

### Test Cédula

**GET** `/api/test-cedula/:cedula`

Valida una cédula sin necesidad de enviar imagen.

**Ejemplo:**
```
GET /api/test-cedula/1234567890
```

---

## Códigos de Estado HTTP

| Código | Significado |
|--------|-------------|
| 200 | OK - Solicitud exitosa |
| 201 | Created - Recurso creado exitosamente |
| 400 | Bad Request - Parámetros inválidos |
| 403 | Forbidden - No autorizado |
| 404 | Not Found - Recurso no encontrado |
| 500 | Internal Server Error - Error del servidor |

---

## Formato de Imágenes

Las imágenes deben enviarse en formato base64 con el prefijo data URI:

```
data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA...
```

**Formatos aceptados:**
- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)

**Tamaño máximo:** 5 MB (configurable en `.env`)

---

## Rate Limiting

El API implementa rate limiting para prevenir abuso:

- **Ventana:** 15 minutos
- **Máximo de requests:** 100 por IP

Si excedes el límite, recibirás:

```json
{
  "message": "Too many requests from this IP, please try again later."
}
```

---

## Validaciones

### Número de Cédula Colombiana

- Longitud: 6-10 dígitos
- Solo números
- Ejemplo válido: `1234567890`

### Código QR

- Longitud mínima: 8 caracteres
- Caracteres alfanuméricos, guiones y guiones bajos
- Ejemplo válido: `abc123xyz456`

---

## Ejemplo de Uso con ESP32-CAM

```cpp
// Capturar imagen
camera_fb_t * fb = esp_camera_fb_get();

// Convertir a base64
String imageBase64 = base64::encode(fb->buf, fb->len);

// Crear payload JSON
String payload = "{\"image\":\"data:image/jpeg;base64," + imageBase64 + "\"}";

// Enviar POST request
HTTPClient http;
http.begin("http://192.168.1.100:3000/api/validate-qr");
http.addHeader("Content-Type", "application/json");
int httpCode = http.POST(payload);

// Procesar respuesta
if (httpCode == 200) {
  String response = http.getString();
  // Parsear JSON y verificar campo "authorized"
}
```

---

## Seguridad en Producción

Para usar en producción, asegúrate de:

1. **Activar HTTPS**: Usa certificado SSL/TLS
2. **Implementar autenticación**: API Keys o JWT
3. **Validar origen**: CORS restrictivo
4. **Encriptar datos sensibles**: Información de pacientes
5. **Logs de auditoría**: Registrar todos los accesos
6. **Backup regular**: Base de datos
7. **Rate limiting estricto**: Ajustar según necesidad
8. **Monitoreo**: Implementar alertas

---

## Soporte

Para problemas o preguntas sobre el API, consulta:
- [README principal](../README.md)
- [Guía de instalación](./INSTALLATION.md)
