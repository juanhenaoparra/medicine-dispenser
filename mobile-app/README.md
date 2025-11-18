# Mobile App - Dispensador Inteligente

## 📱 Overview

Progressive Web App (PWA) para el sistema de dispensación inteligente de medicamentos. Permite a los pacientes autenticarse usando códigos QR o cédula, y solicitar la dispensación de sus medicamentos.

## 🏗️ Architecture

### Modular Structure

```
mobile-app/
├── index.html              # Main entry point
├── dispenser-client.html   # Legacy (redirects to index.html)
├── manifest.json           # PWA manifest
├── service-worker.js       # PWA service worker
├── css/
│   └── styles.css         # All application styles
└── js/
    ├── config.js          # Configuration constants
    ├── api.js             # API service layer
    ├── camera.js          # Camera handling
    ├── ui.js              # UI state management
    └── app.js             # Main application orchestrator
```

### Module Responsibilities

#### `config.js`
- Centralized configuration
- API URLs, timeouts, camera settings
- Easy environment switching

#### `api.js` - `APIService`
All backend communication:
- `requestDispense()` - Request medication dispensation
- `getSessionStatus()` - Poll session state
- `createPatient()` - Register new patient
- `createPrescription()` - Add prescription

#### `camera.js` - `CameraService`
Camera operations:
- `start()` - Initialize camera with constraints
- `stop()` - Stop camera and release resources
- `capture()` - Take photo and convert to base64
- `showPreview()` / `hidePreview()` - Toggle UI states

#### `ui.js` - `UIManager`
UI state and updates:
- `showScreen()` - Navigate between screens
- `updateInstructions()` - Context-aware instructions
- `showSuccess()` / `showError()` - Result displays
- `startCountdown()` - Session expiration timer
- `startSessionMonitoring()` - Poll for dispensation

#### `app.js` - `DispenserApp`
Main orchestrator:
- `selectMethod()` - Choose authentication method
- `captureImage()` - Handle image capture
- `sendImage()` - Submit to backend
- `monitorSession()` - Watch for physical button press
- `showRegisterPatient()` - Patient registration flow
- `registerPatient()` - Submit patient data
- `reset()` - Reset to initial state

## 🚀 Features

### Core Functionality
- ✅ QR code authentication
- ✅ Cédula OCR authentication
- ✅ Real-time session monitoring
- ✅ Countdown timer for dispensation
- ✅ Progressive Web App (offline capable)

### New: Patient Registration
- ✅ Automatic detection of unregistered patients
- ✅ Pre-filled cédula from OCR extraction
- ✅ Form validation
- ✅ Immediate patient creation

## 🎯 User Flow

### Standard Flow
1. Select authentication method (QR or Cédula)
2. Capture image with camera
3. System validates and authorizes
4. Press physical dispenser button
5. Medication dispensed

### Patient Registration Flow
1. Scan cédula → Patient not found
2. App shows "Registrar Paciente" button
3. Fill registration form (pre-filled cédula)
4. Submit → Patient created
5. User needs prescription to dispense

## 🛠️ Configuration

Edit `js/config.js` to change settings:

```javascript
export const CONFIG = {
  API_BASE_URL: 'http://localhost:3000/api',  // Your API URL
  DISPENSER_ID: 'dispenser-01',                // Dispenser ID
  SESSION_TIMEOUT: 90,                         // Seconds
  SESSION_CHECK_INTERVAL: 3000,                // Milliseconds
  CAMERA_CONFIG: {
    facingMode: 'environment',                 // Back camera
    width: { ideal: 1280 },
    height: { ideal: 720 }
  }
}
```

## 📦 Installation

### Development
```bash
# Serve with any static server
cd mobile-app
python3 -m http.server 8080
# Open http://localhost:8080
```

### Production
Deploy all files to a web server with HTTPS (required for camera access).

## 🧪 Testing

### Manual Testing Checklist
- [ ] App loads correctly from `index.html`
- [ ] Legacy URL redirects properly
- [ ] Camera permissions requested
- [ ] Camera starts on method selection
- [ ] Capture works and shows preview
- [ ] Send button submits to API
- [ ] Success screen shows patient info
- [ ] Countdown updates every second
- [ ] Session monitoring detects dispensation
- [ ] Error screen shows on failure
- [ ] Patient registration appears on "not found"
- [ ] Cédula pre-fills from OCR
- [ ] Reset button works correctly

## 📝 Code Style

Following project guidelines:
- ✅ No trailing semicolons in JavaScript
- ✅ Classes under 300 lines
- ✅ ES6 modules with imports/exports
- ✅ camelCase naming
- ✅ Single responsibility per module
- ✅ Try/catch error handling everywhere

## 🔄 Migration from Legacy

Old `dispenser-client.html` automatically redirects to `index.html`. No action required.

## 🐛 Common Issues

### Camera Not Working
- **Issue**: Permission denied
- **Fix**: Enable camera permissions in browser settings

### API Connection Failed
- **Issue**: Cannot reach server
- **Fix**: Check `API_BASE_URL` in `config.js`

### Module Not Found
- **Issue**: Import paths incorrect
- **Fix**: Serve from HTTP server, not `file://` protocol

## 🚧 Future Improvements

- [ ] TypeScript conversion
- [ ] Unit tests (Jest)
- [ ] E2E tests (Cypress)
- [ ] Prescription form after registration
- [ ] Offline mode with IndexedDB
- [ ] Camera switch (front/back)
- [ ] Client-side image enhancement
- [ ] Multiple language support

## 📄 License

MIT License - Juan Henao Parra

