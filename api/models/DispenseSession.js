/**
 * Modelo de Sesión de Dispensación
 * 
 * Maneja sesiones temporales de autorización para dispensar medicamentos
 * sin necesidad de ESP32-CAM. El usuario captura la imagen desde su smartphone,
 * el API valida y crea una sesión, y el dispensador físico consulta si hay
 * una sesión pendiente.
 */

const mongoose = require('mongoose');

const dispenseSessionSchema = new mongoose.Schema({
  // ID único de la sesión
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Referencia al paciente
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },

  // Referencia a la prescripción
  prescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription',
    required: true
  },

  // Estado de la sesión
  status: {
    type: String,
    enum: ['pending', 'dispensed', 'expired', 'cancelled'],
    default: 'pending',
    index: true
  },

  // Método de autenticación usado
  authMethod: {
    type: String,
    enum: ['qr', 'cedula'],
    required: true
  },

  // Información del paciente (para respuesta rápida)
  patientInfo: {
    name: String,
    cedula: String,
    qrCode: String
  },

  // Información del medicamento (para respuesta rápida)
  medicineInfo: {
    name: String,
    dosage: String
  },

  // ID del dispensador (para múltiples dispensadores)
  dispenserId: {
    type: String,
    default: 'dispenser-01',
    index: true
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  expiresAt: {
    type: Date,
    required: true,
    index: true
  },

  dispensedAt: {
    type: Date
  },

  // Metadata
  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceInfo: String
  }
});

// Índice compuesto para consultas eficientes
dispenseSessionSchema.index({ status: 1, expiresAt: 1 });
dispenseSessionSchema.index({ patientId: 1, status: 1, createdAt: -1 });
dispenseSessionSchema.index({ dispenserId: 1, status: 1, createdAt: -1 });

// Método estático: Crear nueva sesión
dispenseSessionSchema.statics.createSession = async function(patientId, prescriptionId, authMethod, patientInfo, medicineInfo, metadata = {}) {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 90 * 1000); // 90 segundos

  // Cancelar sesiones pendientes anteriores del mismo paciente
  await this.updateMany(
    { patientId, status: 'pending' },
    { status: 'cancelled' }
  );

  const session = await this.create({
    sessionId,
    patientId,
    prescriptionId,
    status: 'pending',
    authMethod,
    patientInfo,
    medicineInfo,
    expiresAt,
    metadata
  });

  return session;
};

// Método estático: Obtener sesión pendiente para un dispensador
dispenseSessionSchema.statics.getPendingSession = async function(dispenserId = 'dispenser-01') {
  const now = new Date();

  // Buscar la sesión pendiente más reciente que no haya expirado
  const session = await this.findOne({
    dispenserId,
    status: 'pending',
    expiresAt: { $gt: now }
  })
  .sort({ createdAt: -1 })
  .populate('patientId', 'name cedula qrCode')
  .populate('prescriptionId', 'medicine dosage');

  return session;
};

// Método estático: Confirmar dispensación
dispenseSessionSchema.statics.confirmDispense = async function(sessionId) {
  const session = await this.findOne({ sessionId });

  if (!session) {
    throw new Error('Sesión no encontrada');
  }

  if (session.status !== 'pending') {
    throw new Error(`Sesión ya está en estado: ${session.status}`);
  }

  if (session.expiresAt < new Date()) {
    session.status = 'expired';
    await session.save();
    throw new Error('Sesión expirada');
  }

  session.status = 'dispensed';
  session.dispensedAt = new Date();
  await session.save();

  return session;
};

// Método de instancia: Verificar si está expirada
dispenseSessionSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Método de instancia: Tiempo restante en segundos
dispenseSessionSchema.methods.getTimeRemaining = function() {
  const remaining = Math.floor((this.expiresAt - new Date()) / 1000);
  return Math.max(0, remaining);
};

// Hook pre-save: Expirar sesiones automáticamente
dispenseSessionSchema.pre('save', function(next) {
  if (this.status === 'pending' && this.isExpired()) {
    this.status = 'expired';
  }
  next();
});

// Función auxiliar: Generar ID de sesión único
function generateSessionId() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `sess_${timestamp}_${randomStr}`;
}

// Método estático para limpiar sesiones expiradas (tarea programada)
dispenseSessionSchema.statics.cleanupExpiredSessions = async function() {
  const now = new Date();
  
  const result = await this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: now }
    },
    {
      status: 'expired'
    }
  );

  return result;
};

const DispenseSession = mongoose.model('DispenseSession', dispenseSessionSchema);

module.exports = DispenseSession;

