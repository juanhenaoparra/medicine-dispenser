# Base de datos MongoDB
MONGODB_URI=mongodb://localhost:27017/medispen
MONGODB_TEST_URI=mongodb://localhost:27017/medispen-test

# Puerto del servidor
PORT=3000

# JWT Secret
JWT_SECRET=your-secret-key-change-this-in-production

# OpenAI API Key (para OCR con Vision API)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Configuración de cédula colombiana
CEDULA_MIN_LENGTH=6
CEDULA_MAX_LENGTH=10

# Entorno
NODE_ENV=development

# Cors
CORS_ORIGIN=http://localhost:8080

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

