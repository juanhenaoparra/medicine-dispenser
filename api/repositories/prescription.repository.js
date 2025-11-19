const { query, queryOne, execute, transaction } = require('../config/sqlite');

/**
 * Prescription Repository
 * Handles all database operations for prescriptions
 */

/**
 * Create a new prescription
 * @param {Object} prescriptionData - Prescription data
 * @returns {Object} Created prescription
 */
function create(prescriptionData) {
  const {
    patientId,
    medicineName,
    medicineCode = null,
    dosage,
    frequency,
    maxDailyDoses,
    doctor,
    startDate,
    endDate,
    status = 'activa',
    notes = null
  } = prescriptionData;

  const sql = `
    INSERT INTO prescriptions (
      patient_id, medicine_name, medicine_code,
      dosage_amount, dosage_unit,
      frequency_times, frequency_period,
      max_daily_doses,
      doctor_name, doctor_license, doctor_specialty,
      start_date, end_date, status, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const result = execute(sql, [
    patientId,
    medicineName,
    medicineCode,
    dosage.amount,
    dosage.unit,
    frequency.times,
    frequency.period,
    maxDailyDoses,
    doctor.name,
    doctor.license,
    doctor.specialty || null,
    startDate,
    endDate,
    status,
    notes
  ]);

  return findById(result.lastInsertRowid);
}

/**
 * Find prescription by ID
 * @param {number} id - Prescription ID
 * @returns {Object|null} Prescription object or null
 */
function findById(id) {
  const sql = 'SELECT * FROM prescriptions WHERE id = ?';
  const prescription = queryOne(sql, [id]);
  return prescription ? formatPrescription(prescription) : null;
}

/**
 * Find prescription with patient details
 * @param {number} id - Prescription ID
 * @returns {Object|null} Prescription with patient or null
 */
function findByIdWithPatient(id) {
  const sql = `
    SELECT
      p.*,
      pt.cedula as patient_cedula,
      pt.first_name as patient_first_name,
      pt.last_name as patient_last_name,
      pt.qr_code as patient_qr_code
    FROM prescriptions p
    JOIN patients pt ON p.patient_id = pt.id
    WHERE p.id = ?
  `;
  const result = queryOne(sql, [id]);
  return result ? formatPrescriptionWithPatient(result) : null;
}

/**
 * Find active prescriptions for patient
 * @param {number} patientId - Patient ID
 * @returns {Array} Array of active prescriptions
 */
function findActiveByPatientId(patientId) {
  const currentDate = new Date().toISOString().split('T')[0];

  const sql = `
    SELECT * FROM prescriptions
    WHERE patient_id = ?
      AND status = 'activa'
      AND date(start_date) <= date(?)
      AND date(end_date) >= date(?)
    ORDER BY created_at DESC
  `;

  const prescriptions = query(sql, [patientId, currentDate, currentDate]);
  return prescriptions.map(formatPrescription);
}

/**
 * Find all prescriptions for a patient
 * @param {number} patientId - Patient ID
 * @param {Object} filters - Filter options
 * @returns {Array} Array of prescriptions
 */
function findByPatientId(patientId, filters = {}) {
  let sql = 'SELECT * FROM prescriptions WHERE patient_id = ?';
  const params = [patientId];

  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY created_at DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  const prescriptions = query(sql, params);
  return prescriptions.map(formatPrescription);
}

/**
 * Find all prescriptions
 * @param {Object} filters - Filter options
 * @returns {Array} Array of prescriptions
 */
function findAll(filters = {}) {
  let sql = 'SELECT * FROM prescriptions';
  const params = [];
  const conditions = [];

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }

  if (filters.patientId) {
    conditions.push('patient_id = ?');
    params.push(filters.patientId);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY created_at DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  const prescriptions = query(sql, params);
  return prescriptions.map(formatPrescription);
}

/**
 * Update prescription
 * @param {number} id - Prescription ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated prescription or null
 */
function update(id, updates) {
  const fields = [];
  const params = [];

  // Map camelCase to snake_case and build update query
  const fieldMap = {
    medicineName: 'medicine_name',
    medicineCode: 'medicine_code',
    status: 'status',
    notes: 'notes',
    maxDailyDoses: 'max_daily_doses',
    startDate: 'start_date',
    endDate: 'end_date'
  };

  Object.keys(updates).forEach(key => {
    if (fieldMap[key]) {
      fields.push(`${fieldMap[key]} = ?`);
      params.push(updates[key]);
    } else if (key === 'dosage') {
      fields.push('dosage_amount = ?', 'dosage_unit = ?');
      params.push(updates.dosage.amount, updates.dosage.unit);
    } else if (key === 'frequency') {
      fields.push('frequency_times = ?', 'frequency_period = ?');
      params.push(updates.frequency.times, updates.frequency.period);
    } else if (key === 'doctor') {
      fields.push('doctor_name = ?', 'doctor_license = ?', 'doctor_specialty = ?');
      params.push(updates.doctor.name, updates.doctor.license, updates.doctor.specialty || null);
    }
  });

  if (fields.length === 0) {
    return findById(id);
  }

  params.push(id);
  const sql = `UPDATE prescriptions SET ${fields.join(', ')} WHERE id = ?`;
  execute(sql, params);

  return findById(id);
}

/**
 * Delete prescription
 * @param {number} id - Prescription ID
 * @returns {boolean} Success status
 */
function deleteById(id) {
  const sql = 'DELETE FROM prescriptions WHERE id = ?';
  const result = execute(sql, [id]);
  return result.changes > 0;
}

/**
 * Check if prescription is valid (active and within date range)
 * @param {number} id - Prescription ID
 * @returns {Object} Validity status with reason
 */
function checkValidity(id) {
  const prescription = findById(id);

  if (!prescription) {
    return { valid: false, reason: 'Prescription not found' };
  }

  if (prescription.status !== 'activa') {
    return { valid: false, reason: `Prescription is ${prescription.status}` };
  }

  const now = new Date();
  const startDate = new Date(prescription.startDate);
  const endDate = new Date(prescription.endDate);

  if (now < startDate) {
    return { valid: false, reason: 'Prescription not yet active' };
  }

  if (now > endDate) {
    return { valid: false, reason: 'Prescription has expired' };
  }

  return { valid: true, reason: null };
}

/**
 * Mark prescription as expired
 * @param {number} id - Prescription ID
 * @returns {Object|null} Updated prescription
 */
function markAsExpired(id) {
  const sql = 'UPDATE prescriptions SET status = ? WHERE id = ?';
  execute(sql, ['expirada', id]);
  return findById(id);
}

/**
 * Mark prescription as completed
 * @param {number} id - Prescription ID
 * @returns {Object|null} Updated prescription
 */
function markAsCompleted(id) {
  const sql = 'UPDATE prescriptions SET status = ? WHERE id = ?';
  execute(sql, ['completada', id]);
  return findById(id);
}

/**
 * Check for existing active prescription for patient
 * @param {number} patientId - Patient ID
 * @returns {boolean} True if active prescription exists
 */
function hasActivePrescription(patientId) {
  const currentDate = new Date().toISOString().split('T')[0];

  const sql = `
    SELECT COUNT(*) as count FROM prescriptions
    WHERE patient_id = ?
      AND status = 'activa'
      AND date(start_date) <= date(?)
      AND date(end_date) >= date(?)
  `;

  const result = queryOne(sql, [patientId, currentDate, currentDate]);
  return result.count > 0;
}

/**
 * Auto-expire prescriptions past their end date
 * @returns {number} Number of prescriptions expired
 */
function autoExpirePastPrescriptions() {
  const currentDate = new Date().toISOString().split('T')[0];

  const sql = `
    UPDATE prescriptions
    SET status = 'expirada'
    WHERE status = 'activa'
      AND date(end_date) < date(?)
  `;

  const result = execute(sql, [currentDate]);
  return result.changes;
}

/**
 * Format prescription object (convert DB format to application format)
 * @param {Object} prescription - Raw prescription from database
 * @returns {Object} Formatted prescription
 */
function formatPrescription(prescription) {
  if (!prescription) return null;

  // Calculate if valid
  const now = new Date();
  const startDate = new Date(prescription.start_date);
  const endDate = new Date(prescription.end_date);
  const isValid = prescription.status === 'activa' && now >= startDate && now <= endDate;

  // Calculate days remaining
  const daysRemaining = isValid
    ? Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    id: prescription.id,
    patientId: prescription.patient_id,
    medicineName: prescription.medicine_name,
    medicineCode: prescription.medicine_code,
    dosage: {
      amount: prescription.dosage_amount,
      unit: prescription.dosage_unit
    },
    frequency: {
      times: prescription.frequency_times,
      period: prescription.frequency_period
    },
    maxDailyDoses: prescription.max_daily_doses,
    doctor: {
      name: prescription.doctor_name,
      license: prescription.doctor_license,
      specialty: prescription.doctor_specialty
    },
    startDate: prescription.start_date,
    endDate: prescription.end_date,
    status: prescription.status,
    notes: prescription.notes,
    createdAt: prescription.created_at,
    updatedAt: prescription.updated_at,
    // Computed fields
    isValid,
    daysRemaining
  };
}

/**
 * Format prescription with patient details
 * @param {Object} result - Raw prescription with patient from database
 * @returns {Object} Formatted prescription with patient
 */
function formatPrescriptionWithPatient(result) {
  const prescription = formatPrescription(result);

  prescription.patient = {
    id: result.patient_id,
    cedula: result.patient_cedula,
    firstName: result.patient_first_name,
    lastName: result.patient_last_name,
    fullName: `${result.patient_first_name} ${result.patient_last_name}`,
    qrCode: result.patient_qr_code
  };

  return prescription;
}

module.exports = {
  create,
  findById,
  findByIdWithPatient,
  findActiveByPatientId,
  findByPatientId,
  findAll,
  update,
  deleteById,
  checkValidity,
  markAsExpired,
  markAsCompleted,
  hasActivePrescription,
  autoExpirePastPrescriptions
};
