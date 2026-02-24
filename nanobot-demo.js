/**
 * Nanobot Task Demo
 * Simple in-memory demonstration of nanobot orchestration
 */

const crypto = require('crypto');

// ============================================================================
// In-Memory Task Queue
// ============================================================================

class TaskQueue {
  constructor() {
    this.tasks = new Map();
    this.taskIdCounter = 0;
  }

  /**
   * Create a new task
   */
  createTask(title, description, complexity = 'medium', reward = 10.0) {
    const taskId = `task-${++this.taskIdCounter}`;
    const task = {
      id: taskId,
      title,
      description,
      complexity,
      reward,
      status: 'available',
      assignedTo: null,
      createdAt: new Date().toISOString(),
      assignedAt: null,
      completedAt: null,
      result: null,
    };
    this.tasks.set(taskId, task);
    return task;
  }

  /**
   * Get available tasks for an agent
   */
  getAvailableTasks(limit = 5) {
    return Array.from(this.tasks.values())
      .filter(task => task.status === 'available')
      .slice(0, limit);
  }

  /**
   * Claim a task
   */
  claimTask(taskId, agentId) {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'available') {
      return null;
    }

    task.status = 'assigned';
    task.assignedTo = agentId;
    task.assignedAt = new Date().toISOString();

    return task;
  }

  /**
   * Complete a task
   */
  completeTask(taskId, result) {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'assigned') {
      return null;
    }

    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.result = result;

    return task;
  }

  /**
   * Get task by ID
   */
  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks() {
    return Array.from(this.tasks.values());
  }

  /**
   * Get statistics
   */
  getStats() {
    const tasks = Array.from(this.tasks.values());
    return {
      total: tasks.length,
      available: tasks.filter(t => t.status === 'available').length,
      assigned: tasks.filter(t => t.status === 'assigned').length,
      completed: tasks.filter(t => t.status === 'completed').length,
    };
  }
}

// ============================================================================
// Nanobot Simulator
// ============================================================================

class NanobotSimulator {
  constructor(botId, name, skills = []) {
    this.id = botId;
    this.name = name;
    this.skills = skills;
    this.status = 'idle';
    this.currentTask = null;
    this.tasksCompleted = 0;
    this.totalEarnings = 0;
  }

  /**
   * Poll for tasks
   */
  async pollForTasks(taskQueue) {
    if (this.status !== 'idle') {
      return null;
    }

    const availableTasks = taskQueue.getAvailableTasks(1);
    if (availableTasks.length === 0) {
      return null;
    }

    const task = availableTasks[0];
    const claimed = taskQueue.claimTask(task.id, this.id);

    if (claimed) {
      this.status = 'working';
      this.currentTask = claimed;
      console.log(`[NANOBOT] ${this.name} (${this.id}) claimed task: ${claimed.title}`);
      return claimed;
    }

    return null;
  }

  /**
   * Execute current task
   */
  async executeTask() {
    if (!this.currentTask || this.status !== 'working') {
      return null;
    }

    // Simulate work time (1-3 seconds)
    const workTime = 1000 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, workTime));

    // Simulate task completion with result
    const result = {
      agentId: this.id,
      agentName: this.name,
      taskId: this.currentTask.id,
      taskTitle: this.currentTask.title,
      completedAt: new Date().toISOString(),
      workTimeMs: workTime,
      quality: 0.8 + Math.random() * 0.2, // 80-100% quality
      notes: `Task completed by ${this.name} using ${this.skills.join(', ')}`,
    };

    this.status = 'idle';
    this.tasksCompleted++;
    this.totalEarnings += this.currentTask.reward;
    const completedTask = this.currentTask;
    this.currentTask = null;

    console.log(`[NANOBOT] ${this.name} (${this.id}) completed task: ${completedTask.title} (Earned: $${completedTask.reward.toFixed(2)})`);

    return { task: completedTask, result };
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      skills: this.skills,
      status: this.status,
      currentTask: this.currentTask ? this.currentTask.id : null,
      tasksCompleted: this.tasksCompleted,
      totalEarnings: this.totalEarnings,
    };
  }
}

// ============================================================================
// Orchestration Manager
// ============================================================================

class OrchestrationManager {
  constructor() {
    this.taskQueue = new TaskQueue();
    this.nanobots = new Map();
    this.isRunning = false;
  }

  /**
   * Create nanobots
   */
  createNanobots(count) {
    const skills = ['coding', 'testing', 'documentation', 'research', 'security'];
    const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega'];

    for (let i = 0; i < count; i++) {
      const botId = `nanobot-${i + 1}`;
      const botSkills = skills.slice(0, 1 + Math.floor(Math.random() * skills.length));
      const botName = names[i] || `Nanobot-${i + 1}`;

      const nanobot = new NanobotSimulator(botId, botName, botSkills);
      this.nanobots.set(botId, nanobot);
    }

    console.log(`[ORCHESTRATION] Created ${count} nanobots`);
  }

