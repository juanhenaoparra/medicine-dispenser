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

const DispenseSession = require('../models/DispenseSession');
const qrService = require('../services/qr.service');
const ocrService = require('../services/ocr.service');
const prescriptionService = require('../services/prescription.service');

/**
 * POST /api/request-dispense
 * Crea una sesión de autorización después de validar la imagen
 * 
 * Este endpoint reemplaza la funcionalidad del ESP32-CAM.
 * El usuario captura la imagen desde su smartphone y la envía aquí.
 * 
 * Body: { 
 *   image: "data:image/jpeg;base64,...",
 *   method: "qr" | "cedula",
 *   dispenserId: "dispenser-01" (opcional)
 * }
 * 
 * Response: {
 *   success: true,
 *   authorized: true,
 *   sessionId: "sess_...",
 *   expiresIn: 90,
 *   patient: "Nombre del paciente",
 *   medicine: "Nombre del medicamento",
 *   dosage: "Dosis",
 *   message: "Instrucciones para el usuario"
 * }
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
      console.log('SR: Cedula detected:', identifier);
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
        reason: validationResult.reason
      });
    }

    // Crear sesión de dispensación
    const session = await DispenseSession.createSession(
      validationResult.patient._id,
      validationResult.prescription._id,
      method,
      {
        name: validationResult.patient.name,
        cedula: validationResult.patient.cedula,
        qrCode: validationResult.patient.qrCode
      },
      {
        name: validationResult.prescription.medicine,
        dosage: validationResult.prescription.dosage
      },
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        deviceInfo: req.get('user-agent')
      }
    );

    session.dispenserId = dispenserId;
    await session.save();

    console.log('Session created:', session.sessionId);

    // Respuesta exitosa
    res.status(200).json({
      success: true,
      authorized: true,
      sessionId: session.sessionId,
      expiresIn: session.getTimeRemaining(),
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
 * 
 * Este endpoint es llamado por el ESP32 cuando el usuario presiona el botón.
 * Retorna la sesión pendiente más reciente que no haya expirado.
 * 
 * Params: dispenserId (default: "dispenser-01")
 * 
 * Response: {
 *   hasPending: true,
 *   sessionId: "sess_...",
 *   patient: "Nombre",
 *   medicine: "Medicamento",
 *   dosage: "Dosis",
 *   timeRemaining: 85
 * }
 */
router.get('/check-pending/:dispenserId?', async (req, res) => {
  try {
    const dispenserId = req.params.dispenserId || 'dispenser-01';

    // Limpiar sesiones expiradas primero
    await DispenseSession.cleanupExpiredSessions();

    // Buscar sesión pendiente
    const session = await DispenseSession.getPendingSession(dispenserId);

    if (!session) {
      return res.status(200).json({
        hasPending: false,
        message: 'No hay sesiones pendientes'
      });
    }

    // Verificar si ya expiró
    if (session.isExpired()) {
      session.status = 'expired';
      await session.save();

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
      timeRemaining: session.getTimeRemaining(),
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
 * 
 * Este endpoint es llamado por el Arduino después de dispensar exitosamente.
 * Marca la sesión como 'dispensed' y registra la dispensación en la base de datos.
 * 
 * Params: sessionId
 * Body: { 
 *   dispenserId: "dispenser-01" (opcional),
 *   timestamp: ISO string (opcional)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Dispensación confirmada",
 *   dispenseId: "..."
 * }
 */
router.post('/confirm-dispense/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { dispenserId = 'dispenser-01', timestamp } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID requerido'
      });
    }

    // Confirmar la sesión
    const session = await DispenseSession.confirmDispense(sessionId);

    // Registrar la dispensación en el modelo Dispense
    const Dispense = require('../models/Dispense');
    
    const dispenseRecord = await Dispense.create({
      patient: session.patientId,
      prescription: session.prescriptionId,
      medicine: session.medicineInfo.name,
      dosage: session.medicineInfo.dosage,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      method: session.authMethod,
      dispenserId,
      sessionId: session.sessionId,
      status: 'dispensed',
      metadata: {
        confirmedAt: new Date(),
        sessionCreatedAt: session.createdAt,
        sessionExpiredAt: session.expiresAt
      }
    });

    console.log('Dispense confirmed:', dispenseRecord._id);

    res.status(200).json({
      success: true,
      message: 'Dispensación confirmada y registrada',
      dispenseId: dispenseRecord._id,
      sessionId: session.sessionId
    });

  } catch (error) {
    console.error('Error in confirm-dispense:', error);
    
    // Errores específicos
    if (error.message.includes('no encontrada') || error.message.includes('expirada') || error.message.includes('estado')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error confirmando dispensación'
    });
  }
});

/**
 * GET /api/session/:sessionId
 * Obtiene el estado de una sesión específica
 * 
 * Útil para que la web app monitoree el estado de la sesión
 * 
 * Response: {
 *   sessionId: "...",
 *   status: "pending" | "dispensed" | "expired" | "cancelled",
 *   timeRemaining: 45,
 *   ...
 * }
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await DispenseSession.findOne({ sessionId })
      .populate('patientId', 'name')
      .populate('prescriptionId', 'medicine dosage');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
    }

    // Actualizar estado si expiró
    if (session.status === 'pending' && session.isExpired()) {
      session.status = 'expired';
      await session.save();
    }

    res.status(200).json({
      success: true,
      sessionId: session.sessionId,
      status: session.status,
      timeRemaining: session.getTimeRemaining(),
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

    const session = await DispenseSession.findOne({ sessionId });

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

    session.status = 'cancelled';
    await session.save();

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

