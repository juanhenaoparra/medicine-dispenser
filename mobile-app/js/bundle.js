// Bundled JavaScript - No modules, works with file:// protocol

// Configuration
const CONFIG = {
  API_BASE_URL: 'http://localhost:3000/api',
  DISPENSER_ID: 'dispenser-01',
  SESSION_TIMEOUT: 90,
  SESSION_CHECK_INTERVAL: 3000,
  CAMERA_CONFIG: {
    facingMode: 'environment',
    width: { ideal: 1280 },
    height: { ideal: 720 }
  }
}

// API Service
class APIService {
  constructor() {
    this.baseURL = CONFIG.API_BASE_URL
  }

  async requestDispense(imageData, method) {
    const response = await fetch(`${this.baseURL}/request-dispense`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: imageData,
        method: method,
        dispenserId: CONFIG.DISPENSER_ID
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Error en la solicitud')
    }

    return response.json()
  }

  async getSessionStatus(sessionId) {
    const response = await fetch(`${this.baseURL}/session/${sessionId}`)
    
    if (!response.ok) {
      throw new Error('Error obteniendo estado de sesión')
    }

    return response.json()
  }

  async createPatient(patientData) {
    const response = await fetch(`${this.baseURL}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(patientData)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Error creando paciente')
    }

    return response.json()
  }
}

// Camera Service
class CameraService {
  constructor() {
    this.stream = null
    this.video = document.getElementById('video')
    this.canvas = document.getElementById('canvas')
    this.preview = document.getElementById('preview')
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        video: CONFIG.CAMERA_CONFIG
      })
      this.video.srcObject = this.stream
      return true
    } catch (error) {
      console.error('Error accessing camera:', error)
      throw new Error('No se pudo acceder a la cámara. Verifica los permisos.')
    }
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
  }

  capture() {
    const context = this.canvas.getContext('2d')
    this.canvas.width = this.video.videoWidth
    this.canvas.height = this.video.videoHeight
    context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height)

    const imageData = this.canvas.toDataURL('image/jpeg', 0.9)
    this.preview.src = imageData
    
    return imageData
  }

  showPreview() {
    document.getElementById('preview-container').classList.add('active')
    document.getElementById('video-container').classList.add('hidden')
  }

  hidePreview() {
    document.getElementById('preview-container').classList.remove('active')
    document.getElementById('video-container').classList.remove('hidden')
  }
}

// UI Manager
class UIManager {
  constructor() {
    this.countdownInterval = null
    this.sessionCheckInterval = null
  }

  showScreen(screenName) {
    const screens = ['selection', 'capture', 'loading', 'success', 'error', 'register-patient']
    screens.forEach(name => {
      document.getElementById(`screen-${name}`).classList.add('hidden')
    })
    document.getElementById(`screen-${screenName}`).classList.remove('hidden')
  }

  updateInstructions(method) {
    const instructions = document.getElementById('instructions')
    const title = document.getElementById('capture-title')

    if (method === 'qr') {
      title.textContent = '📱 Capturar Código QR'
      instructions.innerHTML = `
        <strong>Instrucciones:</strong>
        <ol>
          <li>Abre el código QR en otro dispositivo</li>
          <li>Centra el código en el visor</li>
          <li>Asegúrate de que esté bien iluminado</li>
          <li>Presiona "Capturar"</li>
        </ol>
      `
    } else {
      title.textContent = '🪪 Capturar Cédula'
      instructions.innerHTML = `
        <strong>Instrucciones:</strong>
        <ol>
          <li>Coloca tu cédula en una superficie plana</li>
          <li>Asegúrate de que esté bien iluminada</li>
          <li>Captura el lado frontal con el número</li>
          <li>El número debe ser legible</li>
        </ol>
      `
    }
  }

  showCaptureButtons(captured = false) {
    document.getElementById('btn-capture').classList.toggle('hidden', captured)
    document.getElementById('btn-send').classList.toggle('hidden', !captured)
  }

  showSuccess(data) {
    this.showScreen('success')

    document.getElementById('patient-info').innerHTML = `
      <p><strong>Paciente:</strong> ${data.patient}</p>
      <p><strong>Medicamento:</strong> ${data.medicine}</p>
      <p><strong>Dosis:</strong> ${data.dosage}</p>
      ${data.remaining ? `<p><strong>Dosis restantes hoy:</strong> ${data.remaining}</p>` : ''}
    `

    this.startCountdown(data.expiresIn || CONFIG.SESSION_TIMEOUT)
  }

  showError(message, options = {}) {
    this.showScreen('error')
    
    const errorBox = document.querySelector('#screen-error .error-box')
    errorBox.innerHTML = `
      <h3>❌ Error</h3>
      <p id="error-message" style="margin: 15px 0; font-size: 16px;">
        ${message}
      </p>
      ${options.showRegisterButton ? `
        <button class="btn btn-primary" onclick="app.showRegisterPatient()" style="margin-top: 15px;">
          👤 Registrar Paciente
        </button>
      ` : ''}
      <button class="btn btn-secondary" onclick="app.reset()" style="margin-top: 10px;">
        Intentar de nuevo
      </button>
    `

    this.clearCountdown()
  }

  showDispensedSuccess() {
    document.getElementById('screen-success').innerHTML = `
      <div class="success-box">
        <h3>✅ ¡Medicamento Dispensado!</h3>
        <p style="font-size: 18px; margin: 20px 0;">
          Tu medicamento ha sido dispensado exitosamente.
        </p>
        <button class="btn btn-primary" onclick="app.reset()">
          Finalizar
        </button>
      </div>
    `
  }

  startCountdown(seconds) {
    let remaining = seconds
    const countdownEl = document.getElementById('countdown')
    const timeRemainingEl = document.getElementById('time-remaining')

    if (countdownEl && timeRemainingEl) {
      countdownEl.textContent = remaining
      timeRemainingEl.textContent = remaining

      this.countdownInterval = setInterval(() => {
        remaining--
        
        if (remaining <= 0) {
          this.clearCountdown()
          this.showError('Tiempo expirado. Por favor intenta de nuevo.')
        } else {
          countdownEl.textContent = remaining
          timeRemainingEl.textContent = remaining

          if (remaining <= 30) {
            countdownEl.style.color = '#f44336'
          }
        }
      }, 1000)
    }
  }

  clearCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval)
      this.countdownInterval = null
    }
  }

  startSessionMonitoring(sessionId, callback) {
    this.sessionCheckInterval = setInterval(async () => {
      try {
        await callback(sessionId)
      } catch (error) {
        console.error('Error monitoring session:', error)
      }
    }, CONFIG.SESSION_CHECK_INTERVAL)
  }

  stopSessionMonitoring() {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval)
      this.sessionCheckInterval = null
    }
  }

  cleanup() {
    this.clearCountdown()
    this.stopSessionMonitoring()
  }
}

// Main App
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
      
      this.ui.showError(
        `Paciente registrado exitosamente. Ahora necesitas una prescripción médica para dispensar medicamentos.`,
        { showRegisterButton: false }
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

// Initialize app when DOM is ready
let app
document.addEventListener('DOMContentLoaded', () => {
  app = new DispenserApp()
  window.app = app
})

