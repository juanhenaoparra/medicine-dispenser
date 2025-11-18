/**
 * Script para crear datos de prueba en MongoDB
 * 
 * Uso: node seed-test-data.js
 */

const mongoose = require('mongoose')
require('dotenv').config()

const Patient = require('./models/Patient')
const Prescription = require('./models/Prescription')

const testData = {
  patient: {
    cedula: '1002643012',
    firstName: 'Over',
    lastName: 'Valencia',
    phone: '3001234567',
    email: 'over.valencia@test.com'
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
      name: 'Dra. María Sánchez',
      license: 'MED-12345',
      specialty: 'Medicina General'
    },
    notes: 'Tomar después de las comidas con agua'
  }
}

async function seedTestData() {
  try {
    // Conectar a MongoDB
    console.log('Conectando a MongoDB...')
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/medicine-dispenser',
      {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }
    )
    console.log('✅ Conectado a MongoDB\n')

    // Limpiar datos existentes (opcional)
    console.log('Limpiando datos de prueba existentes...')
    await Patient.deleteOne({ cedula: testData.patient.cedula })
    console.log('✅ Datos limpiados\n')

    // Crear paciente
    console.log('Creando paciente de prueba...')
    const patient = new Patient(testData.patient)
    patient.generateQRCode()
    await patient.save()
    
    console.log('✅ Paciente creado:')
    console.log(`   ID: ${patient._id}`)
    console.log(`   Nombre: ${patient.fullName}`)
    console.log(`   Cédula: ${patient.cedula}`)
    console.log(`   QR Code: ${patient.qrCode}\n`)

    // Crear prescripción
    console.log('Creando prescripción de prueba...')
    const prescription = new Prescription({
      patient: patient._id,
      ...testData.prescription,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 días
    })
    await prescription.save()
    
    console.log('✅ Prescripción creada:')
    console.log(`   ID: ${prescription._id}`)
    console.log(`   Medicamento: ${prescription.medicineName}`)
    console.log(`   Dosis: ${prescription.dosage.amount} ${prescription.dosage.unit}`)
    console.log(`   Frecuencia: ${prescription.frequency.times} veces ${prescription.frequency.period}`)
    console.log(`   Válida hasta: ${prescription.endDate.toLocaleDateString()}\n`)

    // Resumen
    console.log('='.repeat(60))
    console.log('🎉 DATOS DE PRUEBA CREADOS EXITOSAMENTE')
    console.log('='.repeat(60))
    console.log('\n📋 Para probar la aplicación:')
    console.log(`   1. Abre mobile-app/index-standalone.html`)
    console.log(`   2. Selecciona "Cédula"`)
    console.log(`   3. Usa una imagen con el número: ${testData.patient.cedula}`)
    console.log(`   4. O usa el QR code: ${patient.qrCode}`)
    console.log('\n💊 Deberías ver autorización para dispensar\n')

    process.exit(0)

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Ejecutar
seedTestData()

