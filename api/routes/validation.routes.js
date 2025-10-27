/**
 * Rutas de Validación
 *
 * Endpoints para validar QR y cédulas
 */

const express = require('express');
const router = express.Router();

const qrService = require('../services/qr.service');
const ocrService = require('../services/ocr.service');
const prescriptionService = require('../services/prescription.service');

/**
 * POST /api/validate-qr
 * Valida un código QR y autoriza dispensación
 *
 * Body: { image: "data:image/jpeg;base64,..." }
 * Response: { authorized: boolean, patient: {...}, prescription: {...}, reason: string }
 */
router.post('/validate-qr', async (req, res) => {
  const startTime = Date.now();

  try {
    // Validar que se envió una imagen
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        authorized: false,
        reason: 'Imagen no proporcionada'
      });
    }

    // Procesar imagen QR
    console.log('Processing QR image...');
    const qrResult = await qrService.processQRImage(image);

    if (!qrResult.success) {
      return res.status(200).json({
        authorized: false,
        reason: qrResult.error || 'No se pudo leer código QR'
      });
    }

    console.log('QR Code detected:', qrResult.qrCode);

    // Validar con el servicio de prescripciones
    const validationResult = await prescriptionService.validatePatientDispense(
      qrResult.qrCode,
      'qr'
    );

    const responseTime = Date.now() - startTime;

    // Si no está autorizado, registrar intento fallido
    if (!validationResult.authorized) {
      await prescriptionService.registerFailedAttempt(
        qrResult.qrCode,
        'qr',
        'qr',
        validationResult.reason,
        {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          responseTime
        }
      );

      return res.status(200).json({
        authorized: false,
        reason: validationResult.reason
      });
    }

    // Autorizado - Preparar respuesta
    const response = {
      authorized: true,
      patient: validationResult.patient.name,
      medicine: validationResult.prescription.medicine,
      dosage: validationResult.prescription.dosage,
      remaining: validationResult.dispenseInfo.remaining,
      message: `Autorizado: ${validationResult.patient.name}`
    };

    console.log('Authorization successful:', response);

    res.status(200).json(response);

  } catch (error) {
    console.error('Error in validate-qr:', error);
    res.status(500).json({
      authorized: false,
      reason: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/validate-cedula
 * Valida una cédula colombiana mediante OCR y autoriza dispensación
 *
 * Body: { image: "data:image/jpeg;base64,..." }
 * Response: { authorized: boolean, patient: {...}, prescription: {...}, reason: string }
 */
router.post('/validate-cedula', async (req, res) => {
  const startTime = Date.now();

  try {
    // Validar que se envió una imagen
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        authorized: false,
        reason: 'Imagen no proporcionada'
      });
    }

    // Procesar imagen con OCR
    console.log('Processing cedula image with OCR...');
    const ocrResult = await ocrService.processCedulaImage(image);

    if (!ocrResult.success) {
      return res.status(200).json({
        authorized: false,
        reason: ocrResult.error || 'No se pudo leer cédula'
      });
    }

    console.log('Cedula detected:', ocrResult.cedula);

    // Validar con el servicio de prescripciones
    const validationResult = await prescriptionService.validatePatientDispense(
      ocrResult.cedula,
      'cedula'
    );

    const responseTime = Date.now() - startTime;

    // Si no está autorizado, registrar intento fallido
    if (!validationResult.authorized) {
      await prescriptionService.registerFailedAttempt(
        ocrResult.cedula,
        'cedula',
        'cedula',
        validationResult.reason,
        {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          responseTime
        }
      );

      return res.status(200).json({
        authorized: false,
        reason: validationResult.reason
      });
    }

    // Autorizado - Preparar respuesta
    const response = {
      authorized: true,
      patient: validationResult.patient.name,
      medicine: validationResult.prescription.medicine,
      dosage: validationResult.prescription.dosage,
      remaining: validationResult.dispenseInfo.remaining,
      message: `Autorizado: ${validationResult.patient.name}`
    };

    console.log('Authorization successful:', response);

    res.status(200).json(response);

  } catch (error) {
    console.error('Error in validate-cedula:', error);
    res.status(500).json({
      authorized: false,
      reason: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/test-qr/:qrCode
 * Endpoint de prueba para validar un código QR sin imagen
 * Solo para desarrollo
 */
if (process.env.NODE_ENV === 'development') {
  router.get('/test-qr/:qrCode', async (req, res) => {
    try {
      const { qrCode } = req.params;

      const validationResult = await prescriptionService.validatePatientDispense(
        qrCode,
        'qr'
      );

      res.status(200).json(validationResult);

    } catch (error) {
      console.error('Error in test-qr:', error);
      res.status(500).json({
        authorized: false,
        reason: 'Error interno del servidor'
      });
    }
  });

  /**
   * GET /api/test-cedula/:cedula
   * Endpoint de prueba para validar una cédula sin imagen
   * Solo para desarrollo
   */
  router.get('/test-cedula/:cedula', async (req, res) => {
    try {
      const { cedula } = req.params;

      const validationResult = await prescriptionService.validatePatientDispense(
        cedula,
        'cedula'
      );

      res.status(200).json(validationResult);

    } catch (error) {
      console.error('Error in test-cedula:', error);
      res.status(500).json({
        authorized: false,
        reason: 'Error interno del servidor'
      });
    }
  });
}

module.exports = router;
