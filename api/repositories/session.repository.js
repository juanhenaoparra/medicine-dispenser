const { query, queryOne, execute, transaction } = require('../config/sqlite');

/**
 * DispenseSession Repository
 * Handles all database operations for temporary 90-second dispense sessions
 */

/**
 * Generate unique session ID
 * @returns {string} Session ID in format sess_{timestamp}_{random}
 */
function generateSessionId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `sess_${timestamp}_${random}`;
}

/**
 * Create a new dispense session (atomic operation)
 * Cancels any existing pending sessions for the patient
 * @param {Object} sessionData - Session data
 * @returns {Object} Created session
 */
function createSession(sessionData) {
  const {
    patientId,
    prescriptionId,
    authMethod,
    patientInfo,
    medicineInfo,
    dispenserId = 'dispenser-01',
    metadata = {}
  } = sessionData;

  return transaction(() => {
    // Cancel any existing pending sessions for this patient
    const cancelSql = `
      UPDATE dispense_sessions
      SET status = 'cancelled'
      WHERE patient_id = ? AND status = 'pending'
    `;
    execute(cancelSql, [patientId]);

    // Create new session
    const sessionId = generateSessionId();
    const createdAt = new Date().toISOString();
    // Environment variable for session duration (parse as int to avoid string concatenation)
    const sessionDuration = parseInt(process.env.SESSION_DURATION) || 30000;
    const expiresAt = new Date(Date.now() + sessionDuration).toISOString(); // 30 seconds default, timeout

    const insertSql = `
      INSERT INTO dispense_sessions (
        session_id, patient_id, prescription_id,
        status, auth_method,
        patient_name, patient_cedula, patient_qr_code,
        medicine_name, medicine_dosage,
        dispenser_id,
        created_at, expires_at,
        metadata_ip_address, metadata_user_agent, metadata_device_info
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const medicineDosage = medicineInfo.dosage
      ? `${medicineInfo.dosage.amount} ${medicineInfo.dosage.unit}`
      : '';

    execute(insertSql, [
      sessionId,
      patientId,
      prescriptionId,
      'pending',
      authMethod,
      patientInfo.name,
      patientInfo.cedula,
      patientInfo.qrCode || null,
      medicineInfo.name,
      medicineDosage,
      dispenserId,
      createdAt,
      expiresAt,
      metadata.ipAddress || null,
      metadata.userAgent || null,
      metadata.deviceInfo || null
    ]);

    return findBySessionId(sessionId);
  });
}

/**
 * Find session by session ID
 * @param {string} sessionId - Session ID
 * @returns {Object|null} Session object or null
 */
function findBySessionId(sessionId) {
  const sql = 'SELECT * FROM dispense_sessions WHERE session_id = ?';
  const session = queryOne(sql, [sessionId]);
  return session ? formatSession(session) : null;
}

/**
 * Find session by ID
 * @param {number} id - Internal session ID
 * @returns {Object|null} Session object or null
 */
function findById(id) {
  const sql = 'SELECT * FROM dispense_sessions WHERE id = ?';
  const session = queryOne(sql, [id]);
  return session ? formatSession(session) : null;
}

/**
 * Get pending session for a dispenser
 * @param {string} dispenserId - Dispenser ID
 * @returns {Object|null} Pending session or null
 */
function getPendingSession(dispenserId) {
  const now = new Date().toISOString();

  const sql = `
    SELECT * FROM dispense_sessions
    WHERE dispenser_id = ?
      AND status = 'pending'
      AND datetime(expires_at) > datetime(?)
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const session = queryOne(sql, [dispenserId, now]);
  return session ? formatSession(session) : null;
}

/**
 * Get pending session with full patient and prescription details
 * @param {string} dispenserId - Dispenser ID
 * @returns {Object|null} Pending session with details or null
 */
function getPendingSessionWithDetails(dispenserId) {
  const now = new Date().toISOString();

  const sql = `
    SELECT
      s.*,
      pt.cedula as patient_cedula_full,
      pt.first_name as patient_first_name,
      pt.last_name as patient_last_name,
      pt.qr_code as patient_qr_code_full,
      p.medicine_name as prescription_medicine_name,
      p.dosage_amount as prescription_dosage_amount,
      p.dosage_unit as prescription_dosage_unit
    FROM dispense_sessions s
    JOIN patients pt ON s.patient_id = pt.id
    JOIN prescriptions p ON s.prescription_id = p.id
    WHERE s.dispenser_id = ?
      AND s.status = 'pending'
      AND datetime(s.expires_at) > datetime(?)
    ORDER BY s.created_at DESC
    LIMIT 1
  `;

  const result = queryOne(sql, [dispenserId, now]);
  return result ? formatSessionWithDetails(result) : null;
}

/**
 * Confirm dispense (mark session as dispensed)
 * @param {string} sessionId - Session ID
 * @returns {Object|null} Updated session or null
 */
function confirmDispense(sessionId) {
  const now = new Date().toISOString();

  const sql = `
    UPDATE dispense_sessions
    SET status = 'dispensed', dispensed_at = ?
    WHERE session_id = ?
  `;

  const result = execute(sql, [now, sessionId]);

  if (result.changes > 0) {
    return findBySessionId(sessionId);
  }

  return null;
}

/**
 * Cancel session
 * @param {string} sessionId - Session ID
 * @returns {Object|null} Updated session or null
 */
function cancelSession(sessionId) {
  const sql = `
    UPDATE dispense_sessions
    SET status = 'cancelled'
    WHERE session_id = ?
  `;

  const result = execute(sql, [sessionId]);

  if (result.changes > 0) {
    return findBySessionId(sessionId);
  }

  return null;
}

/**
 * Cleanup expired sessions (bulk operation)
 * @returns {number} Number of sessions expired
 */
function cleanupExpiredSessions() {
  const now = new Date().toISOString();

  const sql = `
    UPDATE dispense_sessions
    SET status = 'expired'
    WHERE status = 'pending'
      AND datetime(expires_at) <= datetime(?)
  `;

  const result = execute(sql, [now]);
  return result.changes;
}

/**
 * Find all sessions for a patient
 * @param {number} patientId - Patient ID
 * @param {Object} options - Query options
 * @returns {Array} Array of sessions
 */
function findByPatientId(patientId, options = {}) {
  let sql = 'SELECT * FROM dispense_sessions WHERE patient_id = ?';
  const params = [patientId];

  if (options.status) {
    sql += ' AND status = ?';
    params.push(options.status);
  }

  sql += ' ORDER BY created_at DESC';

  if (options.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  const sessions = query(sql, params);
  return sessions.map(formatSession);
}

/**
 * Find all sessions
 * @param {Object} options - Query options
 * @returns {Array} Array of sessions
 */
function findAll(options = {}) {
  let sql = 'SELECT * FROM dispense_sessions';
  const params = [];
  const conditions = [];

  if (options.dispenserId) {
    conditions.push('dispenser_id = ?');
    params.push(options.dispenserId);
  }

  if (options.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }

  if (options.patientId) {
    conditions.push('patient_id = ?');
    params.push(options.patientId);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY created_at DESC';

  if (options.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  const sessions = query(sql, params);
  return sessions.map(formatSession);
}

/**
 * Check if session is expired
 * @param {string} sessionId - Session ID
 * @returns {boolean} True if expired
 */
function isExpired(sessionId) {
  const session = findBySessionId(sessionId);
  if (!session) return true;

  const now = new Date();
  const expiresAt = new Date(session.expiresAt);

  return now > expiresAt;
}

/**
 * Get time remaining for session (in seconds)
 * @param {string} sessionId - Session ID
 * @returns {number} Seconds remaining (0 if expired)
 */
function getTimeRemaining(sessionId) {
  const session = findBySessionId(sessionId);
  if (!session) return 0;

  const now = new Date();
  const expiresAt = new Date(session.expiresAt);
  const remaining = Math.ceil((expiresAt - now) / 1000);

  return remaining > 0 ? remaining : 0;
}

/**
 * Get session statistics
 * @param {Object} filters - Filter options
 * @returns {Object} Statistics
 */
function getStats(filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.dispenserId) {
    conditions.push('dispenser_id = ?');
    params.push(filters.dispenserId);
  }

  if (filters.startDate) {
    conditions.push('date(created_at) >= date(?)');
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push('date(created_at) <= date(?)');
    params.push(filters.endDate);
  }

  const whereClause = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : '';

  const sql = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'dispensed' THEN 1 ELSE 0 END) as dispensed,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM dispense_sessions
    ${whereClause}
  `;

  return queryOne(sql, params);
}

/**
 * Format session object (convert DB format to application format)
 * @param {Object} session - Raw session from database
 * @returns {Object} Formatted session
 */
function formatSession(session) {
  if (!session) return null;

  // Calculate time remaining
  const now = new Date();
  const expiresAt = new Date(session.expires_at);
  const timeRemaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));

  return {
    id: session.id,
    sessionId: session.session_id,
    patientId: session.patient_id,
    prescriptionId: session.prescription_id,
    status: session.status,
    authMethod: session.auth_method,
    patientInfo: {
      name: session.patient_name,
      cedula: session.patient_cedula,
      qrCode: session.patient_qr_code
    },
    medicineInfo: {
      name: session.medicine_name,
      dosage: session.medicine_dosage
    },
    dispenserId: session.dispenser_id,
    createdAt: session.created_at,
    expiresAt: session.expires_at,
    dispensedAt: session.dispensed_at,
    timeRemaining,
    isExpired: timeRemaining === 0 && session.status === 'pending',
    metadata: {
      ipAddress: session.metadata_ip_address,
      userAgent: session.metadata_user_agent,
      deviceInfo: session.metadata_device_info
    }
  };
}

/**
 * Format session with full patient and prescription details
 * @param {Object} result - Raw session with joins from database
 * @returns {Object} Formatted session with details
 */
function formatSessionWithDetails(result) {
  const session = formatSession(result);

  if (result.patient_cedula_full) {
    session.patient = {
      cedula: result.patient_cedula_full,
      firstName: result.patient_first_name,
      lastName: result.patient_last_name,
      fullName: `${result.patient_first_name} ${result.patient_last_name}`,
      qrCode: result.patient_qr_code_full
    };
  }

  if (result.prescription_medicine_name) {
    session.prescription = {
      medicineName: result.prescription_medicine_name,
      dosage: {
        amount: result.prescription_dosage_amount,
        unit: result.prescription_dosage_unit
      }
    };
  }

  return session;
}

module.exports = {
  createSession,
  findBySessionId,
  findById,
  getPendingSession,
  getPendingSessionWithDetails,
  confirmDispense,
  cancelSession,
  cleanupExpiredSessions,
  findByPatientId,
  findAll,
  isExpired,
  getTimeRemaining,
  getStats,
  generateSessionId
};
