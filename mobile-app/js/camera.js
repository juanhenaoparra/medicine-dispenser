import { CONFIG } from './config.js'

export class CameraService {
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

