/**
 * Real-time Notifications Service
 * WebSocket-based real-time notifications
 *
 * @version 1.0.0
 */

const WebSocket = require('ws');

// Notification Types
const NotificationType = {
  TASK_ASSIGNED: 'task_assigned',
  TASK_COMPLETED: 'task_completed',
  TASK_FAILED: 'task_failed',
  AGENT_REGISTERED: 'agent_registered',
  AGENT_HEARTBEAT: 'agent_heartbeat',
  SYSTEM_ALERT: 'system_alert',
  TEAM_UPDATE: 'team_update',
  MESSAGE: 'message',
};

/**
 * Notification Manager
 */
class NotificationManager {
  constructor() {
    this.clients = new Map(); // clientId -> ws connection
    this.subscriptions = new Map(); // clientId -> Set of topics
    this.clientCounter = 0;
  }

  /**
   * Create notification server
   * @param {Object} options - Server options
   * @returns {WebSocket.Server>} WebSocket server
   */
  createServer(options = {}) {
    const wss = new WebSocket.Server({
      port: options.port || 3001,
      path: options.path || '/ws',
    });

    wss.on('connection', (ws, req) => {
      const clientId = `client_${++this.clientCounter}`;

      this.clients.set(clientId, {
        id: clientId,
        ws,
        connectedAt: Date.now(),
        subscriptions: new Set(),
      });

      console.log(`Notification client connected: ${clientId}`);

      // Send welcome message
      this.sendToClient(clientId, {
        type: NotificationType.MESSAGE,
        data: {
          message: 'Connected to Nervix notifications',
          clientId,
        },
      });

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(clientId, data);
        } catch (error) {
          console.error('Invalid message:', error);
        }
      });

      ws.on('close', () => {
        console.log(`Notification client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error (${clientId}):`, error);
        this.clients.delete(clientId);
      });
    });

    return wss;
  }

  /**
   * Handle incoming message from client
   * @param {string} clientId - Client ID
   * @param {Object} data - Message data
   * @returns {void}
   */
  handleMessage(clientId, data) {
    const { action, topic } = data;
    const client = this.clients.get(clientId);

    if (!client) return;

    switch (action) {
      case 'subscribe':
        if (topic) {
          client.subscriptions.add(topic);
          this.sendToClient(clientId, {
            type: NotificationType.MESSAGE,
            data: {
              message: `Subscribed to: ${topic}`,
            },
          });
        }
        break;

      case 'unsubscribe':
        if (topic) {
          client.subscriptions.delete(topic);
          this.sendToClient(clientId, {
            type: NotificationType.MESSAGE,
            data: {
              message: `Unsubscribed from: ${topic}`,
            },
          });
        }
        break;

      case 'ping':
        this.sendToClient(clientId, {
          type: NotificationType.MESSAGE,
          data: {
            type: 'pong',
            timestamp: Date.now(),
          },
        });
        break;

      default:
        console.log(`Unknown action: ${action}`);
    }
  }

  /**
   * Send message to specific client
   * @param {string} clientId - Client ID
   * @param {Object} message - Message to send
   * @returns {boolean} Success
   */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify({
        ...message,
        timestamp: Date.now(),
      }));
      return true;
    } catch (error) {
      console.error(`Failed to send to ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast message to all clients
   * @param {Object} message - Message to broadcast
   * @returns {number} Number of clients notified
   */
  broadcast(message) {
    let count = 0;

    for (const [clientId, client] of this.clients) {
      if (this.sendToClient(clientId, message)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Send message to topic subscribers
   * @param {string} topic - Topic name
   * @param {Object} message - Message to send
   * @returns {number} Number of clients notified
   */
  sendToTopic(topic, message) {
    let count = 0;

    for (const [clientId, client] of this.clients) {
      if (client.subscriptions.has(topic)) {
        if (this.sendToClient(clientId, message)) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Send task assigned notification
   * @param {string} agentId - Agent ID
   * @param {string} taskId - Task ID
   * @returns {number} Number of clients notified
   */
  notifyTaskAssigned(agentId, taskId) {
    return this.sendToTopic(`agent:${agentId}`, {
      type: NotificationType.TASK_ASSIGNED,
      data: {
        agentId,
        taskId,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Send task completed notification
   * @param {string} agentId - Agent ID
   * @param {string} taskId - Task ID
   * @returns {number} Number of clients notified
   */
  notifyTaskCompleted(agentId, taskId) {
    return this.sendToTopic(`agent:${agentId}`, {
      type: NotificationType.TASK_COMPLETED,
      data: {
        agentId,
        taskId,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Send task failed notification
   * @param {string} agentId - Agent ID
   * @param {string} taskId - Task ID
   * @returns {number} Number of clients notified
   */
  notifyTaskFailed(agentId, taskId) {
    return this.sendToTopic(`agent:${agentId}`, {
      type: NotificationType.TASK_FAILED,
      data: {
        agentId,
        taskId,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Send agent registered notification
   * @param {string} agentId - Agent ID
   * @param {string} agentName - Agent name
   * @returns {number} Number of clients notified
   */
  notifyAgentRegistered(agentId, agentName) {
    return this.broadcast({
      type: NotificationType.AGENT_REGISTERED,
      data: {
        agentId,
        agentName,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Send system alert notification
   * @param {string} message - Alert message
   * @param {string} level - Alert level (info, warning, error)
   * @returns {number} Number of clients notified
   */
  notifySystemAlert(message, level = 'info') {
    return this.broadcast({
      type: NotificationType.SYSTEM_ALERT,
      data: {
        message,
        level,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Get statistics
   * @returns {Object}
   */
  getStats() {
    return {
      totalClients: this.clients.size,
      totalSubscriptions: Array.from(this.clients.values())
        .reduce((sum, client) => sum + client.subscriptions.size, 0),
    };
  }
}

// Singleton instance
const notificationManager = new NotificationManager();

module.exports = {
  NotificationType,
  NotificationManager,
  notificationManager,
};
