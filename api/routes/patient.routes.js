/**
 * Rutas de Administración de Pacientes
 *
 * Endpoints para crear y gestionar pacientes
 */

const express = require('express')
const router = express.Router()
const patientRepo = require('../repositories/patient.repository')

/**
 * POST /api/patients
 * Crea un nuevo paciente en el sistema
 *
 * Body: {
 *   cedula: "1002643012",
 *   name: "Over Valencia",  // O firstName/lastName separados
 *   phone: "3001234567",
 *   email: "over@example.com" (opcional)
 * }
 */
router.post('/patients', async (req, res) => {
  try {
    const { cedula, name, firstName, lastName, phone, email } = req.body

    // Validar cédula requerida
    if (!cedula) {
      return res.status(400).json({
        success: false,
        message: 'La cédula es requerida'
      })
    }

    // Verificar si el paciente ya existe
    const existing = await patientRepo.findByCedula(cedula)
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un paciente con esta cédula',
        patient: {
          id: existing.id,
          cedula: existing.cedula,
          name: existing.fullName
        }
      })
    }

    // Determinar firstName y lastName
    let patientFirstName, patientLastName

    if (name && !firstName && !lastName) {
      // Si solo envían "name", dividir en primer y último nombre
      const nameParts = name.trim().split(' ')
      patientFirstName = nameParts[0]
      patientLastName = nameParts.slice(1).join(' ') || patientFirstName
    } else {
      patientFirstName = firstName
      patientLastName = lastName
    }

    // Validar que tengamos nombres
    if (!patientFirstName || !patientLastName) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del paciente es requerido'
      })
    }

    // Crear paciente con repositorio
    const patient = await patientRepo.create({
      cedula,
      firstName: patientFirstName,
      lastName: patientLastName,
      phone: phone || '',
      email: email || ''
    })

    console.log('Patient created:', patient.cedula)

    // Respuesta exitosa
    res.status(201).json({
      success: true,
      message: 'Paciente creado exitosamente',
      patient: {
        id: patient.id,
        cedula: patient.cedula,
        name: patient.fullName,
        qrCode: patient.qrCode,
        phone: patient.phone,
        email: patient.email,
        registeredAt: patient.registeredAt
      }
    })

  } catch (error) {
    console.error('Error creating patient:', error)

    // Error de constraint de SQLite
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación de datos',
        details: error.message
      })
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
})

/**
 * GET /api/patients/:cedula
 * Busca un paciente por cédula
 */
router.get('/patients/:cedula', async (req, res) => {
  try {
    const { cedula } = req.params

    const patient = await patientRepo.findActiveByCedula(cedula)

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      })
    }

    res.json({
      success: true,
      patient: {
        id: patient.id,
        cedula: patient.cedula,
        name: patient.fullName,
        qrCode: patient.qrCode,
        phone: patient.phone,
        email: patient.email,
        registeredAt: patient.registeredAt
      }
    })

  } catch (error) {
    console.error('Error fetching patient:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
})

/**
 * GET /api/patients
 * Lista todos los pacientes activos
 */
router.get('/patients', async (req, res) => {
  try {
    const patients = await patientRepo.findAll()

    res.json({
      success: true,
      count: patients.length,
      patients: patients.map(p => ({
        id: p.id,
        cedula: p.cedula,
        name: p.fullName,
        phone: p.phone,
        registeredAt: p.registeredAt
      }))
    })

  } catch (error) {
    console.error('Error listing patients:', error)
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    })
  }
})

module.exports = router

