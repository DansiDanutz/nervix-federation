/**
 * Team Orchestration System
 * Professional team management, task delegation, and nanobot coordination
 *
 * @version 1.0.0
 */

const crypto = require('crypto');
const skillsDatabase = require('./skillsDatabase');

// Agent Status
const AgentStatus = {
  IDLE: 'idle',
  BUSY: 'busy',
  OFFLINE: 'offline',
  MAINTENANCE: 'maintenance',
};

// Agent Role
const AgentRole = {
  DEVELOPER: 'developer',
  TESTER: 'tester',
  DOCUMENTATION: 'documentation',
  RESEARCHER: 'researcher',
  OPERATIONS: 'operations',
  SECURITY: 'security',
  ARCHITECT: 'architect',
  LEAD: 'lead',
};

/**
 * Agent Team Member
 */
class AgentTeamMember {
  constructor(id, config) {
    this.id = id;
    this.name = config.name || `Agent ${id}`;
    this.role = config.role || AgentRole.DEVELOPER;
    this.status = config.status || AgentStatus.IDLE;
    this.capabilities = config.capabilities || [];
    this.currentTask = null;
    this.tasksCompleted = 0;
    this.tasksFailed = 0;
    this.totalEarnings = 0;
    this.reputationScore = 50;
    this.createdAt = Date.now();
    this.lastSeen = Date.now();
    this.metadata = config.metadata || {};
  }

  /**
   * Update status
   * @param {string} status - New status
   * @returns {void}
   */
  updateStatus(status) {
    this.status = status;
    this.lastSeen = Date.now();
  }

  /**
   * Assign task
   * @param {string} taskId - Task ID
   * @returns {void}
   */
  assignTask(taskId) {
    this.currentTask = taskId;
    this.status = AgentStatus.BUSY;
    this.lastSeen = Date.now();
  }

  /**
   * Complete task
   * @param {number} reward - Task reward
   * @returns {void}
   */
  completeTask(reward) {
    this.currentTask = null;
    this.status = AgentStatus.IDLE;
    this.tasksCompleted++;
    this.totalEarnings += reward;
    this.lastSeen = Date.now();

    // Update reputation (simple formula)
    this.reputationScore = Math.min(100, this.reputationScore + 0.5);
  }

  /**
   * Fail task
   * @returns {void}
   */
  failTask() {
    this.currentTask = null;
    this.status = AgentStatus.IDLE;
    this.tasksFailed++;
    this.lastSeen = Date.now();

    // Decrease reputation
    this.reputationScore = Math.max(0, this.reputationScore - 1);
  }

  /**
   * Get success rate
   * @returns {number} Success rate (0-1)
   */
  getSuccessRate() {
    const total = this.tasksCompleted + this.tasksFailed;
    return total === 0 ? 0 : this.tasksCompleted / total;
  }

  /**
   * Convert to object
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      status: this.status,
      capabilities: this.capabilities,
      currentTask: this.currentTask,
      stats: {
        completed: this.tasksCompleted,
        failed: this.tasksFailed,
        earnings: this.totalEarnings,
        reputation: this.reputationScore,
        successRate: this.getSuccessRate(),
      },
      lastSeen: this.lastSeen,
      createdAt: this.createdAt,
    };
  }
}

/**
 * Team Orchestration Manager
 */
class TeamOrchestrationManager {
  constructor() {
    this.agents = new Map();
    this.tasks = new Map();
    this.teams = new Map();
    this.taskQueue = [];
    this.activeAssignments = new Map();
    this.stats = {
      totalTasks: 0,
      tasksAssigned: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
    };
  }

  /**
   * Register agent
   * @param {string} agentId - Agent ID
   * @param {Object} config - Agent configuration
   * @returns {AgentTeamMember}
   */
  registerAgent(agentId, config = {}) {
    const agent = new AgentTeamMember(agentId, config);
    this.agents.set(agentId, agent);
    console.log(`Agent registered: ${agent.name} (${agentId})`);
    return agent;
  }

