/**
 * Notification Service
 *
 * Handles push notifications to ESP32 dispensers via HTTP
 */

const axios = require('axios');

// Configuration
const ESP32_TIMEOUT = parseInt(process.env.ESP32_TIMEOUT) || 5000; // 5 seconds
const ESP32_RETRY_ATTEMPTS = parseInt(process.env.ESP32_RETRY_ATTEMPTS) || 2;
const ESP32_RETRY_DELAY = 1000; // 1 second between retries

class NotificationService {
  /**
   * Send session notification to ESP32 dispenser
   * @param {string} ipAddress - ESP32 IP address
   * @param {number} port - ESP32 port (default 8080)
   * @param {Object} sessionData - Session information
   * @returns {Promise<Object>} { success, error, attempts }
   */
  async notifyDispenser(ipAddress, port, sessionData) {
    const url = `http://${ipAddress}:${port}/dispense`;

    const payload = {
      sessionId: sessionData.sessionId,
      patient: sessionData.patientInfo?.name || 'Unknown',
      medicine: sessionData.medicineInfo?.name || 'Unknown',
      dosage: sessionData.medicineInfo?.dosage || 'Unknown',
      expiresAt: sessionData.expiresAt
    };

    console.log(`[NotificationService] Notifying ESP32 at ${url}`);
    console.log(`[NotificationService] Session: ${payload.sessionId}`);

    let lastError = null;

    // Try with retries
    for (let attempt = 1; attempt <= ESP32_RETRY_ATTEMPTS; attempt++) {
      try {
        console.log(`[NotificationService] Attempt ${attempt}/${ESP32_RETRY_ATTEMPTS}`);

        const response = await axios.post(url, payload, {
          timeout: ESP32_TIMEOUT,
          headers: {
            'Content-Type': 'application/json'
          },
          validateStatus: (status) => status >= 200 && status < 300
        });

        console.log(`[NotificationService] ✓ Success! Response: ${response.status}`);

        return {
          success: true,
          attempts: attempt,
          responseStatus: response.status,
          responseData: response.data
        };

      } catch (error) {
        lastError = error;

        const errorMessage = this.formatError(error);
        console.warn(`[NotificationService] ✗ Attempt ${attempt} failed: ${errorMessage}`);

        // Wait before retry (except on last attempt)
        if (attempt < ESP32_RETRY_ATTEMPTS) {
          console.log(`[NotificationService] Retrying in ${ESP32_RETRY_DELAY}ms...`);
          await this.sleep(ESP32_RETRY_DELAY);
        }
      }
    }

    // All attempts failed
    const finalError = this.formatError(lastError);
    console.error(`[NotificationService] ✗ All attempts failed: ${finalError}`);

    return {
      success: false,
      attempts: ESP32_RETRY_ATTEMPTS,
      error: finalError,
      errorDetails: this.getErrorDetails(lastError)
    };
  }

  /**
   * Format error message for logging
   * @param {Error} error
   * @returns {string} Human-readable error
   */
  formatError(error) {
    if (error.code === 'ECONNREFUSED') {
      return 'Connection refused - ESP32 not reachable';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return 'Request timeout - ESP32 not responding';
    } else if (error.code === 'EHOSTUNREACH') {
      return 'Host unreachable - Check network';
    } else if (error.response) {
      return `HTTP ${error.response.status}: ${error.response.statusText}`;
    } else if (error.request) {
      return 'No response from ESP32';
    } else {
      return error.message || 'Unknown error';
    }
  }

  /**
   * Get detailed error information for debugging
   * @param {Error} error
   * @returns {Object} Error details
   */
  getErrorDetails(error) {
    return {
      code: error.code,
      message: error.message,
      type: error.name,
      hasResponse: !!error.response,
      hasRequest: !!error.request,
      config: error.config ? {
        url: error.config.url,
        method: error.config.method,
        timeout: error.config.timeout
      } : null
    };
  }

  /**
   * Sleep utility for retry delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test connection to ESP32 (health check)
   * @param {string} ipAddress
   * @param {number} port
   * @returns {Promise<boolean>} Is reachable
   */
  async testConnection(ipAddress, port) {
    try {
      const url = `http://${ipAddress}:${port}/health`;

      const response = await axios.get(url, {
        timeout: 3000,
        validateStatus: (status) => status >= 200 && status < 500
      });

      return response.status === 200;
    } catch (error) {
      console.warn(`[NotificationService] Health check failed: ${this.formatError(error)}`);
      return false;
    }
  }
}

// Singleton instance
const notificationService = new NotificationService();

module.exports = notificationService;
