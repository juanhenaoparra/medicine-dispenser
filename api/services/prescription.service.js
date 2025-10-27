/**
 * Servicio de Validación de Prescripciones
 *
 * Maneja la lógica de validación de prescripciones, dosis diarias y autorización
 */

const Patient = require('../models/Patient');
const Prescription = require('../models/Prescription');
const Dispense = require('../models/Dispense');

class PrescriptionService {
  /**
   * Valida si un paciente puede recibir medicamento
   * @param {string} identifier - Cédula o código QR del paciente
   * @param {string} identifierType - 'cedula' o 'qr'
   * @returns {Promise<object>} - Resultado de la validación
   */
  async validatePatientDispense(identifier, identifierType = 'cedula') {
    try {
      // 1. Buscar paciente
      const patient = await this.findPatient(identifier, identifierType);

      if (!patient) {
        return {
          authorized: false,
          reason: 'Paciente no encontrado'
        };
      }

      // 2. Verificar que el paciente esté activo
      if (!patient.isActive()) {
        return {
          authorized: false,
          reason: 'Paciente inactivo'
        };
      }

      // 3. Buscar prescripción activa
      const prescription = await this.findActivePrescription(patient._id);

      if (!prescription) {
        return {
          authorized: false,
          reason: 'No tiene prescripción activa'
        };
      }

      // 4. Verificar validez de la prescripción
      const validityCheck = prescription.checkValidity();

      if (!validityCheck.valid) {
        return {
          authorized: false,
          reason: validityCheck.reason
        };
      }

      // 5. Verificar límite de dosis diarias y cooldown
      const cooldownMinutes = parseInt(process.env.DISPENSE_COOLDOWN_MINUTES) || 30;
      const canDispenseCheck = await Dispense.canDispense(
        patient._id,
        prescription._id,
        prescription.maxDailyDoses,
        cooldownMinutes
      );

      if (!canDispenseCheck.canDispense) {
        return {
          authorized: false,
          reason: canDispenseCheck.reason,
          dailyCount: canDispenseCheck.dailyCount,
          maxDailyDoses: canDispenseCheck.maxDailyDoses,
          minutesRemaining: canDispenseCheck.minutesRemaining,
          lastDispensedAt: canDispenseCheck.lastDispensedAt
        };
      }

      // 6. Todo validado correctamente
      return {
        authorized: true,
        patient: {
          id: patient._id,
          name: patient.fullName,
          cedula: patient.cedula
        },
        prescription: {
          id: prescription._id,
          medicine: prescription.medicineName,
          dosage: `${prescription.dosage.amount} ${prescription.dosage.unit}`,
          maxDailyDoses: prescription.maxDailyDoses,
          daysRemaining: prescription.daysRemaining
        },
        dispenseInfo: {
          dailyCount: canDispenseCheck.dailyCount,
          remaining: prescription.maxDailyDoses - canDispenseCheck.dailyCount
        }
      };

    } catch (error) {
      console.error('Error validating patient dispense:', error);
      return {
        authorized: false,
        reason: 'Error interno del servidor',
        error: error.message
      };
    }
  }

  /**
   * Busca un paciente por cédula o código QR
   * @param {string} identifier - Identificador
   * @param {string} type - 'cedula' o 'qr'
   * @returns {Promise<object>} - Paciente encontrado
   */
  async findPatient(identifier, type = 'cedula') {
    try {
      if (type === 'cedula') {
        return await Patient.findOne({ cedula: identifier, active: true });
      } else if (type === 'qr') {
        return await Patient.findOne({ qrCode: identifier, active: true });
      }
      return null;
    } catch (error) {
      console.error('Error finding patient:', error);
      throw error;
    }
  }

  /**
   * Busca la prescripción activa más reciente de un paciente
   * @param {string} patientId - ID del paciente
   * @returns {Promise<object>} - Prescripción encontrada
   */
  async findActivePrescription(patientId) {
    try {
      const now = new Date();

      return await Prescription.findOne({
        patient: patientId,
        status: 'activa',
        startDate: { $lte: now },
        endDate: { $gte: now }
      })
      .sort({ startDate: -1 })
      .limit(1);

    } catch (error) {
      console.error('Error finding active prescription:', error);
      throw error;
    }
  }

  /**
   * Registra una dispensación exitosa
   * @param {object} validationResult - Resultado de la validación
   * @param {string} authMethod - 'qr' o 'cedula'
   * @param {object} metadata - Información adicional
   * @returns {Promise<object>} - Dispensación registrada
   */
  async registerDispense(validationResult, authMethod, metadata = {}) {
    try {
      const dispense = new Dispense({
        patient: validationResult.patient.id,
        prescription: validationResult.prescription.id,
        authMethod: authMethod,
        medicine: {
          name: validationResult.prescription.medicine,
          dosage: {
            amount: parseFloat(validationResult.prescription.dosage.split(' ')[0]),
            unit: validationResult.prescription.dosage.split(' ')[1]
          }
        },
        status: 'exitosa',
        metadata: {
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          responseTime: metadata.responseTime,
          imageUrl: metadata.imageUrl,
          notes: metadata.notes
        }
      });

      await dispense.save();

      return {
        success: true,
        dispense: {
          id: dispense._id,
          dispensedAt: dispense.dispensedAt,
          medicine: dispense.medicine.name
        }
      };

    } catch (error) {
      console.error('Error registering dispense:', error);
      return {
        success: false,
        error: 'Error registrando dispensación',
        details: error.message
      };
    }
  }

  /**
   * Registra un intento fallido de dispensación
   * @param {string} identifier - Cédula o QR
   * @param {string} identifierType - Tipo de identificador
   * @param {string} authMethod - 'qr' o 'cedula'
   * @param {string} reason - Razón del fallo
   * @param {object} metadata - Información adicional
   * @returns {Promise<object>} - Resultado
   */
  async registerFailedAttempt(identifier, identifierType, authMethod, reason, metadata = {}) {
    try {
      // Intentar encontrar paciente y prescripción para registro
      const patient = await this.findPatient(identifier, identifierType);

      if (patient) {
        const prescription = await this.findActivePrescription(patient._id);

        const dispense = new Dispense({
          patient: patient._id,
          prescription: prescription ? prescription._id : null,
          authMethod: authMethod,
          medicine: {
            name: prescription ? prescription.medicineName : 'Desconocido'
          },
          status: 'fallida',
          error: {
            code: 'VALIDATION_FAILED',
            message: reason
          },
          metadata: {
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            responseTime: metadata.responseTime
          }
        });

        await dispense.save();
      }

      return { success: true };

    } catch (error) {
      console.error('Error registering failed attempt:', error);
      return { success: false };
    }
  }

  /**
   * Obtiene estadísticas de dispensación de un paciente
   * @param {string} patientId - ID del paciente
   * @param {number} days - Número de días a consultar (default: 30)
   * @returns {Promise<object>} - Estadísticas
   */
  async getPatientStats(patientId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const dispenses = await Dispense.find({
        patient: patientId,
        dispensedAt: { $gte: startDate }
      })
      .sort({ dispensedAt: -1 })
      .populate('prescription', 'medicineName');

      const total = dispenses.length;
      const successful = dispenses.filter(d => d.status === 'exitosa').length;
      const failed = dispenses.filter(d => d.status === 'fallida').length;

      return {
        total,
        successful,
        failed,
        successRate: total > 0 ? ((successful / total) * 100).toFixed(2) : 0,
        recentDispenses: dispenses.slice(0, 10)
      };

    } catch (error) {
      console.error('Error getting patient stats:', error);
      throw error;
    }
  }
}

module.exports = new PrescriptionService();
