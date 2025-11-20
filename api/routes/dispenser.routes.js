/**
 * Dispenser Routes
 *
 * Endpoints for ESP32 dispenser registration and management
 */

const express = require('express');
const router = express.Router();
const dispenserRepo = require('../repositories/dispenser.repository');
const notificationService = require('../services/notification.service');

/**
 * POST /api/dispensers/register
 * Register ESP32 dispenser with the server
 *
 * Body: {
 *   dispenserId: string,
 *   ipAddress: string,
 *   port: number (optional, default 8080),
 *   metadata: object (optional)
 * }
 */
router.post('/register', async (req, res) => {
  try {
    const { dispenserId, ipAddress, port, metadata } = req.body;

    // Validation
    if (!dispenserId) {
      return res.status(400).json({
        success: false,
        error: 'dispenserId is required'
      });
    }

    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        error: 'ipAddress is required'
      });
    }

    // Register dispenser
    const dispenser = dispenserRepo.register({
      dispenserId,
      ipAddress,
      port: port || 8080,
      metadata: {
        ...metadata,
        userAgent: req.get('User-Agent'),
        registeredFrom: req.ip
      }
    });

    console.log(`[API] Dispenser registered: ${dispenserId} at ${ipAddress}:${dispenser.port}`);

    res.status(200).json({
      success: true,
      message: 'Dispenser registered successfully',
      dispenser: {
        dispenserId: dispenser.dispenserId,
        ipAddress: dispenser.ipAddress,
        port: dispenser.port,
        status: dispenser.status,
        registeredAt: dispenser.registeredAt
      }
    });

  } catch (error) {
    console.error('[API] Error registering dispenser:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to register dispenser',
      details: error.message
    });
  }
});

/**
 * POST /api/dispensers/:dispenserId/heartbeat
 * Update heartbeat for a dispenser (keep-alive)
 */
router.post('/:dispenserId/heartbeat', (req, res) => {
  try {
    const { dispenserId } = req.params;

    const success = dispenserRepo.updateHeartbeat(dispenserId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Dispenser not found. Please register first.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Heartbeat updated',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API] Error updating heartbeat:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to update heartbeat',
      details: error.message
    });
  }
});

/**
 * POST /api/dispensers/:dispenserId/unregister
 * Unregister dispenser from server
 */
router.post('/:dispenserId/unregister', (req, res) => {
  try {
    const { dispenserId } = req.params;

    const success = dispenserRepo.unregister(dispenserId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Dispenser not found'
      });
    }

    console.log(`[API] Dispenser unregistered: ${dispenserId}`);

    res.status(200).json({
      success: true,
      message: 'Dispenser unregistered successfully'
    });

  } catch (error) {
    console.error('[API] Error unregistering dispenser:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to unregister dispenser',
      details: error.message
    });
  }
});

/**
 * GET /api/dispensers/:dispenserId
 * Get dispenser information
 */
router.get('/:dispenserId', (req, res) => {
  try {
    const { dispenserId } = req.params;

    const dispenser = dispenserRepo.findById(dispenserId);

    if (!dispenser) {
      return res.status(404).json({
        success: false,
        error: 'Dispenser not found'
      });
    }

    const isOnline = dispenserRepo.isOnline(dispenserId);

    res.status(200).json({
      success: true,
      dispenser: {
        ...dispenser,
        status: isOnline ? 'online' : 'offline',
        isOnline
      }
    });

  } catch (error) {
    console.error('[API] Error getting dispenser:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to get dispenser',
      details: error.message
    });
  }
});

/**
 * GET /api/dispensers
 * Get all dispensers
 */
router.get('/', (req, res) => {
  try {
    const stats = dispenserRepo.getStats();

    res.status(200).json({
      success: true,
      ...stats
    });

  } catch (error) {
    console.error('[API] Error getting dispensers:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to get dispensers',
      details: error.message
    });
  }
});

/**
 * GET /api/dispensers/:dispenserId/health
 * Test connection to dispenser
 */
router.get('/:dispenserId/health', async (req, res) => {
  try {
    const { dispenserId } = req.params;

    const dispenser = dispenserRepo.findById(dispenserId);

    if (!dispenser) {
      return res.status(404).json({
        success: false,
        error: 'Dispenser not found'
      });
    }

    const isReachable = await notificationService.testConnection(
      dispenser.ipAddress,
      dispenser.port
    );

    res.status(200).json({
      success: true,
      dispenserId,
      isReachable,
      ipAddress: dispenser.ipAddress,
      port: dispenser.port,
      lastHeartbeat: dispenser.lastHeartbeat
    });

  } catch (error) {
    console.error('[API] Error checking health:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to check health',
      details: error.message
    });
  }
});

module.exports = router;
