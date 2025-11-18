/**
 * Servicio de OCR (Optical Character Recognition)
 *
 * Extrae el número de cédula colombiana de imágenes usando OpenAI Vision API
 */

const OpenAI = require('openai')
const logger = require('../utils/logger')

class OCRService {
  constructor() {
    this.openai = null
  }

  /**
   * Inicializa el cliente de OpenAI
   */
  getClient() {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY
      
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY no está configurada en las variables de entorno')
      }

      this.openai = new OpenAI({
        apiKey: apiKey
      })
    }
    return this.openai
  }

  /**
   * Extrae texto de una imagen usando OpenAI Vision API
   * @param {string} imageBase64 - Imagen en formato base64
   * @returns {Promise<string>} - Texto extraído
   */
  async extractText(imageBase64) {
    try {
      const client = this.getClient()

      // Asegurar que tenga el prefijo data:image correcto
      const imageData = imageBase64.startsWith('data:image') 
        ? imageBase64 
        : `data:image/jpeg;base64,${imageBase64}`

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract ALL text you can see in this image. Return only the extracted text, nothing else. If you see  ID card (cédula), pay special attention to the ID number."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageData,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0
      })

      const extractedText = response.choices[0]?.message?.content?.trim() || ''
      
      if (!extractedText) {
        throw new Error('No se pudo extraer texto de la imagen')
      }

      return extractedText

    } catch (error) {
      console.error('Error extracting text with OpenAI:', error)
      
      if (error.status === 401) {
        throw new Error('API key de OpenAI inválida')
      }
      if (error.status === 429) {
        throw new Error('Límite de rate de OpenAI excedido')
      }
      
      throw error
    }
  }

  /**
   * Extrae el número de cédula del texto reconocido usando OpenAI
   * @param {string} text - Texto extraído por OCR
   * @returns {Promise<object>} - Resultado con el número de cédula
   */
  async extractCedulaNumber(text) {
    try {
      const client = this.getClient()

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert at extracting Colombian ID numbers (cédula) from text. A valid cédula has between 6 and 10 digits. Extract ONLY the ID number, nothing else. If you cannot find it, respond with 'NOT_FOUND'."
          },
          {
            role: "user",
            content: `Extract the Colombian ID number (cédula) from this text:\n\n${text}`
          }
        ],
        max_tokens: 50,
        temperature: 0
      })

      const result = response.choices[0]?.message?.content?.trim() || ''

      if (result === 'NOT_FOUND' || !result) {
        return {
          success: false,
          error: 'No se pudo extraer número de cédula',
          extractedText: text
        }
      }

      // Limpiar el resultado (remover espacios, guiones, etc)
      const cedula = result.replace(/\D/g, '')

      // Validar formato
      if (!this.isValidCedulaFormat(cedula)) {
        return {
          success: false,
          error: 'El número extraído no tiene un formato válido',
          extractedText: text,
          invalidCedula: cedula
        }
      }

      return {
        success: true,
        cedula: cedula,
        extractedText: text
      }

    } catch (error) {
      console.error('Error extracting cedula with OpenAI:', error)
      
      // Fallback a extracción manual si OpenAI falla
      return this.extractCedulaNumberFallback(text)
    }
  }

  /**
   * Método fallback para extraer cédula sin OpenAI
   * @param {string} text - Texto extraído
   * @returns {object} - Resultado con el número de cédula
   */
  extractCedulaNumberFallback(text) {
    const cleanText = text.replace(/\s+/g, ' ').trim()

    const patterns = [
      /(?:NUMERO|No\.|NUM|NÚMERO|CEDULA|ID)[\s:]*(\d{6,10})/i,
      /\b(\d{6,10})\b/
    ]

    for (const pattern of patterns) {
      const match = cleanText.match(pattern)
      if (match && match[1] && this.isValidCedulaFormat(match[1])) {
        return {
          success: true,
          cedula: match[1],
          extractedText: cleanText,
          usedFallback: true
        }
      }
    }

    const allNumbers = cleanText.match(/\d+/g)
    if (allNumbers) {
      const sortedNumbers = allNumbers.sort((a, b) => b.length - a.length)
      for (const num of sortedNumbers) {
        if (this.isValidCedulaFormat(num)) {
          return {
            success: true,
            cedula: num,
            extractedText: cleanText,
            confidence: 'low',
            usedFallback: true
          }
        }
      }
    }

    return {
      success: false,
      error: 'No se pudo extraer número de cédula',
      extractedText: cleanText
    }
  }

  /**
   * Valida el formato de un número de cédula colombiana
   * @param {string} cedula - Número de cédula
   * @returns {boolean} - True si es válido
   */
  isValidCedulaFormat(cedula) {
    const minLength = parseInt(process.env.CEDULA_MIN_LENGTH) || 6
    const maxLength = parseInt(process.env.CEDULA_MAX_LENGTH) || 10

    if (!cedula || typeof cedula !== 'string') {
      return false
    }

    if (!/^\d+$/.test(cedula)) {
      return false
    }

    const length = cedula.length
    return length >= minLength && length <= maxLength
  }

  /**
   * Procesa una imagen de cédula y extrae el número directamente con OpenAI
   * Este método combina OCR y extracción en un solo paso
   * @param {string} imageBase64 - Imagen en formato base64
   * @returns {Promise<object>} - Resultado del procesamiento
   */
  async processCedulaImage(imageBase64) {
    try {
      const client = this.getClient()

      // Asegurar formato correcto
      const imageData = imageBase64.startsWith('data:image') 
        ? imageBase64 
        : `data:image/jpeg;base64,${imageBase64}`

      logger.debug('PR: Processing cedula image', {
        format: imageData.split(',')[0],
        size: imageData.length,
        preview: imageData.substring(0, 50)
      });

      // Extraer la cédula directamente de la imagen (más eficiente)
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "This is an image of a Colombian ID card (cédula de ciudadanía). Extract ONLY the ID number from the card. The ID number is between 6 and 10 digits. Return ONLY the number, nothing else. If you cannot find it, respond with 'NOT_FOUND'."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageData,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 50,
        temperature: 0
      })

      const result = response.choices[0]?.message?.content?.trim() || ''

      if (result === 'NOT_FOUND' || !result) {
        // Fallback: extraer todo el texto y luego buscar el número
        console.log('Direct extraction failed, trying fallback method')
        const text = await this.extractText(imageBase64)
        return await this.extractCedulaNumber(text)
      }

      // Limpiar resultado
      const cedula = result.replace(/\D/g, '')

      if (!this.isValidCedulaFormat(cedula)) {
        return {
          success: false,
          error: 'El número extraído no tiene un formato válido',
          invalidCedula: cedula
        }
      }

      return {
        success: true,
        cedula: cedula
      }

    } catch (error) {
      console.error('Error processing cedula image:', error)
      return {
        success: false,
        error: 'Error procesando imagen de cédula',
        details: error.message
      }
    }
  }

  /**
   * Limpia recursos (ya no es necesario con OpenAI)
   */
  async terminate() {
    // No hay recursos que limpiar con OpenAI
    this.openai = null
  }
}

// Exportar instancia singleton
const ocrService = new OCRService()

// Limpiar recursos al cerrar la aplicación
process.on('SIGTERM', async () => {
  await ocrService.terminate()
})

process.on('SIGINT', async () => {
  await ocrService.terminate()
})

module.exports = ocrService
