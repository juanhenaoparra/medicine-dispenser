import { APIService } from './api.js'
import { CameraService } from './camera.js'
import { UIManager } from './ui.js'

class DispenserApp {
  constructor() {
    this.api = new APIService()
    this.camera = new CameraService()
    this.ui = new UIManager()
    
    this.currentMethod = null
    this.capturedImageData = null
    this.sessionId = null
    this.extractedCedula = null

    this.init()
  }

  init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js')
        .catch(err => console.log('SW registration failed:', err))
    }

    window.addEventListener('beforeunload', () => {
      this.cleanup()
    })

    window.app = this
  }

  async selectMethod(method) {
    this.currentMethod = method
    
    document.getElementById('btn-qr').classList.remove('active')
    document.getElementById('btn-cedula').classList.remove('active')
    document.getElementById(`btn-${method}`).classList.add('active')

    setTimeout(async () => {
      this.ui.showScreen('capture')
      this.ui.updateInstructions(method)
      
      try {
        await this.camera.start()
      } catch (error) {
        this.ui.showError(error.message)
      }
    }, 300)
  }

  captureImage() {
    this.capturedImageData = this.camera.capture()
    this.camera.showPreview()
    this.ui.showCaptureButtons(true)
    this.camera.stop()
  }

  async sendImage() {
    this.ui.showScreen('loading')

    try {
      const data = await this.api.requestDispense(
        this.capturedImageData,
        this.currentMethod
      )

      if (data.success && data.authorized) {
        this.sessionId = data.sessionId
        this.ui.showSuccess(data)
        this.monitorSession()
      } else {
        const isPatientNotFound = data.reason && 
          (data.reason.includes('Paciente no encontrado') || 
           data.reason.includes('no existe'))

        if (isPatientNotFound && data.cedula) {
          this.extractedCedula = data.cedula
          this.ui.showError(data.reason, { showRegisterButton: true })
        } else {
          this.ui.showError(data.reason || 'No autorizado')
        }
      }

    } catch (error) {
      console.error('Error sending image:', error)
      this.ui.showError('Error de conexión. Verifica que el servidor esté activo.')
    }
  }

  async monitorSession() {
    this.ui.startSessionMonitoring(this.sessionId, async (sessionId) => {
      const data = await this.api.getSessionStatus(sessionId)

      if (data.status === 'dispensed') {
        this.ui.stopSessionMonitoring()
        this.ui.clearCountdown()
        this.ui.showDispensedSuccess()
      } else if (data.status === 'expired' || data.status === 'cancelled') {
        this.ui.stopSessionMonitoring()
        this.ui.clearCountdown()
        this.ui.showError('Sesión expirada o cancelada')
      }
    })
  }

  showRegisterPatient() {
    this.ui.showScreen('register-patient')
    
    if (this.extractedCedula) {
      document.getElementById('cedula-input').value = this.extractedCedula
    }
  }

  async registerPatient(event) {
    event.preventDefault()
    
    const formData = {
      cedula: document.getElementById('cedula-input').value,
      name: document.getElementById('name-input').value,
      phone: document.getElementById('phone-input').value,
      email: document.getElementById('email-input').value
    }

    try {
      this.ui.showScreen('loading')
      
      await this.api.createPatient(formData)
      
      this.ui.showRegistrationSuccess(
        'Tu cuenta ha sido creada exitosamente. Ahora necesitas una prescripción médica para dispensar medicamentos.'
      )
      
    } catch (error) {
      console.error('Error registering patient:', error)
      this.ui.showError(error.message || 'Error al registrar paciente')
    }
  }

  cancelCapture() {
    this.camera.stop()
    this.reset()
  }

  reset() {
    this.camera.stop()
    this.ui.cleanup()

    this.currentMethod = null
    this.capturedImageData = null
    this.sessionId = null
    this.extractedCedula = null

    document.getElementById('btn-qr').classList.remove('active')
    document.getElementById('btn-cedula').classList.remove('active')
    this.camera.hidePreview()
    this.ui.showCaptureButtons(false)
    this.ui.showScreen('selection')
  }

  cleanup() {
    this.camera.stop()
    this.ui.cleanup()
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new DispenserApp()
})

