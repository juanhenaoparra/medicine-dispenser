/**
 * Rutas de Sesiones de Dispensación
 *
 * Maneja el flujo de autorización sin ESP32-CAM:
 * 1. Usuario captura imagen desde móvil
 * 2. API valida y crea sesión temporal
 * 3. Dispensador consulta sesiones pendientes
 * 4. Dispensador confirma dispensación
 */

const express = require('express');
const router = express.Router();

const sessionRepo = require('../repositories/session.repository');
const dispenseRepo = require('../repositories/dispense.repository');
const qrService = require('../services/qr.service');
const ocrService = require('../services/ocr.service');
const prescriptionService = require('../services/prescription.service');

/**
 * POST /api/request-dispense
 * Crea una sesión de autorización después de validar la imagen
 */
router.post('/request-dispense', async (req, res) => {
  const startTime = Date.now();

  try {
    const { image, method, dispenserId = 'dispenser-01' } = req.body;

    // Validaciones
    if (!image) {
      return res.status(400).json({
        success: false,
        authorized: false,
        reason: 'Imagen no proporcionada'
      });
    }

    if (!method || !['qr', 'cedula'].includes(method)) {
      return res.status(400).json({
        success: false,
        authorized: false,
        reason: 'Método de autenticación inválido'
      });
    }

    let identifier;
    let processResult;

    // Procesar según el método
    if (method === 'qr') {
      console.log('Processing QR image for session...');
      processResult = await qrService.processQRImage(image);

      if (!processResult.success) {
        return res.status(200).json({
          success: false,
          authorized: false,
          reason: processResult.error || 'No se pudo leer código QR'
        });
      }

      identifier = processResult.qrCode;
      console.log('QR Code detected:', identifier);

    } else if (method === 'cedula') {
      console.log('Processing cedula image with OCR for session...');
      processResult = await ocrService.processCedulaImage(image);

      if (!processResult.success) {
        return res.status(200).json({
          success: false,
          authorized: false,
          reason: processResult.error || 'No se pudo leer cédula'
        });
      }

      identifier = processResult.cedula;
      console.log('Cedula detected:', identifier);
      if (processResult.fullName) {
        console.log('Full name detected:', processResult.fullName);
      }
    }

    // Validar con el servicio de prescripciones
    const validationResult = await prescriptionService.validatePatientDispense(
      identifier,
      method
    );

    const responseTime = Date.now() - startTime;

    // Si no está autorizado, no crear sesión
    if (!validationResult.authorized) {
      await prescriptionService.registerFailedAttempt(
        identifier,
        method,
        method,
        validationResult.reason,
        {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          responseTime
        }
      );

      return res.status(200).json({
        success: false,
        authorized: false,
        reason: validationResult.reason,
        cedula: method === 'cedula' ? identifier : undefined,
        fullName: (method === 'cedula' && processResult.fullName) ? processResult.fullName : undefined,
        needsPrescription: validationResult.needsPrescription || false,
        patient: validationResult.patient || undefined
      });
    }

    // Crear sesión de dispensación
    const session = sessionRepo.createSession({
      patientId: validationResult.patient.id,
      prescriptionId: validationResult.prescription.id,
      authMethod: method,
      patientInfo: {
        name: validationResult.patient.name,
        cedula: validationResult.patient.cedula,
        qrCode: validationResult.patient.qrCode
      },
      medicineInfo: {
        name: validationResult.prescription.medicine,
        dosage: validationResult.prescription.dosage
      },
      dispenserId,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        deviceInfo: req.get('user-agent')
      }
    });

    console.log('Session created:', session.sessionId);

    // Respuesta exitosa
    res.status(200).json({
      success: true,
      authorized: true,
      sessionId: session.sessionId,
      expiresIn: session.timeRemaining,
      patient: validationResult.patient.name,
      medicine: validationResult.prescription.medicine,
      dosage: validationResult.prescription.dosage,
      remaining: validationResult.dispenseInfo.remaining,
      message: 'Autorizado. Presiona el botón en el dispensador dentro de 90 segundos.'
    });

  } catch (error) {
    console.error('Error in request-dispense:', error);
    res.status(500).json({
      success: false,
      authorized: false,
      reason: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/check-pending/:dispenserId
 * Consulta si hay una sesión pendiente para el dispensador
 */
router.get('/check-pending/:dispenserId?', async (req, res) => {
  try {
    const dispenserId = req.params.dispenserId || 'dispenser-01';

    // Limpiar sesiones expiradas primero
    sessionRepo.cleanupExpiredSessions();

    // Buscar sesión pendiente
    const session = sessionRepo.getPendingSession(dispenserId);

    if (!session) {
      return res.status(200).json({
        hasPending: false,
        message: 'No hay sesiones pendientes'
      });
    }

    // Verificar si ya expiró
    if (session.isExpired) {
      return res.status(200).json({
        hasPending: false,
        message: 'Sesión expirada'
      });
    }

    // Retornar información de la sesión
    res.status(200).json({
      hasPending: true,
      sessionId: session.sessionId,
      patient: session.patientInfo.name,
      medicine: session.medicineInfo.name,
      dosage: session.medicineInfo.dosage,
      timeRemaining: session.timeRemaining,
      authMethod: session.authMethod
    });

  } catch (error) {
    console.error('Error in check-pending:', error);
    res.status(500).json({
      hasPending: false,
      error: 'Error consultando sesiones'
    });
  }
});

/**
 * POST /api/confirm-dispense/:sessionId
 * Confirma que el medicamento fue dispensado
 */
router.post('/confirm-dispense/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { dispenserId = 'dispenser-01' } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID requerido'
      });
    }

    // Get session before confirming
    const session = sessionRepo.findBySessionId(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
    }

    if (session.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Sesión en estado ${session.status}, no se puede confirmar`
      });
    }

    // Confirm the session
    sessionRepo.confirmDispense(sessionId);

    // Create dispense record
    const dispenseRecord = dispenseRepo.create({
      patientId: session.patientId,
      prescriptionId: session.prescriptionId,
      authMethod: session.authMethod,
      medicine: {
        name: session.medicineInfo.name,
        dosage: session.medicineInfo.dosage ? {
          amount: parseFloat(session.medicineInfo.dosage.split(' ')[0]),
          unit: session.medicineInfo.dosage.split(' ')[1]
        } : null
      },
      dispenserId,
      status: 'exitosa',
      metadata: {
        notes: `Session ID: ${session.sessionId}`
      }
    });

    console.log('Dispense confirmed:', dispenseRecord.id);

    res.status(200).json({
      success: true,
      message: 'Dispensación confirmada y registrada',
      dispenseId: dispenseRecord.id,
      sessionId: session.sessionId
    });

  } catch (error) {
    console.error('Error in confirm-dispense:', error);

    res.status(500).json({
      success: false,
      message: 'Error confirmando dispensación'
    });
  }
});

/**
 * GET /api/session/:sessionId
 * Obtiene el estado de una sesión específica
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = sessionRepo.findBySessionId(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
    }

    res.status(200).json({
      success: true,
      sessionId: session.sessionId,
      status: session.status,
      timeRemaining: session.timeRemaining,
      patient: session.patientInfo.name,
      medicine: session.medicineInfo.name,
      dosage: session.medicineInfo.dosage,
      authMethod: session.authMethod,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      dispensedAt: session.dispensedAt
    });

  } catch (error) {
    console.error('Error in get session:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo sesión'
    });
  }
});

/**
 * DELETE /api/session/:sessionId
 * Cancela una sesión (útil si el usuario cambia de opinión)
 */
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = sessionRepo.findBySessionId(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
    }

    if (session.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `No se puede cancelar sesión en estado: ${session.status}`
      });
    }

    sessionRepo.cancelSession(sessionId);

    res.status(200).json({
      success: true,
      message: 'Sesión cancelada'
    });

  } catch (error) {
    console.error('Error cancelling session:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelando sesión'
    });
  }
});

module.exports = router;
