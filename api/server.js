/**
 * Medicine Dispenser API - Servidor Principal
 *
 * Este servidor maneja:
 * - Validación de códigos QR
 * - Validación de cédulas colombianas (OCR)
 * - Verificación de prescripciones
 * - Control de dosis diarias
 * - Registro de dispensaciones
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Importar rutas
const validationRoutes = require('./routes/validation.routes');
const dispenseRoutes = require('./routes/dispense.routes');
const sessionRoutes = require('./routes/session.routes');
const patientRoutes = require('./routes/patient.routes');

// Crear aplicación Express
const app = express();

// ============================================
// MIDDLEWARE DE SEGURIDAD
// ============================================

// Helmet - Headers de seguridad
app.use(helmet());

// CORS - Permitir requests desde Arduino/ESP32
app.use(cors({
  origin: '*', // En producción, especificar IPs permitidas
  credentials: true
}));

// Rate limiting - Prevenir ataques de fuerza bruta
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// ============================================
// MIDDLEWARE GENERAL
// ============================================

// Body parser - Aumentar límite para imágenes en base64
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Morgan - Logging de requests
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ============================================
// RUTAS
// ============================================

// Ruta de health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Medicine Dispenser API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Rutas de API
app.use('/api', validationRoutes);
app.use('/api', dispenseRoutes);
app.use('/api', sessionRoutes);
app.use('/api', patientRoutes);

// Ruta 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// ============================================
// MANEJADOR DE ERRORES GLOBAL
// ============================================

app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Error de validación de Mongoose
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }

  // Error de cast de Mongoose (ID inválido)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  // Error de duplicado de MongoDB
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate field value'
    });
  }

  // Error genérico
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// ============================================
// CONEXIÓN A BASE DE DATOS
// ============================================

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medicine-dispenser', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// ============================================
// INICIAR SERVIDOR
// ============================================

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  // Conectar a base de datos
  await connectDB();

  // Iniciar servidor
  app.listen(PORT, () => {
    console.log('===========================================');
    console.log(`  Medicine Dispenser API`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Server running on port ${PORT}`);
    console.log(`  Health check: http://localhost:${PORT}/health`);
    console.log('===========================================');
  });
};

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection: ${err.message}`);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

// Iniciar servidor
startServer();

module.exports = app;
