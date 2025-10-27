/**
 * Servicio de OCR (Optical Character Recognition)
 *
 * Extrae el número de cédula colombiana de imágenes usando Tesseract.js
 */

const Tesseract = require('tesseract.js');
const sharp = require('sharp');

class OCRService {
  constructor() {
    this.worker = null;
  }

  /**
   * Inicializa el worker de Tesseract
   */
  async initWorker() {
    if (!this.worker) {
      this.worker = await Tesseract.createWorker('spa', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      await this.worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ ',
        tessedit_pageseg_mode: Tesseract.PSM.AUTO
      });
    }
    return this.worker;
  }

  /**
   * Preprocesa la imagen para mejorar el reconocimiento OCR
   * @param {Buffer} imageBuffer - Buffer de la imagen
   * @returns {Promise<Buffer>} - Imagen preprocesada
   */
  async preprocessImage(imageBuffer) {
    try {
      return await sharp(imageBuffer)
        .greyscale()                    // Convertir a escala de grises
        .normalize()                    // Normalizar contraste
        .sharpen()                      // Aumentar nitidez
        .threshold(128)                 // Umbral binario
        .resize(1200, null, {           // Redimensionar para mejor OCR
          fit: 'inside',
          withoutEnlargement: false
        })
        .toBuffer();
    } catch (error) {
      console.error('Error preprocessing image:', error);
      throw error;
    }
  }

  /**
   * Extrae texto de una imagen usando OCR
   * @param {string} imageBase64 - Imagen en formato base64
   * @returns {Promise<string>} - Texto extraído
   */
  async extractText(imageBase64) {
    try {
      // Extraer el contenido base64
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Preprocesar imagen
      const processedBuffer = await this.preprocessImage(imageBuffer);

      // Inicializar worker
      await this.initWorker();

      // Realizar OCR
      const { data: { text } } = await this.worker.recognize(processedBuffer);

      return text;
    } catch (error) {
      console.error('Error extracting text:', error);
      throw error;
    }
  }

  /**
   * Extrae el número de cédula del texto reconocido
   * @param {string} text - Texto extraído por OCR
   * @returns {object} - Resultado con el número de cédula
   */
  extractCedulaNumber(text) {
    // Limpiar texto
    const cleanText = text.replace(/\s+/g, ' ').trim();

    // Patrones comunes en cédulas colombianas
    const patterns = [
      // Patrón 1: "NUMERO" o "No." seguido de dígitos
      /(?:NUMERO|No\.|NUM|NÚMERO)[\s:]*(\d{6,10})/i,

      // Patrón 2: Secuencia de 6-10 dígitos consecutivos
      /\b(\d{6,10})\b/,

      // Patrón 3: "CEDULA" seguido de número
      /CEDULA[\s:]*(\d{6,10})/i,

      // Patrón 4: "ID" seguido de número
      /ID[\s:]*(\d{6,10})/i
    ];

    // Intentar cada patrón
    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match && match[1]) {
        const cedula = match[1];

        // Validar que sea un número de cédula válido (6-10 dígitos)
        if (this.isValidCedulaFormat(cedula)) {
          return {
            success: true,
            cedula: cedula,
            extractedText: cleanText
          };
        }
      }
    }

    // Si no se encontró con patrones, buscar la secuencia más larga de dígitos
    const allNumbers = cleanText.match(/\d+/g);
    if (allNumbers) {
      // Ordenar por longitud descendente
      const sortedNumbers = allNumbers.sort((a, b) => b.length - a.length);

      for (const num of sortedNumbers) {
        if (this.isValidCedulaFormat(num)) {
          return {
            success: true,
            cedula: num,
            extractedText: cleanText,
            confidence: 'low' // Baja confianza porque no coincidió con patrones
          };
        }
      }
    }

    return {
      success: false,
      error: 'No se pudo extraer número de cédula',
      extractedText: cleanText
    };
  }

  /**
   * Valida el formato de un número de cédula colombiana
   * @param {string} cedula - Número de cédula
   * @returns {boolean} - True si es válido
   */
  isValidCedulaFormat(cedula) {
    // Cédulas colombianas tienen entre 6 y 10 dígitos
    const minLength = parseInt(process.env.CEDULA_MIN_LENGTH) || 6;
    const maxLength = parseInt(process.env.CEDULA_MAX_LENGTH) || 10;

    if (!cedula || typeof cedula !== 'string') {
      return false;
    }

    // Solo debe contener dígitos
    if (!/^\d+$/.test(cedula)) {
      return false;
    }

    // Verificar longitud
    const length = cedula.length;
    return length >= minLength && length <= maxLength;
  }

  /**
   * Procesa una imagen de cédula y extrae el número
   * @param {string} imageBase64 - Imagen en formato base64
   * @returns {Promise<object>} - Resultado del procesamiento
   */
  async processCedulaImage(imageBase64) {
    try {
      // Extraer texto de la imagen
      const text = await this.extractText(imageBase64);

      if (!text || text.trim().length === 0) {
        return {
          success: false,
          error: 'No se pudo extraer texto de la imagen'
        };
      }

      // Extraer número de cédula
      const result = this.extractCedulaNumber(text);

      return result;

    } catch (error) {
      console.error('Error processing cedula image:', error);
      return {
        success: false,
        error: 'Error procesando imagen de cédula',
        details: error.message
      };
    }
  }

  /**
   * Limpia recursos del worker
   */
  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

// Exportar instancia singleton
const ocrService = new OCRService();

// Limpiar recursos al cerrar la aplicación
process.on('SIGTERM', async () => {
  await ocrService.terminate();
});

process.on('SIGINT', async () => {
  await ocrService.terminate();
});

module.exports = ocrService;
