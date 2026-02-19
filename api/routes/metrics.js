/**
 * Metrics Dashboard Routes
 * API endpoints for metrics and analytics
 *
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const metricsService = require('../services/metricsService');

/**
 * @route   GET /api/v1/metrics
 * @desc    Get all metrics
 * @access  Public (or require auth in production)
 */
router.get('/metrics', async (req, res) => {
  try {
    const data = metricsService.getDashboardData();
    res.status(200).json(data);
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve metrics',
    });
  }
});

/**
 * @route   GET /api/v1/metrics/system
 * @desc    Get system metrics
 * @access  Public
 */
router.get('/metrics/system', async (req, res) => {
  try {
    const data = metricsService.getSystemMetrics();
    res.status(200).json(data);
  } catch (error) {
    console.error('System metrics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve system metrics',
    });
  }
});

/**
 * @route   GET /api/v1/metrics/tasks
 * @desc    Get task metrics
 * @access  Public
 */
router.get('/metrics/tasks', async (req, res) => {
  try {
    const data = metricsService.getTaskMetrics();
    res.status(200).json(data);
  } catch (error) {
    console.error('Task metrics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve task metrics',
    });
  }
});

/**
 * @route   GET /api/v1/metrics/agents
 * @desc    Get agent metrics
 * @access  Public
 */
router.get('/metrics/agents', async (req, res) => {
  try {
    const data = metricsService.getAgentMetrics();
    res.status(200).json(data);
  } catch (error) {
    console.error('Agent metrics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve agent metrics',
    });
  }
});

/**
 * @route   GET /api/v1/metrics/federation
 * @desc    Get federation metrics
 * @access  Public
 */
router.get('/metrics/federation', async (req, res) => {
  try {
    const data = metricsService.getFederationMetrics();
    res.status(200).json(data);
  } catch (error) {
    console.error('Federation metrics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve federation metrics',
    });
  }
});

/**
 * @route   GET /api/v1/metrics/queue
 * @desc    Get queue metrics
 * @access  Public
 */
router.get('/metrics/queue', async (req, res) => {
  try {
    const data = metricsService.getQueueMetrics();
    res.status(200).json(data);
  } catch (error) {
    console.error('Queue metrics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve queue metrics',
    });
  }
});

/**
 * @route   GET /api/v1/metrics/history/:name
 * @desc    Get metric history
 * @access  Public
 */
router.get('/metrics/history/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { limit = 100 } = req.query;

    const history = metricsService.getHistory(name, parseInt(limit));
    res.status(200).json({
      metric: name,
      history,
      count: history.length,
    });
  } catch (error) {
    console.error('Metrics history error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve metrics history',
    });
  }
});

module.exports = router;
