/**
 * Modelo de Prescripción Médica
 *
 * Almacena prescripciones autorizadas por médicos para pacientes
 */

const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  // Referencia al paciente
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'El paciente es requerido'],
    index: true
  },

  // Información del medicamento
  medicineName: {
    type: String,
    required: [true, 'El nombre del medicamento es requerido'],
    trim: true,
    maxlength: [100, 'El nombre del medicamento debe tener máximo 100 caracteres']
  },

  medicineCode: {
    type: String,
    trim: true,
    index: true
  },

  // Dosis
  dosage: {
    amount: {
      type: Number,
      required: [true, 'La cantidad de dosis es requerida'],
      min: [0.1, 'La cantidad debe ser mayor a 0']
    },
    unit: {
      type: String,
      required: [true, 'La unidad de dosis es requerida'],
      enum: ['mg', 'g', 'ml', 'L', 'tabletas', 'cápsulas', 'gotas', 'UI'],
      default: 'tabletas'
    }
  },

  // Frecuencia
  frequency: {
    times: {
      type: Number,
      required: [true, 'El número de tomas es requerido'],
      min: [1, 'Debe haber al menos 1 toma'],
      max: [24, 'No puede haber más de 24 tomas']
    },
    period: {
      type: String,
      required: [true, 'El periodo es requerido'],
      enum: ['diario', 'cada 8 horas', 'cada 12 horas', 'cada 24 horas', 'semanal', 'mensual'],
      default: 'diario'
    }
  },

  // Límite de dosis diarias
  maxDailyDoses: {
    type: Number,
    required: [true, 'El límite de dosis diarias es requerido'],
    min: [1, 'Debe haber al menos 1 dosis diaria permitida'],
    max: [10, 'No puede haber más de 10 dosis diarias']
  },

  // Información del médico
  doctor: {
    name: {
      type: String,
      required: [true, 'El nombre del médico es requerido'],
      trim: true,
      maxlength: [100, 'El nombre del médico debe tener máximo 100 caracteres']
    },
    license: {
      type: String,
      required: [true, 'El número de licencia es requerido'],
      trim: true
    },
    specialty: {
      type: String,
      trim: true
    }
  },

  // Vigencia de la prescripción
  startDate: {
    type: Date,
    required: [true, 'La fecha de inicio es requerida'],
    default: Date.now
  },

  endDate: {
    type: Date,
    required: [true, 'La fecha de fin es requerida'],
    validate: {
      validator: function(v) {
        return v > this.startDate;
      },
      message: 'La fecha de fin debe ser posterior a la fecha de inicio'
    }
  },

  // Estado de la prescripción
  status: {
    type: String,
    enum: ['activa', 'completada', 'cancelada', 'expirada'],
    default: 'activa',
    index: true
  },

  // Notas especiales
  notes: {
    type: String,
    maxlength: [500, 'Las notas deben tener máximo 500 caracteres']
  },

  // Controles
  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para verificar si está vigente
prescriptionSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.status === 'activa' &&
         this.startDate <= now &&
         this.endDate >= now;
});

// Virtual para días restantes
prescriptionSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const diff = this.endDate - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Middleware para actualizar timestamp
prescriptionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Método para verificar validez
prescriptionSchema.methods.checkValidity = function() {
  const now = new Date();

  if (this.status !== 'activa') {
    return {
      valid: false,
      reason: `Prescripción ${this.status}`
    };
  }

  if (this.startDate > now) {
    return {
      valid: false,
      reason: 'Prescripción aún no está vigente'
    };
  }

  if (this.endDate < now) {
    this.status = 'expirada';
    this.save();
    return {
      valid: false,
      reason: 'Prescripción expirada'
    };
  }

  return {
    valid: true,
    reason: 'Prescripción válida'
  };
};

// Índices compuestos
prescriptionSchema.index({ patient: 1, status: 1 });
prescriptionSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('Prescription', prescriptionSchema);
