const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

/**
 * Initialize SQLite database connection
 * @param {string} dbPath - Path to SQLite database file (optional)
 * @returns {Database} SQLite database instance
 */
function initializeDatabase(dbPath = null) {
  try {
    // Default database path
    const defaultPath = path.join(__dirname, '..', 'data', 'medicine-dispenser.db');
    const finalPath = dbPath || process.env.SQLITE_PATH || defaultPath;

    // Ensure data directory exists
    const dataDir = path.dirname(finalPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Create/open database
    db = new Database(finalPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : null
    });

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');

    console.log(`SQLite Connected: ${finalPath}`);

    // Initialize schema
    initializeSchema();

    return db;
  } catch (error) {
    console.error(`Error connecting to SQLite: ${error.message}`);
    throw error;
  }
}

/**
 * Initialize database schema
 */
function initializeSchema() {
  try {
    const schemaPath = path.join(__dirname, '..', 'schema', 'init.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute entire schema at once
    try {
      db.exec(schema);
      console.log('Database schema initialized successfully');
    } catch (err) {
      // If error is just about existing objects, ignore it
      if (err.message.includes('already exists')) {
        console.log('Database schema already initialized');
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error(`Error initializing schema: ${error.message}`);
    throw error;
  }
}

/**
 * Get database instance
 * @returns {Database} SQLite database instance
 */
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('Database connection closed');
  }
}

/**
 * Execute a transaction
 * @param {Function} callback - Function to execute within transaction
 * @returns {*} Result of callback
 */
function transaction(callback) {
  const db = getDatabase();
  const transactionFn = db.transaction(callback);
  return transactionFn();
}

/**
 * Prepare a statement (cached)
 * @param {string} sql - SQL query
 * @returns {Statement} Prepared statement
 */
function prepare(sql) {
  const db = getDatabase();
  return db.prepare(sql);
}

/**
 * Execute a query that returns multiple rows
 * @param {string} sql - SQL query
 * @param {*} params - Query parameters
 * @returns {Array} Array of rows
 */
function query(sql, params = []) {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  return stmt.all(params);
}

/**
 * Execute a query that returns a single row
 * @param {string} sql - SQL query
 * @param {*} params - Query parameters
 * @returns {Object|null} Single row or null
 */
function queryOne(sql, params = []) {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  return stmt.get(params);
}

/**
 * Execute a query that modifies data (INSERT, UPDATE, DELETE)
 * @param {string} sql - SQL query
 * @param {*} params - Query parameters
 * @returns {Object} Info object with changes and lastInsertRowid
 */
function execute(sql, params = []) {
  const db = getDatabase();
  const stmt = db.prepare(sql);
  return stmt.run(params);
}

/**
 * Get count of rows
 * @param {string} table - Table name
 * @param {string} where - WHERE clause (optional)
 * @param {*} params - Query parameters
 * @returns {number} Row count
 */
function count(table, where = '', params = []) {
  const sql = where
    ? `SELECT COUNT(*) as count FROM ${table} WHERE ${where}`
    : `SELECT COUNT(*) as count FROM ${table}`;
  const result = queryOne(sql, params);
  return result.count;
}

// Handle process termination
process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  transaction,
  prepare,
  query,
  queryOne,
  execute,
  count
};
