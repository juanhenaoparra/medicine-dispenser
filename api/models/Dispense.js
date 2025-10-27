/**
 * Modelo de Dispensación
 *
 * Registro de cada dispensación de medicamento realizada
 */

const mongoose = require('mongoose');

const dispenseSchema = new mongoose.Schema({
  // Referencia al paciente
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'El paciente es requerido'],
    index: true
  },

  // Referencia a la prescripción
  prescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
    required: [true, 'La prescripción es requerida'],
    index: true
  },

  // Método de autenticación utilizado
  authMethod: {
    type: String,
    enum: ['qr', 'cedula'],
    required: [true, 'El método de autenticación es requerido']
  },

  // Información del medicamento dispensado
  medicine: {
    name: {
      type: String,
      required: [true, 'El nombre del medicamento es requerido']
    },
    dosage: {
      amount: Number,
      unit: String
    }
  },

  // Timestamp de la dispensación
  dispensedAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Ubicación del dispensador (si hay múltiples)
  dispenserId: {
    type: String,
    default: 'main-dispenser'
  },

  // Estado de la dispensación
  status: {
    type: String,
    enum: ['exitosa', 'fallida', 'parcial'],
    default: 'exitosa'
  },

  // Información adicional
  metadata: {
    // IP del dispositivo que realizó la request
    ipAddress: String,

    // User agent (si aplica)
    userAgent: String,

    // Tiempo de respuesta del API (ms)
    responseTime: Number,

    // Imagen capturada (opcional, para auditoría)
    imageUrl: String,

    // Notas adicionales
    notes: String
  },

  // Errores si los hubo
  error: {
    code: String,
    message: String,
    details: String
  }
}, {
  timestamps: true
});

// Índices para búsquedas eficientes
dispenseSchema.index({ patient: 1, dispensedAt: -1 });
dispenseSchema.index({ prescription: 1, dispensedAt: -1 });
dispenseSchema.index({ dispensedAt: -1 });
dispenseSchema.index({ status: 1 });

// Método estático para contar dispensaciones diarias
dispenseSchema.statics.countDailyDispenses = async function(patientId, prescriptionId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const count = await this.countDocuments({
    patient: patientId,
    prescription: prescriptionId,
    status: 'exitosa',
    dispensedAt: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  });

  return count;
};

// Método estático para obtener última dispensación
dispenseSchema.statics.getLastDispense = async function(patientId, prescriptionId) {
  const lastDispense = await this.findOne({
    patient: patientId,
    prescription: prescriptionId,
    status: 'exitosa'
  })
  .sort({ dispensedAt: -1 })
  .limit(1);

  return lastDispense;
};

// Método estático para verificar si puede dispensar
dispenseSchema.statics.canDispense = async function(patientId, prescriptionId, maxDailyDoses, cooldownMinutes = 30) {
  // Verificar límite de dosis diarias
  const dailyCount = await this.countDailyDispenses(patientId, prescriptionId);

  if (dailyCount >= maxDailyDoses) {
    return {
      canDispense: false,
      reason: 'Límite de dosis diarias alcanzado',
      dailyCount,
      maxDailyDoses
    };
  }

  // Verificar cooldown (tiempo mínimo entre dispensaciones)
  const lastDispense = await this.getLastDispense(patientId, prescriptionId);

  if (lastDispense) {
    const minutesSinceLastDispense = (Date.now() - lastDispense.dispensedAt) / (1000 * 60);

    if (minutesSinceLastDispense < cooldownMinutes) {
      const minutesRemaining = Math.ceil(cooldownMinutes - minutesSinceLastDispense);
      return {
        canDispense: false,
        reason: `Debe esperar ${minutesRemaining} minutos para la próxima dosis`,
        minutesRemaining,
        lastDispensedAt: lastDispense.dispensedAt
      };
    }
  }

  return {
    canDispense: true,
    reason: 'Autorizado para dispensar',
    dailyCount,
    maxDailyDoses
  };
};

// Virtual para tiempo transcurrido
dispenseSchema.virtual('timeAgo').get(function() {
  const diff = Date.now() - this.dispensedAt;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days > 0) return `${days} día${days > 1 ? 's' : ''} atrás`;
  if (hours > 0) return `${hours} hora${hours > 1 ? 's' : ''} atrás`;
  if (minutes > 0) return `${minutes} minuto${minutes > 1 ? 's' : ''} atrás`;
  return 'Hace un momento';
});

module.exports = mongoose.model('Dispense', dispenseSchema);
