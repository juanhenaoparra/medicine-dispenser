/**
 * Rutas de Dispensación
 *
 * Endpoints para registrar dispensaciones y consultar historial
 */

const express = require('express');
const router = express.Router();

const prescriptionService = require('../services/prescription.service');
const dispenseRepo = require('../repositories/dispense.repository');
const patientRepo = require('../repositories/patient.repository');

/**
 * POST /api/dispense
 * Registra una dispensación exitosa
 *
 * Body: {
 *   identifier: "cedula o qrCode",
 *   identifierType: "cedula" | "qr",
 *   authMethod: "qr" | "cedula"
 * }
 */
router.post('/dispense', async (req, res) => {
  const startTime = Date.now();

  try {
    const { identifier, identifierType, authMethod } = req.body;

    // Validar parámetros
    if (!identifier || !identifierType || !authMethod) {
      return res.status(400).json({
        success: false,
        message: 'Parámetros faltantes'
      });
    }

    // Validar el paciente y prescripción nuevamente
    const validationResult = await prescriptionService.validatePatientDispense(
      identifier,
      identifierType
    );

    if (!validationResult.authorized) {
      return res.status(403).json({
        success: false,
        message: validationResult.reason
      });
    }

    // Registrar dispensación
    const responseTime = Date.now() - startTime;
    const dispenseResult = await prescriptionService.registerDispense(
      validationResult,
      authMethod,
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        responseTime
      }
    );

    if (!dispenseResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error registrando dispensación'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Dispensación registrada exitosamente',
      dispense: dispenseResult.dispense
    });

  } catch (error) {
    console.error('Error in dispense:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/patient/:identifier/history
 * Obtiene el historial de dispensaciones de un paciente
 *
 * Query params:
 *   - type: "cedula" | "qr" (default: cedula)
 *   - limit: número de registros (default: 50)
 */
router.get('/patient/:identifier/history', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { type = 'cedula', limit = 50 } = req.query;

    // Buscar paciente
    const patient = await prescriptionService.findPatient(identifier, type);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Obtener historial
    const dispenses = await dispenseRepo.findByPatientId(patient.id, parseInt(limit));

    res.status(200).json({
      success: true,
      patient: {
        name: patient.fullName,
        cedula: patient.cedula
      },
      count: dispenses.length,
      dispenses
    });

  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo historial'
    });
  }
});

/**
 * GET /api/patient/:identifier/stats
 * Obtiene estadísticas de dispensación de un paciente
 *
 * Query params:
 *   - type: "cedula" | "qr" (default: cedula)
 *   - days: número de días (default: 30)
 */
router.get('/patient/:identifier/stats', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { type = 'cedula', days = 30 } = req.query;

    // Buscar paciente
    const patient = await prescriptionService.findPatient(identifier, type);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Obtener estadísticas
    const stats = await prescriptionService.getPatientStats(patient.id, parseInt(days));

    res.status(200).json({
      success: true,
      patient: {
        name: patient.fullName,
        cedula: patient.cedula
      },
      period: `${days} días`,
      stats
    });

  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas'
    });
  }
});

/**
 * GET /api/dispenses/recent
 * Obtiene las dispensaciones más recientes (todas los pacientes)
 *
 * Query params:
 *   - limit: número de registros (default: 20)
 */
router.get('/dispenses/recent', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const dispenses = await dispenseRepo.findRecent(parseInt(limit));

    res.status(200).json({
      success: true,
      count: dispenses.length,
      dispenses
    });

  } catch (error) {
    console.error('Error getting recent dispenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo dispensaciones'
    });
  }
});

/**
 * GET /api/dispenses/today
 * Obtiene las dispensaciones del día actual
 */
router.get('/dispenses/today', async (req, res) => {
  try {
    const dispenses = await dispenseRepo.findToday();

    const successful = dispenses.filter(d => d.status === 'exitosa').length;
    const failed = dispenses.filter(d => d.status === 'fallida').length;

    res.status(200).json({
      success: true,
      date: new Date().toISOString().split('T')[0],
      summary: {
        total: dispenses.length,
        successful,
        failed
      },
      dispenses
    });

  } catch (error) {
    console.error('Error getting today dispenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo dispensaciones del día'
    });
  }
});

module.exports = router;