  /**
   * Create sample tasks
   */
  createSampleTasks(count) {
    const taskTypes = [
      { title: 'Fix bug in authentication module', complexity: 'simple', reward: 5.0 },
      { title: 'Write unit tests for payment service', complexity: 'medium', reward: 15.0 },
      { title: 'Update API documentation', complexity: 'simple', reward: 10.0 },
      { title: 'Implement caching layer', complexity: 'complex', reward: 30.0 },
      { title: 'Security audit of user management', complexity: 'advanced', reward: 50.0 },
      { title: 'Optimize database queries', complexity: 'complex', reward: 35.0 },
      { title: 'Create migration script', complexity: 'simple', reward: 8.0 },
      { title: 'Design REST API for notifications', complexity: 'medium', reward: 20.0 },
      { title: 'Implement rate limiting', complexity: 'medium', reward: 18.0 },
      { title: 'Set up monitoring dashboard', complexity: 'complex', reward: 40.0 },
    ];

    for (let i = 0; i < count; i++) {
      const taskType = taskTypes[i % taskTypes.length];
      const task = this.taskQueue.createTask(
        `${taskType.title} #${i + 1}`,
        `Complete the ${taskType.title} task following best practices and security guidelines.`,
        taskType.complexity,
        taskType.reward
      );
      console.log(`[ORCHESTRATION] Created task: ${task.id} - ${task.title}`);
    }

    console.log(`[ORCHESTRATION] Created ${count} tasks`);
  }

  /**
   * Run orchestration loop
   */
  async run(durationMs = 60000) {
    this.isRunning = true;
    const startTime = Date.now();
    const results = [];

    console.log(`[ORCHESTRATION] Starting orchestration (duration: ${durationMs}ms)`);
    console.log(`[ORCHESTRATION] Nanobots: ${this.nanobots.size}, Tasks: ${this.taskQueue.getStats().total}`);

    while (this.isRunning && Date.now() - startTime < durationMs) {
      // Let each nanobot poll for tasks and execute
      for (const [botId, nanobot] of this.nanobots.entries()) {
        if (!nanobot.currentTask && nanobot.status === 'idle') {
          const task = await nanobot.pollForTasks(this.taskQueue);
          if (task) {
            // Execute the task
            const result = await nanobot.executeTask();
            if (result) {
              this.taskQueue.completeTask(result.task.id, result.result);
              results.push(result);
            }
          }
        } else if (nanobot.currentTask && nanobot.status === 'working') {
          // Continue executing current task
          const result = await nanobot.executeTask();
          if (result) {
            this.taskQueue.completeTask(result.task.id, result.result);
            results.push(result);
          }
        }
      }

      // Small delay between polling cycles
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.isRunning = false;
    console.log(`[ORCHESTRATION] Orchestration completed`);

    return results;
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      nanobots: Array.from(this.nanobots.values()).map(bot => bot.getStatus()),
      tasks: this.taskQueue.getStats(),
      isRunning: this.isRunning,
    };
  }

  /**
   * Get results summary
   */
  getResultsSummary() {
    const bots = Array.from(this.nanobots.values());
    return {
      totalNanobots: bots.length,
      totalTasksCompleted: bots.reduce((sum, bot) => sum + bot.tasksCompleted, 0),
      totalEarnings: bots.reduce((sum, bot) => sum + bot.totalEarnings, 0),
      topPerformer: bots.reduce((top, bot) =>
        bot.tasksCompleted > top.tasksCompleted ? bot : top, bots[0]),
      taskStats: this.taskQueue.getStats(),
    };
  }
}

// ============================================================================
// Demo Execution
// ============================================================================

async function runDemo() {
  console.log('\n========================================');
  console.log('  NERVIX NANOBOT ORCHESTRATION DEMO');
  console.log('========================================\n');

  const orchestrator = new OrchestrationManager();

  // Create nanobots
  orchestrator.createNanobots(10);

  // Create tasks
  orchestrator.createSampleTasks(20);

  console.log('\n--- Starting Orchestration ---\n');

  // Run orchestration for 60 seconds
  await orchestrator.run(60000);

  console.log('\n--- Orchestration Complete ---\n');

  // Show results
  const summary = orchestrator.getResultsSummary();
  console.log('\n========================================');
  console.log('  RESULTS SUMMARY');
  console.log('========================================');
  console.log(`Total Nanobots: ${summary.totalNanobots}`);
  console.log(`Tasks Completed: ${summary.totalTasksCompleted}`);
  console.log(`Total Earnings: $${summary.totalEarnings.toFixed(2)}`);
  console.log(`Top Performer: ${summary.topPerformer.name} (${summary.topPerformer.tasksCompleted} tasks, $${summary.topPerformer.totalEarnings.toFixed(2)})`);
  console.log('\nTask Statistics:');
  console.log(`  Total: ${summary.taskStats.total}`);
  console.log(`  Available: ${summary.taskStats.available}`);
  console.log(`  Completed: ${summary.taskStats.completed}`);
  console.log('========================================\n');

  // Show individual nanobot performance
  console.log('\n--- Individual Performance ---\n');
  const bots = Array.from(orchestrator.nanobots.values()).sort((a, b) => b.tasksCompleted - a.tasksCompleted);
  bots.forEach((bot, index) => {
    console.log(`${index + 1}. ${bot.name} (${bot.id})`);
    console.log(`   Tasks: ${bot.tasksCompleted}, Earned: $${bot.totalEarnings.toFixed(2)}, Skills: ${bot.skills.join(', ')}`);
  });

  console.log('\n========================================');
  console.log('  DEMO COMPLETE');
  console.log('========================================\n');

  return summary;
}

// Run the demo
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = {
  TaskQueue,
  NanobotSimulator,
  OrchestrationManager,
  runDemo,
};
