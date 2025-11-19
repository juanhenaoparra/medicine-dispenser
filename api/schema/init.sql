-- Medicine Dispenser Database Schema
-- SQLite Implementation

-- ============================================
-- PATIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cedula TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    qr_code TEXT UNIQUE,
    active INTEGER NOT NULL DEFAULT 1,
    registered_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT check_cedula_length CHECK (length(cedula) >= 6 AND length(cedula) <= 10),
    CONSTRAINT check_cedula_numeric CHECK (cedula GLOB '[0-9]*'),
    CONSTRAINT check_first_name_length CHECK (length(first_name) <= 50),
    CONSTRAINT check_last_name_length CHECK (length(last_name) <= 50)
);

CREATE INDEX idx_patients_cedula ON patients(cedula);
CREATE INDEX idx_patients_qr_code ON patients(qr_code) WHERE qr_code IS NOT NULL;
CREATE INDEX idx_patients_active ON patients(active);

-- ============================================
-- PRESCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS prescriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    medicine_name TEXT NOT NULL,
    medicine_code TEXT,

    -- Dosage information (normalized)
    dosage_amount REAL NOT NULL,
    dosage_unit TEXT NOT NULL CHECK (dosage_unit IN ('mg', 'g', 'ml', 'L', 'tabletas', 'cápsulas', 'gotas', 'UI')),

    -- Frequency information
    frequency_times INTEGER NOT NULL CHECK (frequency_times >= 1 AND frequency_times <= 24),
    frequency_period TEXT NOT NULL CHECK (frequency_period IN ('diario', 'cada 8 horas', 'cada 12 horas', 'cada 24 horas', 'semanal', 'mensual')),

    -- Limits
    max_daily_doses INTEGER NOT NULL CHECK (max_daily_doses >= 1 AND max_daily_doses <= 10),

    -- Doctor information (normalized)
    doctor_name TEXT NOT NULL,
    doctor_license TEXT NOT NULL,
    doctor_specialty TEXT,

    -- Dates
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'activa' CHECK (status IN ('activa', 'completada', 'cancelada', 'expirada')),

    -- Notes
    notes TEXT,

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT check_medicine_name_length CHECK (length(medicine_name) <= 100),
    CONSTRAINT check_dosage_amount CHECK (dosage_amount >= 0.1),
    CONSTRAINT check_doctor_name_length CHECK (length(doctor_name) <= 100),
    CONSTRAINT check_notes_length CHECK (length(notes) <= 500),
    CONSTRAINT check_dates CHECK (date(end_date) > date(start_date))
);

CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_patient_status ON prescriptions(patient_id, status);
CREATE INDEX idx_prescriptions_status ON prescriptions(status);
CREATE INDEX idx_prescriptions_medicine_code ON prescriptions(medicine_code) WHERE medicine_code IS NOT NULL;
CREATE INDEX idx_prescriptions_dates ON prescriptions(start_date, end_date);

-- ============================================
-- DISPENSES TABLE (Permanent Records)
-- ============================================
CREATE TABLE IF NOT EXISTS dispenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    prescription_id INTEGER NOT NULL,
    auth_method TEXT NOT NULL CHECK (auth_method IN ('qr', 'cedula')),

    -- Medicine info (denormalized for historical record)
    medicine_name TEXT NOT NULL,
    medicine_dosage_amount REAL,
    medicine_dosage_unit TEXT,

    -- Dispense details
    dispensed_at TEXT NOT NULL DEFAULT (datetime('now')),
    dispenser_id TEXT NOT NULL DEFAULT 'main-dispenser',
    status TEXT NOT NULL DEFAULT 'exitosa' CHECK (status IN ('exitosa', 'fallida', 'parcial')),

    -- Metadata (denormalized)
    metadata_ip_address TEXT,
    metadata_user_agent TEXT,
    metadata_response_time INTEGER,
    metadata_image_url TEXT,
    metadata_notes TEXT,

    -- Error details (for failed dispenses)
    error_code TEXT,
    error_message TEXT,
    error_details TEXT,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
);

