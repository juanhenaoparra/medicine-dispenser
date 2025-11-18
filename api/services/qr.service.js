/**
 * Servicio de procesamiento de códigos QR
 *
 * Decodifica códigos QR de imágenes usando jsQR y pngjs
 */

const jsQR = require('jsqr')
const { PNG } = require('pngjs')

class QRService {
  /**
   * Convierte imagen base64 a datos RGBA para jsQR
   * @param {string} imageBase64 - Imagen en formato base64
   * @returns {Promise<object>} - Objeto con datos de imagen
   */
  async imageToRGBA(imageBase64) {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')

    return new Promise((resolve, reject) => {
      const png = new PNG()
      
      png.parse(imageBuffer, (error, data) => {
        if (error) {
          reject(error)
          return
        }

        resolve({
          data: data.data,
          width: data.width,
          height: data.height
        })
      })
    })
  }

  /**
   * Decodifica un código QR de una imagen en base64
   * @param {string} imageBase64 - Imagen en formato base64
   * @returns {Promise<object>} - Objeto con el resultado
   */
  async decodeQR(imageBase64) {
    try {
      // Convertir imagen a RGBA
      const imageData = await this.imageToRGBA(imageBase64)

      // Decodificar QR sin inversión
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      })

      if (code) {
        return {
          success: true,
          data: code.data,
          location: code.location
        }
      }

      // Si no se detectó, intentar con inversión de colores
      const invertedCode = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth'
      })

      if (invertedCode) {
        return {
          success: true,
          data: invertedCode.data,
          location: invertedCode.location
        }
      }

      return {
        success: false,
        error: 'No se pudo detectar código QR en la imagen'
      }

    } catch (error) {
      console.error('Error decoding QR:', error)
      return {
        success: false,
        error: 'Error procesando imagen QR',
        details: error.message
      }
    }
  }

  /**
   * Valida el formato del código QR del dispensador
   * @param {string} qrData - Datos del código QR
   * @returns {object} - Resultado de la validación
   */
  validateQRFormat(qrData) {
    if (!qrData || typeof qrData !== 'string') {
      return {
        valid: false,
        reason: 'Código QR vacío o inválido'
      }
    }

    if (qrData.length < 8) {
      return {
        valid: false,
        reason: 'Código QR demasiado corto'
      }
    }

    if (!/^[a-zA-Z0-9\-_]+$/.test(qrData)) {
      return {
        valid: false,
        reason: 'Código QR contiene caracteres inválidos'
      }
    }

    return {
      valid: true,
      qrCode: qrData
    }
  }

  /**
   * Procesa y valida una imagen QR completa
   * @param {string} imageBase64 - Imagen en formato base64
   * @returns {Promise<object>} - Resultado del procesamiento
   */
  async processQRImage(imageBase64) {
    const decodeResult = await this.decodeQR(imageBase64)

    if (!decodeResult.success) {
      return decodeResult
    }

    const validationResult = this.validateQRFormat(decodeResult.data)

    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.reason
      }
    }

    return {
      success: true,
      qrCode: validationResult.qrCode,
      location: decodeResult.location
    }
  }
}

module.exports = new QRService()
