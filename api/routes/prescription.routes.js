/**
 * Rutas de Administración de Prescripciones
 *
 * Endpoints para crear y gestionar prescripciones médicas
 */

const express = require('express')
const router = express.Router()
const Prescription = require('../models/Prescription')
const Patient = require('../models/Patient')

/**
 * POST /api/prescriptions
 * Crea una nueva prescripción médica
 *
 * Body: {
 *   patientCedula: "1002643012",  // Busca por cédula
 *   medicineName: "Paracetamol 500mg",
 *   dosage: { amount: 1, unit: "tabletas" },
 *   frequency: { times: 3, period: "diario" },
 *   maxDailyDoses: 3,
 *   durationDays: 30,
 *   doctorName: "Dr. García",
 *   doctorLicense: "MED-12345"
 * }
 */
router.post('/prescriptions', async (req, res) => {
  try {
    const {
      patientCedula,
      patientId,
      medicineName,
      medicineCode,
      dosage,
      frequency,
      maxDailyDoses,
      durationDays = 30,
      doctorName,
      doctorLicense,
      doctorSpecialty,
      notes
    } = req.body

    // Validar datos requeridos
    if (!medicineName || !dosage || !frequency || !maxDailyDoses) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos requeridos de la prescripción'
      })
    }

    if (!doctorName || !doctorLicense) {
      return res.status(400).json({
        success: false,
        message: 'Los datos del médico son requeridos'
      })
    }

    // Buscar paciente (por cédula o ID)
    let patient
    if (patientCedula) {
      patient = await Patient.findOne({ cedula: patientCedula, active: true })
    } else if (patientId) {
      patient = await Patient.findById(patientId)
    }

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      })
    }

    // Verificar si ya tiene prescripción activa para el mismo medicamento
    const existingPrescription = await Prescription.findOne({
      patient: patient._id,
      medicineName: medicineName,
      status: 'activa',
      endDate: { $gt: new Date() }
    })

    if (existingPrescription) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una prescripción activa para este medicamento',
        prescription: {
          id: existingPrescription._id,
          medicine: existingPrescription.medicineName,
          endDate: existingPrescription.endDate
        }
      })
    }

    // Calcular fechas
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + durationDays)

    // Crear prescripción
    const prescription = new Prescription({
      patient: patient._id,
      medicineName,
      medicineCode: medicineCode || '',
      dosage: {
        amount: dosage.amount || 1,
        unit: dosage.unit || 'tabletas'
      },
      frequency: {
        times: frequency.times || 1,
        period: frequency.period || 'diario'
      },
      maxDailyDoses,
      doctor: {
        name: doctorName,
        license: doctorLicense,
        specialty: doctorSpecialty || ''
      },
      startDate,
      endDate,
      status: 'activa',
      notes: notes || ''
    })

    await prescription.save()

    console.log('Prescription created:', prescription._id)

    // Respuesta exitosa
    res.status(201).json({
      success: true,
      message: 'Prescripción creada exitosamente',
      prescription: {
        id: prescription._id,
        patient: patient.fullName,
        patientCedula: patient.cedula,
        medicine: prescription.medicineName,
        dosage: `${prescription.dosage.amount} ${prescription.dosage.unit}`,
        frequency: `${prescription.frequency.times} veces ${prescription.frequency.period}`,
        maxDailyDoses: prescription.maxDailyDoses,
        startDate: prescription.startDate,
        endDate: prescription.endDate,
        doctor: prescription.doctor.name,
        status: prescription.status
      }
    })

  } catch (error) {
    console.error('Error creating prescription:', error)

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message)
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors
      })
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
})

/**
 * GET /api/prescriptions/patient/:cedula
 * Obtiene las prescripciones de un paciente por cédula
 */
router.get('/prescriptions/patient/:cedula', async (req, res) => {
  try {
    const { cedula } = req.params

    const patient = await Patient.findOne({ cedula })
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      })
    }

    const prescriptions = await Prescription.find({ patient: patient._id })
      .sort({ createdAt: -1 })
      .limit(50)

    res.json({
      success: true,
      count: prescriptions.length,
      prescriptions: prescriptions.map(p => ({
        id: p._id,
        medicine: p.medicineName,
        dosage: `${p.dosage.amount} ${p.dosage.unit}`,
        frequency: `${p.frequency.times} veces ${p.frequency.period}`,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        daysRemaining: p.daysRemaining
      }))
    })

  } catch (error) {
    console.error('Error fetching prescriptions:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
})

module.exports = router

