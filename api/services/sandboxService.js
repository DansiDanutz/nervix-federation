/**
 * Testing Sandbox Service
 * Isolated sandbox for running and testing code submissions
 *
 * @version 1.0.0
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Sandbox Status
const SandboxStatus = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
};

/**
 * Sandbox Environment
 */
class SandboxEnvironment {
  constructor(config = {}) {
    this.baseDir = config.baseDir || '/tmp/nervix-sandboxes';
    this.timeout = config.timeout || 60000; // 60 seconds default
    this.memoryLimit = config.memoryLimit || '512m';
    this.cpuLimit = config.cpuLimit || '0.5';
  }

  /**
   * Create isolated sandbox directory
   * @param {string} taskId - Task ID
   * @returns {string} Sandbox directory path
   */
  createSandbox(taskId) {
    const sandboxId = `sandbox_${taskId}_${Date.now()}`;
    const sandboxDir = path.join(this.baseDir, sandboxId);

    fs.mkdirSync(sandboxDir, { recursive: true });
    fs.mkdirSync(path.join(sandboxDir, 'input'));
    fs.mkdirSync(path.join(sandboxDir, 'output'));
    fs.mkdirSync(path.join(sandboxDir, 'work'));

    return sandboxDir;
  }

  /**
   * Setup sandbox with code and dependencies
   * @param {string} sandboxDir - Sandbox directory
   * @param {Object} code - Code to test
   * @returns {Promise<void>}
   */
  async setupSandbox(sandboxDir, code) {
    const { files, packageJson, dependencies } = code;

    // Write source files
    for (const file of files || []) {
      const filePath = path.join(sandboxDir, 'work', file.name);
      fs.writeFileSync(filePath, file.content, 'utf-8');
    }

    // Write package.json if provided
    if (packageJson) {
      const pkgPath = path.join(sandboxDir, 'work', 'package.json');
      fs.writeFileSync(pkgPath, JSON.stringify(packageJson, null, 2), 'utf-8');
    }

    // Install dependencies
    if (dependencies && dependencies.length > 0) {
      try {
        execSync(`npm install ${dependencies.join(' ')}`, {
          cwd: path.join(sandboxDir, 'work'),
          stdio: 'pipe',
          timeout: 60000,
        });
      } catch (error) {
        throw new Error(`Dependency installation failed: ${error.message}`);
      }
    }
  }

