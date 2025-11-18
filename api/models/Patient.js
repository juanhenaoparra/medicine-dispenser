/**
 * Modelo de Paciente
 *
 * Almacena información de pacientes autorizados para usar el dispensador
 */

const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  // Información personal
  cedula: {
    type: String,
    required: [true, 'La cédula es requerida'],
    unique: true,
    trim: true,
    minlength: [6, 'La cédula debe tener al menos 6 caracteres'],
    maxlength: [10, 'La cédula debe tener máximo 10 caracteres'],
    validate: {
      validator: function(v) {
        return /^\d+$/.test(v); // Solo números
      },
      message: 'La cédula debe contener solo números'
    }
  },

  firstName: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
    maxlength: [50, 'El nombre debe tener máximo 50 caracteres']
  },

  lastName: {
    type: String,
    required: [true, 'El apellido es requerido'],
    trim: true,
    maxlength: [50, 'El apellido debe tener máximo 50 caracteres']
  },

  email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Email es opcional
        return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
      },
      message: 'Email inválido'
    }
  },

  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Teléfono es opcional
        return /^[\d\+\-\s\(\)]+$/.test(v);
      },
      message: 'Teléfono inválido'
    }
  },

  // Código QR único para el paciente
  qrCode: {
    type: String,
    unique: true,
    sparse: true
  },

  // Estado del paciente
  active: {
    type: Boolean,
    default: true
  },

  // Fecha de registro
  registeredAt: {
    type: Date,
    default: Date.now
  },

  // Última actualización
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para nombre completo
patientSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Middleware para actualizar timestamp
patientSchema.pre('save', function(next) {
  this.updatedAt = Date.now()
  next()
})

// Índice adicional para búsquedas por estado
patientSchema.index({ active: 1 })

// Métodos del modelo
patientSchema.methods.generateQRCode = function() {
  // Generar código QR único basado en cédula y timestamp
  const crypto = require('crypto');
  const data = `${this.cedula}-${Date.now()}`;
  this.qrCode = crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  return this.qrCode;
};

patientSchema.methods.isActive = function() {
  return this.active === true;
};

module.exports = mongoose.model('Patient', patientSchema);
