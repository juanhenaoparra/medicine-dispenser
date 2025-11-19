const { query, queryOne, execute, transaction } = require('../config/sqlite');

/**
 * Dispense Repository
 * Handles all database operations for dispenses (permanent records)
 */

/**
 * Create a new dispense record
 * @param {Object} dispenseData - Dispense data
 * @returns {Object} Created dispense
 */
function create(dispenseData) {
  const {
    patientId,
    prescriptionId,
    authMethod,
    medicine,
    dispenserId = 'main-dispenser',
    status = 'exitosa',
    metadata = {},
    error = null
  } = dispenseData;

  const sql = `
    INSERT INTO dispenses (
      patient_id, prescription_id, auth_method,
      medicine_name, medicine_dosage_amount, medicine_dosage_unit,
      dispenser_id, status,
      metadata_ip_address, metadata_user_agent, metadata_response_time,
      metadata_image_url, metadata_notes,
      error_code, error_message, error_details
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const result = execute(sql, [
    patientId,
    prescriptionId,
    authMethod,
    medicine.name,
    medicine.dosage?.amount || null,
    medicine.dosage?.unit || null,
    dispenserId,
    status,
    metadata.ipAddress || null,
    metadata.userAgent || null,
    metadata.responseTime || null,
    metadata.imageUrl || null,
    metadata.notes || null,
    error?.code || null,
    error?.message || null,
    error?.details || null
  ]);

  return findById(result.lastInsertRowid);
}

/**
 * Find dispense by ID
 * @param {number} id - Dispense ID
 * @returns {Object|null} Dispense object or null
 */
function findById(id) {
  const sql = 'SELECT * FROM dispenses WHERE id = ?';
  const dispense = queryOne(sql, [id]);
  return dispense ? formatDispense(dispense) : null;
}

/**
 * Find dispense with patient and prescription details
 * @param {number} id - Dispense ID
 * @returns {Object|null} Dispense with relations or null
 */
function findByIdWithDetails(id) {
  const sql = `
    SELECT
      d.*,
      pt.cedula as patient_cedula,
      pt.first_name as patient_first_name,
      pt.last_name as patient_last_name,
      p.medicine_name as prescription_medicine_name,
      p.dosage_amount as prescription_dosage_amount,
      p.dosage_unit as prescription_dosage_unit
    FROM dispenses d
    JOIN patients pt ON d.patient_id = pt.id
    JOIN prescriptions p ON d.prescription_id = p.id
    WHERE d.id = ?
  `;
  const result = queryOne(sql, [id]);
  return result ? formatDispenseWithDetails(result) : null;
}

/**
 * Find all dispenses for a patient
 * @param {number} patientId - Patient ID
 * @param {Object} options - Query options
 * @returns {Array} Array of dispenses
 */
function findByPatientId(patientId, options = {}) {
  let sql = `
    SELECT d.*, pt.cedula, pt.first_name, pt.last_name
    FROM dispenses d
    JOIN patients pt ON d.patient_id = pt.id
    WHERE d.patient_id = ?
  `;
  const params = [patientId];

  if (options.status) {
    sql += ' AND d.status = ?';
    params.push(options.status);
  }

  if (options.startDate) {
    sql += ' AND date(d.dispensed_at) >= date(?)';
    params.push(options.startDate);
  }

  if (options.endDate) {
    sql += ' AND date(d.dispensed_at) <= date(?)';
    params.push(options.endDate);
  }

  sql += ' ORDER BY d.dispensed_at DESC';

  if (options.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  const dispenses = query(sql, params);
  return dispenses.map(d => formatDispenseWithDetails(d));
}

/**
 * Find all dispenses
 * @param {Object} options - Query options
 * @returns {Array} Array of dispenses
 */
function findAll(options = {}) {
  let sql = `
    SELECT d.*, pt.cedula, pt.first_name, pt.last_name
    FROM dispenses d
    JOIN patients pt ON d.patient_id = pt.id
  `;
  const params = [];
  const conditions = [];

  if (options.patientId) {
    conditions.push('d.patient_id = ?');
    params.push(options.patientId);
  }

  if (options.prescriptionId) {
    conditions.push('d.prescription_id = ?');
    params.push(options.prescriptionId);
  }

  if (options.status) {
    conditions.push('d.status = ?');
    params.push(options.status);
  }

  if (options.dispenserId) {
    conditions.push('d.dispenser_id = ?');
    params.push(options.dispenserId);
  }

  if (options.startDate) {
    conditions.push('date(d.dispensed_at) >= date(?)');
    params.push(options.startDate);
  }

  if (options.endDate) {
    conditions.push('date(d.dispensed_at) <= date(?)');
    params.push(options.endDate);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY d.dispensed_at DESC';

  if (options.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  const dispenses = query(sql, params);
  return dispenses.map(d => formatDispenseWithDetails(d));
}

/**
 * Count daily dispenses for a patient and prescription
 * @param {number} patientId - Patient ID
 * @param {number} prescriptionId - Prescription ID
 * @returns {number} Count of successful dispenses today
 */
function countDailyDispenses(patientId, prescriptionId) {
  const today = new Date().toISOString().split('T')[0];

  const sql = `
    SELECT COUNT(*) as count
    FROM dispenses
    WHERE patient_id = ?
      AND prescription_id = ?
      AND status = 'exitosa'
      AND date(dispensed_at) = date(?)
  `;

  const result = queryOne(sql, [patientId, prescriptionId, today]);
  return result.count;
}

/**
 * Get last successful dispense for a patient and prescription
 * @param {number} patientId - Patient ID
 * @param {number} prescriptionId - Prescription ID
 * @returns {Object|null} Last dispense or null
 */
function getLastDispense(patientId, prescriptionId) {
  const sql = `
    SELECT * FROM dispenses
    WHERE patient_id = ?
      AND prescription_id = ?
      AND status = 'exitosa'
    ORDER BY dispensed_at DESC
    LIMIT 1
  `;

  const dispense = queryOne(sql, [patientId, prescriptionId]);
  return dispense ? formatDispense(dispense) : null;
}

/**
 * Check if patient can dispense (daily limit + cooldown)
 * @param {number} patientId - Patient ID
 * @param {number} prescriptionId - Prescription ID
 * @param {number} maxDailyDoses - Max doses per day
 * @param {number} cooldownMinutes - Minutes between doses (default: 30)
 * @returns {Object} Authorization status
 */
function canDispense(patientId, prescriptionId, maxDailyDoses, cooldownMinutes = 30) {
  // Check daily limit
  const dailyCount = countDailyDispenses(patientId, prescriptionId);

  if (dailyCount >= maxDailyDoses) {
    return {
      authorized: false,
      reason: `Daily limit reached (${dailyCount}/${maxDailyDoses} doses today)`
    };
  }

  // Check cooldown
  const lastDispense = getLastDispense(patientId, prescriptionId);

  if (lastDispense) {
    const lastDispenseTime = new Date(lastDispense.dispensedAt);
    const now = new Date();
    const minutesSinceLast = (now - lastDispenseTime) / (1000 * 60);

    if (minutesSinceLast < cooldownMinutes) {
      const minutesRemaining = Math.ceil(cooldownMinutes - minutesSinceLast);
      return {
        authorized: false,
        reason: `Please wait ${minutesRemaining} minutes before next dose`,
        minutesRemaining
      };
    }
  }

  return {
    authorized: true,
    dailyCount,
    maxDailyDoses,
    dosesRemaining: maxDailyDoses - dailyCount
  };
}

/**
 * Get dispense history for a patient
 * @param {number} patientId - Patient ID
 * @param {Object} options - Query options (days, limit)
 * @returns {Array} Array of dispenses
 */
function getPatientHistory(patientId, options = {}) {
  const days = options.days || 30;
  const limit = options.limit || 50;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return findByPatientId(patientId, {
    startDate: startDate.toISOString().split('T')[0],
    limit,
    status: 'exitosa'
  });
}

/**
 * Get patient statistics
 * @param {number} patientId - Patient ID
 * @returns {Object} Statistics object
 */
function getPatientStats(patientId) {
  // Total dispenses
  const totalSql = `
    SELECT COUNT(*) as count
    FROM dispenses
    WHERE patient_id = ? AND status = 'exitosa'
  `;
  const totalResult = queryOne(totalSql, [patientId]);

  // Last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentSql = `
    SELECT COUNT(*) as count
    FROM dispenses
    WHERE patient_id = ?
      AND status = 'exitosa'
      AND date(dispensed_at) >= date(?)
  `;
  const recentResult = queryOne(recentSql, [patientId, thirtyDaysAgo.toISOString().split('T')[0]]);

  // Last dispense
  const lastDispenseSql = `
    SELECT * FROM dispenses
    WHERE patient_id = ? AND status = 'exitosa'
    ORDER BY dispensed_at DESC
    LIMIT 1
  `;
  const lastDispense = queryOne(lastDispenseSql, [patientId]);

  // Failed attempts
  const failedSql = `
    SELECT COUNT(*) as count
    FROM dispenses
    WHERE patient_id = ? AND status = 'fallida'
  `;
  const failedResult = queryOne(failedSql, [patientId]);

  return {
    totalDispenses: totalResult.count,
    dispensesLast30Days: recentResult.count,
    lastDispense: lastDispense ? formatDispense(lastDispense) : null,
    failedAttempts: failedResult.count
  };
}

/**
 * Format dispense object (convert DB format to application format)
 * @param {Object} dispense - Raw dispense from database
 * @returns {Object} Formatted dispense
 */
function formatDispense(dispense) {
  if (!dispense) return null;

  const formatted = {
    id: dispense.id,
    patientId: dispense.patient_id,
    prescriptionId: dispense.prescription_id,
    authMethod: dispense.auth_method,
    medicine: {
      name: dispense.medicine_name,
      dosage: {
        amount: dispense.medicine_dosage_amount,
        unit: dispense.medicine_dosage_unit
      }
    },
    dispensedAt: dispense.dispensed_at,
    dispenserId: dispense.dispenser_id,
    status: dispense.status,
    metadata: {
      ipAddress: dispense.metadata_ip_address,
      userAgent: dispense.metadata_user_agent,
      responseTime: dispense.metadata_response_time,
      imageUrl: dispense.metadata_image_url,
      notes: dispense.metadata_notes
    }
  };

  if (dispense.error_code || dispense.error_message) {
    formatted.error = {
      code: dispense.error_code,
      message: dispense.error_message,
      details: dispense.error_details
    };
  }

  return formatted;
}

/**
 * Format dispense with patient and prescription details
 * @param {Object} result - Raw dispense with joins from database
 * @returns {Object} Formatted dispense with details
 */
function formatDispenseWithDetails(result) {
  const dispense = formatDispense(result);

  if (result.patient_cedula) {
    dispense.patient = {
      cedula: result.patient_cedula,
      firstName: result.patient_first_name,
      lastName: result.patient_last_name,
      fullName: `${result.patient_first_name} ${result.patient_last_name}`
    };
  }

  if (result.prescription_medicine_name) {
    dispense.prescription = {
      medicineName: result.prescription_medicine_name,
      dosage: {
        amount: result.prescription_dosage_amount,
        unit: result.prescription_dosage_unit
      }
    };
  }

  return dispense;
}

module.exports = {
  create,
  findById,
  findByIdWithDetails,
  findByPatientId,
  findAll,
  countDailyDispenses,
  getLastDispense,
  canDispense,
  getPatientHistory,
  getPatientStats
};
