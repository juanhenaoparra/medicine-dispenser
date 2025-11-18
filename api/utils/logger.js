/**
 * Utilidad de logging seguro
 * Sanitiza datos sensibles antes de loggear
 */

const SENSITIVE_KEYS = [
  'password',
  'token',
  'apikey',
  'secret',
  'authorization',
  'cookie',
  'session'
]

/**
 * Sanitiza un string largo (como base64) para logging
 * @param {string} str - String a sanitizar
 * @param {number} maxLength - Longitud máxima antes de truncar
 * @returns {string} - String sanitizado
 */
function sanitizeString(str, maxLength = 50) {
  if (!str || typeof str !== 'string') return str
  
  if (str.length <= maxLength) return str
  
  // Si parece base64 (muy largo y solo caracteres base64)
  if (str.length > 100 && /^[A-Za-z0-9+/=]+$/.test(str)) {
    return `[BASE64_DATA:${str.length}_bytes:${str.substring(0, 20)}...${str.substring(str.length - 10)}]`
  }
  
  // Si empieza con data:image
  if (str.startsWith('data:image')) {
    const parts = str.split(',')
    const prefix = parts[0]
    const data = parts[1] || ''
    return `[${prefix},BASE64:${data.length}_bytes:${data.substring(0, 15)}...]`
  }
  
  return `${str.substring(0, maxLength)}...[${str.length}_chars]`
}

/**
 * Sanitiza un objeto recursivamente
 * @param {any} obj - Objeto a sanitizar
 * @param {number} depth - Profundidad actual (para evitar recursión infinita)
 * @returns {any} - Objeto sanitizado
 */
function sanitizeObject(obj, depth = 0) {
  if (depth > 5) return '[MAX_DEPTH_REACHED]'
  
  if (!obj || typeof obj !== 'object') {
    return typeof obj === 'string' ? sanitizeString(obj) : obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1))
  }
  
  const sanitized = {}
  
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase()
    
    // Ocultar keys sensibles completamente
    if (SENSITIVE_KEYS.some(sk => keyLower.includes(sk))) {
      sanitized[key] = '[REDACTED]'
      continue
    }
    
    // Sanitizar valores recursivamente
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value)
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value, depth + 1)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}

/**
 * Logger seguro que sanitiza automáticamente
 */
class SafeLogger {
  log(...args) {
    const sanitized = args.map(arg => 
      typeof arg === 'object' ? sanitizeObject(arg) : 
      typeof arg === 'string' ? sanitizeString(arg, 200) : 
      arg
    )
    console.log(...sanitized)
  }
  
  error(...args) {
    const sanitized = args.map(arg => 
      typeof arg === 'object' ? sanitizeObject(arg) : 
      typeof arg === 'string' ? sanitizeString(arg, 200) : 
      arg
    )
    console.error(...sanitized)
  }
  
  warn(...args) {
    const sanitized = args.map(arg => 
      typeof arg === 'object' ? sanitizeObject(arg) : 
      typeof arg === 'string' ? sanitizeString(arg, 200) : 
      arg
    )
    console.warn(...sanitized)
  }
  
  info(...args) {
    const sanitized = args.map(arg => 
      typeof arg === 'object' ? sanitizeObject(arg) : 
      typeof arg === 'string' ? sanitizeString(arg, 200) : 
      arg
    )
    console.info(...sanitized)
  }
  
  debug(...args) {
    if (process.env.NODE_ENV === 'development') {
      const sanitized = args.map(arg => 
        typeof arg === 'object' ? sanitizeObject(arg) : 
        typeof arg === 'string' ? sanitizeString(arg, 200) : 
        arg
      )
      console.debug(...sanitized)
    }
  }
}

module.exports = new SafeLogger()
module.exports.sanitizeString = sanitizeString
module.exports.sanitizeObject = sanitizeObject