  /**
   * Unregister agent
   * @param {string} agentId - Agent ID
   * @returns {boolean}
   */
  unregisterAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    // Unassign any active task
    if (agent.currentTask) {
      this.unassignTask(agent.currentTask);
    }

    this.agents.delete(agentId);
    console.log(`Agent unregistered: ${agent.name} (${agentId})`);
    return true;
  }

  /**
   * Get agent
   * @param {string} agentId - Agent ID
   * @returns {AgentTeamMember|null>}
   */
  getAgent(agentId) {
    return this.agents.get(agentId) || null;
  }

  /**
   * Get all agents
   * @param {Object} filters - Filter criteria
   * @returns {Array<AgentTeamMember>>} List of agents
   */
  getAgents(filters = {}) {
    let agents = Array.from(this.agents.values());

    if (filters.status) {
      agents = agents.filter(a => a.status === filters.status);
    }

    if (filters.role) {
      agents = agents.filter(a => a.role === filters.role);
    }

    if (filters.available) {
      agents = agents.filter(a => a.status === AgentStatus.IDLE);
    }

    return agents;
  }

  /**
   * Find best agent for task
   * @param {Object} task - Task requirements
   * @returns {AgentTeamMember|null>} Best matching agent
   */
  findBestAgent(task) {
    const available = this.getAgents({ available: true });

    if (available.length === 0) {
      return null;
    }

    // Score agents based on task requirements
    const scored = available.map(agent => {
      let score = 0;

      // Capability match
      const requiredCapabilities = task.requiredCapabilities || [];
      const matchingCapabilities = agent.capabilities.filter(cap =>
        requiredCapabilities.includes(cap)
      );
      score += (matchingCapabilities.length / Math.max(requiredCapabilities.length, 1)) * 40;

      // Reputation bonus
      score += agent.reputationScore * 0.3;

      // Success rate bonus
      score += agent.getSuccessRate() * 30;

      return { agent, score };
    });

    // Sort by score and return best
    scored.sort((a, b) => b.score - a.score);

    return scored[0].agent;
  }

  /**
   * Assign task to agent
   * @param {string} taskId - Task ID
   * @param {string} agentId - Agent ID
   * @returns {boolean} Success
   */
  assignTask(taskId, agentId) {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status !== AgentStatus.IDLE) {
      return false;
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    agent.assignTask(taskId);
    this.activeAssignments.set(taskId, {
      agentId,
      assignedAt: Date.now(),
      task,
    });

    this.stats.tasksAssigned++;
    console.log(`Task assigned: ${taskId} → ${agent.name}`);

    return true;
  }

  /**
   * Auto-assign task to best available agent
   * @param {string} taskId - Task ID
   * @returns {boolean} Success
   */
  autoAssignTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    const bestAgent = this.findBestAgent(task);
    if (!bestAgent) {
      return false;
    }

