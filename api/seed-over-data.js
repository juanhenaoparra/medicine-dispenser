/**
 * Script para crear tu perfil personal de prueba
 * 
 * Usuario: Over Valencia
 * Cédula: 1002643012
 * 
 * Uso: node seed-over-data.js
 */

const mongoose = require('mongoose')
require('dotenv').config()

const Patient = require('./models/Patient')
const Prescription = require('./models/Prescription')

const overData = {
  patient: {
    cedula: '1002643012',
    firstName: 'Over',
    lastName: 'Valencia',
    phone: '3001234567',
    email: 'over.valencia@example.com'
  },
  prescription: {
    medicineName: 'Paracetamol 500mg',
    medicineCode: 'PAR500',
    dosage: {
      amount: 1,
      unit: 'tabletas'
    },
    frequency: {
      times: 3,
      period: 'diario'
    },
    maxDailyDoses: 3,
    doctor: {
      name: 'Dr. Juan Henao',
      license: 'MED-UC-2025',
      specialty: 'Medicina General'
    },
    notes: 'Tomar después de las comidas con agua'
  }
}

async function seedOverData() {
  try {
    console.log('Conectando a MongoDB Atlas...')
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    console.log('✅ Conectado a MongoDB Atlas\n')

    console.log('Limpiando datos existentes...')
    await Patient.deleteOne({ cedula: overData.patient.cedula })
    console.log('✅ Datos limpiados\n')

    console.log('Creando perfil de Over Valencia...')
    const patient = new Patient(overData.patient)
    patient.generateQRCode()
    await patient.save()
    
    console.log('✅ Paciente creado:')
    console.log(`   ID: ${patient._id}`)
    console.log(`   Nombre: ${patient.fullName}`)
    console.log(`   Cédula: ${patient.cedula}`)
    console.log(`   QR Code: ${patient.qrCode}\n`)

    console.log('Creando prescripción...')
    const prescription = new Prescription({
      patient: patient._id,
      ...overData.prescription,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 días
    })
    await prescription.save()
    
    console.log('✅ Prescripción creada:')
    console.log(`   ID: ${prescription._id}`)
    console.log(`   Medicamento: ${prescription.medicineName}`)
    console.log(`   Dosis: ${prescription.dosage.amount} ${prescription.dosage.unit}`)
    console.log(`   Frecuencia: ${prescription.frequency.times} veces ${prescription.frequency.period}`)
    console.log(`   Límite diario: ${prescription.maxDailyDoses} dosis`)
    console.log(`   Válida hasta: ${prescription.endDate.toLocaleDateString()}\n`)

    console.log('='.repeat(60))
    console.log('🎉 PERFIL DE OVER VALENCIA CREADO EXITOSAMENTE')
    console.log('='.repeat(60))
    console.log('\n📋 Para probar la aplicación:')
    console.log(`   1. Abre mobile-app/index-standalone.html`)
    console.log(`   2. Selecciona "Cédula"`)
    console.log(`   3. Toma foto de tu cédula (${overData.patient.cedula})`)
    console.log(`   4. Deberías ver: "✅ Autorizado!"`)
    console.log('\n💡 Datos de tu cuenta:')
    console.log(`   Nombre: ${patient.fullName}`)
    console.log(`   Cédula: ${patient.cedula}`)
    console.log(`   QR Code: ${patient.qrCode}`)
    console.log(`   Medicamento: ${prescription.medicineName}`)
    console.log(`   Dosis permitidas hoy: ${prescription.maxDailyDoses}\n`)

    process.exit(0)

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

seedOverData()

