const { query, queryOne, execute, transaction } = require('../config/sqlite');
const crypto = require('crypto');

/**
 * Patient Repository
 * Handles all database operations for patients
 */

/**
 * Generate QR code for patient
 * @param {string} cedula - Patient cedula
 * @returns {string} QR code (16 characters)
 */
function generateQRCode(cedula) {
  const timestamp = Date.now().toString();
  const hash = crypto
    .createHash('sha256')
    .update(`${cedula}-${timestamp}`)
    .digest('hex');
  return hash.substring(0, 16);
}

/**
 * Create a new patient
 * @param {Object} patientData - Patient data
 * @returns {Object} Created patient
 */
function create(patientData) {
  const {
    cedula,
    firstName,
    lastName,
    email = null,
    phone = null,
    active = true
  } = patientData;

  // Generate QR code
  const qrCode = generateQRCode(cedula);

  const sql = `
    INSERT INTO patients (cedula, first_name, last_name, email, phone, qr_code, active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const result = execute(sql, [
    cedula,
    firstName,
    lastName,
    email,
    phone,
    qrCode,
    active ? 1 : 0
  ]);

  return findById(result.lastInsertRowid);
}

/**
 * Find patient by ID
 * @param {number} id - Patient ID
 * @returns {Object|null} Patient object or null
 */
function findById(id) {
  const sql = 'SELECT * FROM patients WHERE id = ?';
  const patient = queryOne(sql, [id]);
  return patient ? formatPatient(patient) : null;
}

/**
 * Find patient by cedula
 * @param {string} cedula - Patient cedula
 * @returns {Object|null} Patient object or null
 */
function findByCedula(cedula) {
  const sql = 'SELECT * FROM patients WHERE cedula = ?';
  const patient = queryOne(sql, [cedula]);
  return patient ? formatPatient(patient) : null;
}

/**
 * Find patient by QR code
 * @param {string} qrCode - QR code
 * @returns {Object|null} Patient object or null
 */
function findByQRCode(qrCode) {
  const sql = 'SELECT * FROM patients WHERE qr_code = ?';
  const patient = queryOne(sql, [qrCode]);
  return patient ? formatPatient(patient) : null;
}

/**
 * Find active patient by cedula
 * @param {string} cedula - Patient cedula
 * @returns {Object|null} Patient object or null
 */
function findActiveByCedula(cedula) {
  const sql = 'SELECT * FROM patients WHERE cedula = ? AND active = 1';
  const patient = queryOne(sql, [cedula]);
  return patient ? formatPatient(patient) : null;
}

/**
 * Find active patient by QR code
 * @param {string} qrCode - QR code
 * @returns {Object|null} Patient object or null
 */
function findActiveByQRCode(qrCode) {
  const sql = 'SELECT * FROM patients WHERE qr_code = ? AND active = 1';
  const patient = queryOne(sql, [qrCode]);
  return patient ? formatPatient(patient) : null;
}

/**
 * Find all patients
 * @param {Object} filters - Filter options
 * @returns {Array} Array of patients
 */
function findAll(filters = {}) {
  let sql = 'SELECT * FROM patients';
  const params = [];
  const conditions = [];

  if (filters.active !== undefined) {
    conditions.push('active = ?');
    params.push(filters.active ? 1 : 0);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY registered_at DESC';

  const patients = query(sql, params);
  return patients.map(formatPatient);
}

/**
 * Update patient
 * @param {number} id - Patient ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated patient or null
 */
function update(id, updates) {
  const allowedFields = ['first_name', 'last_name', 'email', 'phone', 'active'];
  const fields = [];
  const params = [];

  Object.keys(updates).forEach(key => {
    const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (allowedFields.includes(dbKey)) {
      fields.push(`${dbKey} = ?`);
      params.push(updates[key]);
    }
  });

  if (fields.length === 0) {
    return findById(id);
  }

  params.push(id);
  const sql = `UPDATE patients SET ${fields.join(', ')} WHERE id = ?`;
  execute(sql, params);

  return findById(id);
}

/**
 * Delete patient (soft delete - set active = false)
 * @param {number} id - Patient ID
 * @returns {boolean} Success status
 */
function softDelete(id) {
  const sql = 'UPDATE patients SET active = 0 WHERE id = ?';
  const result = execute(sql, [id]);
  return result.changes > 0;
}

/**
 * Hard delete patient (cascade will delete related records)
 * @param {number} id - Patient ID
 * @returns {boolean} Success status
 */
function hardDelete(id) {
  const sql = 'DELETE FROM patients WHERE id = ?';
  const result = execute(sql, [id]);
  return result.changes > 0;
}

/**
 * Check if patient exists by cedula
 * @param {string} cedula - Patient cedula
 * @returns {boolean} True if exists
 */
function existsByCedula(cedula) {
  const sql = 'SELECT COUNT(*) as count FROM patients WHERE cedula = ?';
  const result = queryOne(sql, [cedula]);
  return result.count > 0;
}

/**
 * Regenerate QR code for patient
 * @param {number} id - Patient ID
 * @returns {Object|null} Updated patient with new QR code
 */
function regenerateQRCode(id) {
  const patient = findById(id);
  if (!patient) return null;

  const newQRCode = generateQRCode(patient.cedula);
  const sql = 'UPDATE patients SET qr_code = ? WHERE id = ?';
  execute(sql, [newQRCode, id]);

  return findById(id);
}

/**
 * Format patient object (convert DB format to application format)
 * @param {Object} patient - Raw patient from database
 * @returns {Object} Formatted patient
 */
function formatPatient(patient) {
  if (!patient) return null;

  return {
    id: patient.id,
    cedula: patient.cedula,
    firstName: patient.first_name,
    lastName: patient.last_name,
    fullName: `${patient.first_name} ${patient.last_name}`,
    email: patient.email,
    phone: patient.phone,
    qrCode: patient.qr_code,
    active: Boolean(patient.active),
    registeredAt: patient.registered_at,
    updatedAt: patient.updated_at
  };
}

module.exports = {
  create,
  findById,
  findByCedula,
  findByQRCode,
  findActiveByCedula,
  findActiveByQRCode,
  findAll,
  update,
  softDelete,
  hardDelete,
  existsByCedula,
  regenerateQRCode,
  generateQRCode
};