  /**
   * Run code in sandbox
   * @param {string} sandboxDir - Sandbox directory
   * @param {string} command - Command to run
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async runCode(sandboxDir, command, options = {}) {
    const { input = [], env = {} } = options;
    const workDir = path.join(sandboxDir, 'work');
    const outputPath = path.join(sandboxDir, 'output', 'result.json');

    // Write input data
    if (input.length > 0) {
      const inputPath = path.join(sandboxDir, 'input', 'input.json');
      fs.writeFileSync(inputPath, JSON.stringify(input), 'utf-8');
    }

    // Execute command with resource limits
    const startTime = Date.now();

    try {
      const output = execSync(command, {
        cwd: workDir,
        env: {
          ...process.env,
          ...env,
          NODE_OPTIONS: `--max-old-space-size=512`,
        },
        stdio: 'pipe',
        timeout: this.timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      const duration = Date.now() - startTime;

      // Read output if exists
      let result = null;
      if (fs.existsSync(outputPath)) {
        result = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      }

      return {
        status: SandboxStatus.COMPLETED,
        stdout: output.toString('utf-8'),
        stderr: '',
        result,
        duration,
        exitCode: 0,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error.killed && error.signal === 'SIGTERM') {
        return {
          status: SandboxStatus.TIMEOUT,
          stdout: error.stdout?.toString('utf-8') || '',
          stderr: error.stderr?.toString('utf-8') || '',
          result: null,
          duration,
          exitCode: null,
          error: 'Execution timeout',
        };
      }

      return {
        status: SandboxStatus.FAILED,
        stdout: error.stdout?.toString('utf-8') || '',
        stderr: error.stderr?.toString('utf-8') || '',
        result: null,
        duration,
        exitCode: error.status,
        error: error.message,
      };
    }
  }

  /**
   * Cleanup sandbox directory
   * @param {string} sandboxDir - Sandbox directory
   * @returns {Promise<void>}
   */
  async cleanupSandbox(sandboxDir) {
    try {
      if (fs.existsSync(sandboxDir)) {
        fs.rmSync(sandboxDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Sandbox cleanup error:', error);
    }
  }
}

/**
 * Sandbox Manager
 */
class SandboxManager {
  constructor() {
    this.sandboxes = new Map();
    this.environment = new SandboxEnvironment();
  }

  /**
   * Create and setup a new sandbox
   * @param {string} taskId - Task ID
   * @param {Object} code - Code to test
   * @returns {Promise<string>} Sandbox ID
   */
  async create(taskId, code) {
    const sandboxId = crypto.randomBytes(8).toString('hex');
    const sandboxDir = this.environment.createSandbox(taskId);

    this.sandboxes.set(sandboxId, {
      taskId,
      sandboxDir,
      status: SandboxStatus.PREPARING,
      createdAt: Date.now(),
    });

    try {
      await this.environment.setupSandbox(sandboxDir, code);

      this.sandboxes.set(sandboxId, {
        ...this.sandboxes.get(sandboxId),
        status: SandboxStatus.IDLE,
      });

      return sandboxId;
    } catch (error) {
      await this.cleanup(sandboxId);
      throw error;
    }
  }

  /**
   * Run code in sandbox
   * @param {string} sandboxId - Sandbox ID
   * @param {string} command - Command to run
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async run(sandboxId, command, options = {}) {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error('Sandbox not found');
    }

    this.sandboxes.set(sandboxId, {
      ...sandbox,
      status: SandboxStatus.RUNNING,
    });

    const result = await this.environment.runCode(sandbox.sandboxDir, command, options);

    this.sandboxes.set(sandboxId, {
      ...sandbox,
      status: result.status,
      lastRun: Date.now(),
    });

    return result;
  }

  /**
   * Get sandbox status
   * @param {string} sandboxId - Sandbox ID
   * @returns {Object|null>} Sandbox info or null
   */
  getStatus(sandboxId) {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return null;

    return {
      id: sandboxId,
      taskId: sandbox.taskId,
      status: sandbox.status,
      createdAt: sandbox.createdAt,
      lastRun: sandbox.lastRun,
      age: Date.now() - sandbox.createdAt,
    };
  }

  /**
   * Cleanup sandbox
   * @param {string} sandboxId - Sandbox ID
   * @returns {Promise<void>}
   */
  async cleanup(sandboxId) {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return;

    await this.environment.cleanupSandbox(sandbox.sandboxDir);
    this.sandboxes.delete(sandboxId);
  }

  /**
   * Cleanup all sandboxes older than maxAge
   * @param {number} maxAge - Maximum age in ms (default 1 hour)
   * @returns {Promise<number>} Number of sandboxes cleaned
   */
  async cleanupOld(maxAge = 3600000) {
    const cutoff = Date.now() - maxAge;
    let cleaned = 0;

    for (const [sandboxId, sandbox] of this.sandboxes) {
      if (sandbox.createdAt < cutoff && sandbox.status !== SandboxStatus.RUNNING) {
        await this.cleanup(sandboxId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get all sandboxes
   * @returns {Array>} List of sandbox info
   */
  getAll() {
    return Array.from(this.sandboxes.keys()).map(id => this.getStatus(id));
  }

  /**
   * Get sandbox count
   * @returns {number}
   */
  getCount() {
    return this.sandboxes.size;
  }
}

// Singleton instance
const sandboxManager = new SandboxManager();

// Cleanup old sandboxes every 10 minutes
setInterval(() => {
  sandboxManager.cleanupOld();
}, 600000);

module.exports = {
  SandboxStatus,
  SandboxEnvironment,
  SandboxManager,
  sandboxManager,
};