CREATE INDEX idx_dispenses_patient_date ON dispenses(patient_id, dispensed_at DESC);
CREATE INDEX idx_dispenses_prescription_date ON dispenses(prescription_id, dispensed_at DESC);
CREATE INDEX idx_dispenses_date ON dispenses(dispensed_at DESC);
CREATE INDEX idx_dispenses_status ON dispenses(status);
CREATE INDEX idx_dispenses_dispenser ON dispenses(dispenser_id);

-- ============================================
-- DISPENSE_SESSIONS TABLE (Temporary 90-second sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS dispense_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    patient_id INTEGER NOT NULL,
    prescription_id INTEGER NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dispensed', 'expired', 'cancelled')),
    auth_method TEXT CHECK (auth_method IN ('qr', 'cedula')),

    -- Patient info (denormalized for quick access)
    patient_name TEXT,
    patient_cedula TEXT,
    patient_qr_code TEXT,

    -- Medicine info (denormalized for quick access)
    medicine_name TEXT,
    medicine_dosage TEXT,

    -- Dispenser
    dispenser_id TEXT NOT NULL DEFAULT 'dispenser-01',

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    dispensed_at TEXT,

    -- Metadata
    metadata_ip_address TEXT,
    metadata_user_agent TEXT,
    metadata_device_info TEXT,

    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_session_id ON dispense_sessions(session_id);
CREATE INDEX idx_sessions_status_expires ON dispense_sessions(status, expires_at);
CREATE INDEX idx_sessions_patient_status_created ON dispense_sessions(patient_id, status, created_at DESC);
CREATE INDEX idx_sessions_dispenser_status_created ON dispense_sessions(dispenser_id, status, created_at DESC);

-- ============================================
-- TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- ============================================

CREATE TRIGGER IF NOT EXISTS update_patients_timestamp
AFTER UPDATE ON patients
FOR EACH ROW
BEGIN
    UPDATE patients SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_prescriptions_timestamp
AFTER UPDATE ON prescriptions
FOR EACH ROW
BEGIN
    UPDATE prescriptions SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Trigger to auto-expire sessions
CREATE TRIGGER IF NOT EXISTS auto_expire_sessions
AFTER UPDATE ON dispense_sessions
FOR EACH ROW
WHEN NEW.status = 'pending' AND datetime(NEW.expires_at) < datetime('now')
BEGIN
    UPDATE dispense_sessions SET status = 'expired' WHERE id = NEW.id;
END;

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Active prescriptions with patient info
CREATE VIEW IF NOT EXISTS v_active_prescriptions AS
SELECT
    p.id,
    p.patient_id,
    pt.cedula,
    pt.first_name,
    pt.last_name,
    p.medicine_name,
    p.dosage_amount,
    p.dosage_unit,
    p.max_daily_doses,
    p.start_date,
    p.end_date,
    p.status
FROM prescriptions p
JOIN patients pt ON p.patient_id = pt.id
WHERE p.status = 'activa'
  AND pt.active = 1
  AND date(p.start_date) <= date('now')
  AND date(p.end_date) >= date('now');

-- Recent dispenses with full details
CREATE VIEW IF NOT EXISTS v_recent_dispenses AS
SELECT
    d.id,
    d.dispensed_at,
    pt.cedula,
    pt.first_name,
    pt.last_name,
    d.medicine_name,
    d.medicine_dosage_amount,
    d.medicine_dosage_unit,
    d.auth_method,
    d.status,
    d.dispenser_id
FROM dispenses d
JOIN patients pt ON d.patient_id = pt.id
ORDER BY d.dispensed_at DESC;

-- Pending sessions
CREATE VIEW IF NOT EXISTS v_pending_sessions AS
SELECT
    s.session_id,
    s.patient_id,
    s.patient_name,
    s.patient_cedula,
    s.medicine_name,
    s.medicine_dosage,
    s.dispenser_id,
    s.created_at,
    s.expires_at,
    CAST((julianday(s.expires_at) - julianday('now')) * 86400 AS INTEGER) as time_remaining_seconds
FROM dispense_sessions s
WHERE s.status = 'pending'
  AND datetime(s.expires_at) > datetime('now')
ORDER BY s.created_at DESC;

-- ============================================
-- INITIAL DATA (Optional)
-- ============================================

-- This section is intentionally left empty
-- Use the seed-test-data.js script for initial data
