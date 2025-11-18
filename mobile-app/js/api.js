import { CONFIG } from './config.js'

export class APIService {
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

  async createPrescription(prescriptionData) {
    const response = await fetch(`${this.baseURL}/prescriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(prescriptionData)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Error creando prescripción')
    }

    return response.json()
  }
}

