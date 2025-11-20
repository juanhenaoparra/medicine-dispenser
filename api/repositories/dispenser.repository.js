/**
 * Dispenser Repository
 *
 * Manages ESP32 dispenser registration and status
 * Uses in-memory storage (can be migrated to database later)
 */

class DispenserRepository {
  constructor() {
    // In-memory store for active dispensers
    this.dispensers = new Map();

    // Heartbeat timeout (2 minutes)
    this.HEARTBEAT_TIMEOUT = 2 * 60 * 1000;

    // Cleanup interval (check every minute)
    this.startCleanupTimer();
  }

  /**
   * Register a new dispenser or update existing one
   * @param {Object} data - { dispenserId, ipAddress, port, metadata }
   * @returns {Object} Registered dispenser info
   */
  register(data) {
    const { dispenserId, ipAddress, port = 8080, metadata = {} } = data;

    if (!dispenserId || !ipAddress) {
      throw new Error('dispenserId and ipAddress are required');
    }

    const dispenser = {
      dispenserId,
      ipAddress,
      port,
      status: 'online',
      registeredAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      metadata: {
        ...metadata,
        lastRegistration: new Date().toISOString()
      }
    };

    this.dispensers.set(dispenserId, dispenser);

    console.log(`[DispenserRepo] Registered: ${dispenserId} at ${ipAddress}:${port}`);

    return dispenser;
  }

  /**
   * Update heartbeat timestamp for a dispenser
   * @param {string} dispenserId
   * @returns {boolean} Success
   */
  updateHeartbeat(dispenserId) {
    const dispenser = this.dispensers.get(dispenserId);

    if (!dispenser) {
      console.warn(`[DispenserRepo] Heartbeat for unknown dispenser: ${dispenserId}`);
      return false;
    }

    dispenser.lastHeartbeat = new Date().toISOString();
    dispenser.status = 'online';

    console.log(`[DispenserRepo] Heartbeat updated: ${dispenserId}`);

    return true;
  }

  /**
   * Unregister a dispenser
   * @param {string} dispenserId
   * @returns {boolean} Success
   */
  unregister(dispenserId) {
    const existed = this.dispensers.delete(dispenserId);

    if (existed) {
      console.log(`[DispenserRepo] Unregistered: ${dispenserId}`);
    }

    return existed;
  }

  /**
   * Find dispenser by ID
   * @param {string} dispenserId
   * @returns {Object|null} Dispenser info or null
   */
  findById(dispenserId) {
    return this.dispensers.get(dispenserId) || null;
  }

  /**
   * Check if dispenser is online (recent heartbeat)
   * @param {string} dispenserId
   * @returns {boolean} Is online
   */
  isOnline(dispenserId) {
    const dispenser = this.dispensers.get(dispenserId);

    if (!dispenser) {
      return false;
    }

    const lastHeartbeat = new Date(dispenser.lastHeartbeat);
    const now = new Date();
    const timeSinceHeartbeat = now - lastHeartbeat;

    return timeSinceHeartbeat < this.HEARTBEAT_TIMEOUT;
  }

  /**
   * Get all registered dispensers
   * @returns {Array} Array of dispensers
   */
  findAll() {
    return Array.from(this.dispensers.values());
  }

  /**
   * Get only online dispensers
   * @returns {Array} Array of online dispensers
   */
  findOnline() {
    return this.findAll().filter(d => this.isOnline(d.dispenserId));
  }

  /**
   * Mark offline dispensers based on heartbeat timeout
   */
  updateDispenserStatuses() {
    const now = new Date();

    for (const [dispenserId, dispenser] of this.dispensers.entries()) {
      const lastHeartbeat = new Date(dispenser.lastHeartbeat);
      const timeSinceHeartbeat = now - lastHeartbeat;

      if (timeSinceHeartbeat >= this.HEARTBEAT_TIMEOUT) {
        if (dispenser.status === 'online') {
          dispenser.status = 'offline';
          console.warn(`[DispenserRepo] Marked offline: ${dispenserId} (no heartbeat for ${Math.round(timeSinceHeartbeat / 1000)}s)`);
        }
      }
    }
  }

  /**
   * Start background timer to cleanup stale dispensers
   */
  startCleanupTimer() {
    setInterval(() => {
      this.updateDispenserStatuses();
    }, 60 * 1000); // Run every minute

    console.log('[DispenserRepo] Cleanup timer started');
  }

  /**
   * Get statistics
   * @returns {Object} Stats
   */
  getStats() {
    const all = this.findAll();
    const online = this.findOnline();

    return {
      total: all.length,
      online: online.length,
      offline: all.length - online.length,
      dispensers: all.map(d => ({
        dispenserId: d.dispenserId,
        status: this.isOnline(d.dispenserId) ? 'online' : 'offline',
        lastHeartbeat: d.lastHeartbeat
      }))
    };
  }
}

// Singleton instance
const dispenserRepository = new DispenserRepository();

module.exports = dispenserRepository;