    return this.assignTask(taskId, bestAgent.id);
  }

  /**
   * Unassign task
   * @param {string} taskId - Task ID
   * @returns {boolean} Success
   */
  unassignTask(taskId) {
    const assignment = this.activeAssignments.get(taskId);
    if (!assignment) {
      return false;
    }

    const agent = this.agents.get(assignment.agentId);
    if (agent && agent.currentTask === taskId) {
      agent.status = AgentStatus.IDLE;
      agent.currentTask = null;
    }

    this.activeAssignments.delete(taskId);
    console.log(`Task unassigned: ${taskId}`);
    return true;
  }

  /**
   * Mark task as completed
   * @param {string} taskId - Task ID
   * @param {number} reward - Task reward
   * @returns {boolean} Success
   */
  completeTask(taskId, reward = 10) {
    const assignment = this.activeAssignments.get(taskId);
    if (!assignment) {
      return false;
    }

    const agent = this.agents.get(assignment.agentId);
    if (agent) {
      agent.completeTask(reward);
    }

    this.activeAssignments.delete(taskId);
    this.tasks.delete(taskId);
    this.stats.tasksCompleted++;
    console.log(`Task completed: ${taskId} (reward: ${reward})`);

    return true;
  }

  /**
   * Mark task as failed
   * @param {string} taskId - Task ID
   * @returns {boolean} Success
   */
  failTask(taskId) {
    const assignment = this.activeAssignments.get(taskId);
    if (!assignment) {
      return false;
    }

    const agent = this.agents.get(assignment.agentId);
    if (agent) {
      agent.failTask();
    }

    this.activeAssignments.delete(taskId);
    this.tasks.delete(taskId);
    this.stats.tasksFailed++;
    console.log(`Task failed: ${taskId}`);

    return true;
  }

  /**
   * Create team
   * @param {string} teamId - Team ID
   * @param {Object} config - Team configuration
   * @returns {Object} Team
   */
  createTeam(teamId, config = {}) {
    const team = {
      id: teamId,
      name: config.name || `Team ${teamId}`,
      members: config.members || [],
      lead: config.lead || null,
      createdAt: Date.now(),
    };

    this.teams.set(teamId, team);
    console.log(`Team created: ${team.name} (${teamId})`);
    return team;
  }

  /**
   * Get team
   * @param {string} teamId - Team ID
   * @returns {Object|null>} Team or null
   */
  getTeam(teamId) {
    return this.teams.get(teamId) || null;
  }

  /**
   * Get all teams
   * @returns {Array>} List of teams
   */
  getTeams() {
    return Array.from(this.teams.values());
  }

  /**
   * Get statistics
   * @returns {Object}
   */
  getStats() {
    const agents = Array.from(this.agents.values());

    return {
      ...this.stats,
      agents: {
        total: agents.length,
        idle: agents.filter(a => a.status === AgentStatus.IDLE).length,
        busy: agents.filter(a => a.status === AgentStatus.BUSY).length,
        offline: agents.filter(a => a.status === AgentStatus.OFFLINE).length,
      },
      teams: this.teams.size,
      activeAssignments: this.activeAssignments.size,
    };
  }

  /**
   * Generate team report
   * @returns {string} Markdown report
   */
  generateReport() {
    const stats = this.getStats();
    const agents = this.getAgents();

    let report = '# Team Report\n\n';
    report += `## Statistics\n\n`;
    report += `- **Total Agents:** ${stats.agents.total}\n`;
    report += `- **Idle Agents:** ${stats.agents.idle}\n`;
    report += `- **Busy Agents:** ${stats.agents.busy}\n`;
    report += `- **Tasks Completed:** ${stats.tasksCompleted}\n`;
    report += `- **Tasks Failed:** ${stats.tasksFailed}\n`;
    report += `- **Success Rate:** ${stats.tasksCompleted + stats.tasksFailed > 0
      ? Math.round((stats.tasksCompleted / (stats.tasksCompleted + stats.tasksFailed)) * 100) + '%'
      : 'N/A'}\n\n`;

    report += `## Agents\n\n`;
    for (const agent of agents) {
      report += `### ${agent.name} (${agent.id})\n`;
      report += `- **Role:** ${agent.role}\n`;
      report += `- **Status:** ${agent.status}\n`;
      report += `- **Reputation:** ${agent.reputationScore.toFixed(1)}\n`;
      report += `- **Completed:** ${agent.tasksCompleted}\n`;
      report += `- **Failed:** ${agent.tasksFailed}\n`;
      report += `- **Success Rate:** ${Math.round(agent.getSuccessRate() * 100)}%\n`;
      report += `- **Current Task:** ${agent.currentTask || 'None'}\n\n`;
    }

    return report;
  }
}

// Singleton instance
const teamOrchestrationManager = new TeamOrchestrationManager();

// Auto-assign tasks periodically
setInterval(() => {
  const pendingTasks = Array.from(teamOrchestrationManager.tasks.values()).filter(t => !t.assigned);
  for (const task of pendingTasks) {
    teamOrchestrationManager.autoAssignTask(task.id);
  }
}, 10000);

module.exports = {
  AgentStatus,
  AgentRole,
  AgentTeamMember,
  TeamOrchestrationManager,
  teamOrchestrationManager,
};
