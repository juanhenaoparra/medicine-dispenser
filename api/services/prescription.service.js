/**
 * Servicio de Validación de Prescripciones
 *
 * Maneja la lógica de validación de prescripciones, dosis diarias y autorización
 */

const patientRepo = require('../repositories/patient.repository');
const prescriptionRepo = require('../repositories/prescription.repository');
const dispenseRepo = require('../repositories/dispense.repository');

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
      if (!patient.active) {
        return {
          authorized: false,
          reason: 'Paciente inactivo'
        };
      }

      // 3. Buscar prescripción activa
      const prescription = await this.findActivePrescription(patient.id);

      if (!prescription) {
        return {
          authorized: false,
          reason: 'No tiene prescripción activa',
          patient: {
            id: patient.id,
            cedula: patient.cedula,
            name: patient.fullName
          },
          needsPrescription: true
        };
      }

      // 4. Verificar validez de la prescripción
      const validityCheck = prescriptionRepo.checkValidity(prescription.id);

      if (!validityCheck.valid) {
        return {
          authorized: false,
          reason: validityCheck.reason
        };
      }

      // 5. Verificar límite de dosis diarias y cooldown
      const cooldownMinutes = parseInt(process.env.DISPENSE_COOLDOWN_MINUTES) || 30;
      const canDispenseCheck = dispenseRepo.canDispense(
        patient.id,
        prescription.id,
        prescription.maxDailyDoses,
        cooldownMinutes
      );

      if (!canDispenseCheck.authorized) {
        return {
          authorized: false,
          reason: canDispenseCheck.reason,
          dailyCount: canDispenseCheck.dailyCount,
          maxDailyDoses: canDispenseCheck.maxDailyDoses,
          minutesRemaining: canDispenseCheck.minutesRemaining
        };
      }

      // 6. Todo validado correctamente
      return {
        authorized: true,
        patient: {
          _id: patient.id,
          id: patient.id,
          name: patient.fullName,
          cedula: patient.cedula,
          qrCode: patient.qrCode
        },
        prescription: {
          _id: prescription.id,
          id: prescription.id,
          medicine: prescription.medicineName,
          dosage: `${prescription.dosage.amount} ${prescription.dosage.unit}`,
          maxDailyDoses: prescription.maxDailyDoses,
          daysRemaining: prescription.daysRemaining
        },
        dispenseInfo: {
          dailyCount: canDispenseCheck.dailyCount,
          remaining: canDispenseCheck.dosesRemaining
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
        return patientRepo.findActiveByCedula(identifier);
      } else if (type === 'qr') {
        return patientRepo.findActiveByQRCode(identifier);
      }
      return null;
    } catch (error) {
      console.error('Error finding patient:', error);
      throw error;
    }
  }

  /**
   * Busca la prescripción activa más reciente de un paciente
   * @param {number} patientId - ID del paciente
   * @returns {Promise<object>} - Prescripción encontrada
   */
  async findActivePrescription(patientId) {
    try {
      const prescriptions = prescriptionRepo.findActiveByPatientId(patientId);
      // findActiveByPatientId now returns an array, get the first one (most recent)
      return prescriptions.length > 0 ? prescriptions[0] : null;
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
      const dosageParts = validationResult.prescription.dosage.split(' ');

      const dispense = dispenseRepo.create({
        patientId: validationResult.patient.id,
        prescriptionId: validationResult.prescription.id,
        authMethod: authMethod,
        medicine: {
          name: validationResult.prescription.medicine,
          dosage: {
            amount: parseFloat(dosageParts[0]),
            unit: dosageParts[1]
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

      return {
        success: true,
        dispense: {
          id: dispense.id,
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
        const prescription = await this.findActivePrescription(patient.id);

        dispenseRepo.create({
          patientId: patient.id,
          prescriptionId: prescription ? prescription.id : null,
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
      const stats = dispenseRepo.getPatientStats(patientId);
      const history = dispenseRepo.getPatientHistory(patientId, { days, limit: 10 });

      const total = stats.totalDispenses;
      const successful = total - stats.failedAttempts;
      const failed = stats.failedAttempts;

      return {
        total,
        successful,
        failed,
        successRate: total > 0 ? ((successful / total) * 100).toFixed(2) : 0,
        recentDispenses: history
      };

    } catch (error) {
      console.error('Error getting patient stats:', error);
      throw error;
    }
  }
}

module.exports = new PrescriptionService();
