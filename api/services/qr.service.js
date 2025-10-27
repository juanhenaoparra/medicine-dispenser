/**
 * Servicio de procesamiento de códigos QR
 *
 * Decodifica códigos QR de imágenes usando jsQR
 */

const jsQR = require('jsqr');
const { createCanvas, loadImage } = require('canvas');
const sharp = require('sharp');

class QRService {
  /**
   * Decodifica un código QR de una imagen en base64
   * @param {string} imageBase64 - Imagen en formato base64
   * @returns {Promise<object>} - Objeto con el resultado
   */
  async decodeQR(imageBase64) {
    try {
      // Extraer el contenido base64 (quitar el prefijo data:image/...)
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Preprocesar imagen con sharp para mejor detección
      const processedBuffer = await sharp(imageBuffer)
        .greyscale() // Convertir a escala de grises
        .normalize() // Normalizar contraste
        .sharpen()   // Aumentar nitidez
        .toBuffer();

      // Cargar imagen en canvas
      const image = await loadImage(processedBuffer);
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);

      // Obtener datos de píxeles
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Decodificar QR
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code) {
        return {
          success: true,
          data: code.data,
          location: code.location
        };
      }

      // Si no se detectó, intentar con inversión de colores
      const invertedCode = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth'
      });

      if (invertedCode) {
        return {
          success: true,
          data: invertedCode.data,
          location: invertedCode.location
        };
      }

      return {
        success: false,
        error: 'No se pudo detectar código QR en la imagen'
      };

    } catch (error) {
      console.error('Error decoding QR:', error);
      return {
        success: false,
        error: 'Error procesando imagen QR',
        details: error.message
      };
    }
  }

  /**
   * Valida el formato del código QR del dispensador
   * @param {string} qrData - Datos del código QR
   * @returns {object} - Resultado de la validación
   */
  validateQRFormat(qrData) {
    // El QR debe contener el código único del paciente
    // Formato esperado: cadena alfanumérica de 16 caracteres (generada en Patient.generateQRCode)

    if (!qrData || typeof qrData !== 'string') {
      return {
        valid: false,
        reason: 'Código QR vacío o inválido'
      };
    }

    // Verificar longitud mínima
    if (qrData.length < 8) {
      return {
        valid: false,
        reason: 'Código QR demasiado corto'
      };
    }

    // Verificar que sea alfanumérico
    if (!/^[a-zA-Z0-9\-_]+$/.test(qrData)) {
      return {
        valid: false,
        reason: 'Código QR contiene caracteres inválidos'
      };
    }

    return {
      valid: true,
      qrCode: qrData
    };
  }

  /**
   * Procesa y valida una imagen QR completa
   * @param {string} imageBase64 - Imagen en formato base64
   * @returns {Promise<object>} - Resultado del procesamiento
   */
  async processQRImage(imageBase64) {
    // Decodificar QR
    const decodeResult = await this.decodeQR(imageBase64);

    if (!decodeResult.success) {
      return decodeResult;
    }

    // Validar formato
    const validationResult = this.validateQRFormat(decodeResult.data);

    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.reason
      };
    }

    return {
      success: true,
      qrCode: validationResult.qrCode,
      location: decodeResult.location
    };
  }
}

module.exports = new QRService();
