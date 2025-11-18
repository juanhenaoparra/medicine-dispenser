import { CONFIG } from './config.js'

export class UIManager {
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
        <button class="btn btn-primary" onclick="window.app.showRegisterPatient()" style="margin-top: 15px;">
          👤 Registrar Paciente
        </button>
      ` : ''}
      <button class="btn btn-secondary" onclick="window.app.reset()" style="margin-top: 10px;">
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
        <button class="btn btn-primary" onclick="window.app.reset()">
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

