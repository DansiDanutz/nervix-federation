/**
 * Services Unit Tests
 * Test suite for Nervix services
 *
 * @version 1.0.0
 */

const { MetricsService, metricsService } = require('../services/metricsService');
const { AuthService, authService } = require('../services/authService');
const { SkillsDatabaseManager, skillsDatabaseManager } = require('../services/skillsDatabase');
const { TeamOrchestrationManager, teamOrchestrationManager } = require('../services/teamOrchestration');

describe('MetricsService', () => {
  beforeEach(() => {
    // Reset metrics before each test
    metricsService.collector.resetAll();
  });

  test('should record metric', () => {
    metricsService.record('test.metric', 42);
    const metric = metricsService.collector.get('test.metric');
    expect(metric).not.toBeNull();
    expect(metric.count).toBe(1);
    expect(metric.sum).toBe(42);
  });

  test('should calculate average', () => {
    metricsService.record('test.average', 10);
    metricsService.record('test.average', 20);
    metricsService.record('test.average', 30);

    const metric = metricsService.collector.get('test.average');
    expect(metric.avg).toBe(20);
  });

  test('should track min and max', () => {
    metricsService.record('test.range', 5);
    metricsService.record('test.range', 15);
    metricsService.record('test.range', 25);

    const metric = metricsService.collector.get('test.range');
    expect(metric.min).toBe(5);
    expect(metric.max).toBe(25);
  });

  test('should get all metrics', () => {
    metricsService.record('metric1', 1);
    metricsService.record('metric2', 2);

    const all = metricsService.collector.getAll();
    expect(all.length).toBe(2);
  });
});

describe('AuthService', () => {
  test('should generate enrollment token', () => {
    const tokenData = authService.generateEnrollmentToken('test-agent-id');
    expect(tokenData).toHaveProperty('token');
    expect(tokenData).toHaveProperty('type');
    expect(tokenData.type).toBe('enrollment');
    expect(tokenData).toHaveProperty('expires_at');
  });

  test('should generate agent token', () => {
    const tokenData = authService.generateAgentToken('test-agent-id', 90);
    expect(tokenData).toHaveProperty('token');
    expect(tokenData.type).toBe('agent');
  });

  test('should verify valid token', () => {
    const tokenData = authService.generateAgentToken('test-agent-id');
    const verification = authService.verifyAgentToken(tokenData.token);
    expect(verification.valid).toBe(true);
    expect(verification.agent_id).toBe('test-agent-id');
  });

  test('should reject invalid token', () => {
    const verification = authService.verifyAgentToken('invalid-token');
    expect(verification.valid).toBe(false);
  });

  test('should revoke token', () => {
    const tokenData = authService.generateAgentToken('test-agent-id');
    const revoked = authService.revokeAgentToken(tokenData.token);
    expect(revoked).toBe(true);

    const verification = authService.verifyAgentToken(tokenData.token);
    expect(verification.status).toBe('revoked');
  });
});

describe('SkillsDatabaseManager', () => {
  test('should have predefined skills', () => {
    const allSkills = skillsDatabaseManager.getAllSkills();
    expect(allSkills.length).toBeGreaterThan(0);
  });

  test('should get skills by category', () => {
    const codingSkills = skillsDatabaseManager.getSkillsByCategory('coding');
    expect(codingSkills.length).toBeGreaterThan(0);
    codingSkills.forEach(skill => {
      expect(skill.category).toBe('coding');
    });
  });

  test('should search skills', () => {
    const results = skillsDatabaseManager.searchSkills('javascript');
    expect(results.length).toBeGreaterThan(0);
  });

  test('should create agent profile', () => {
    const profile = skillsDatabaseManager.getAgentProfile('test-agent-1');
    expect(profile).not.toBeNull();
    expect(profile.agentId).toBe('test-agent-1');
  });

  test('should update agent skill', () => {
    skillsDatabaseManager.updateAgentSkill('test-agent-2', 'skill_javascript', 'advanced');
    const skills = skillsDatabaseManager.getAgentSkills('test-agent-2');

    const jsSkill = skills.find(s => s.skillId === 'skill_javascript');
    expect(jsSkill).toBeDefined();
    expect(jsSkill.proficiency).toBe('advanced');
  });

  test('should calculate match score', () => {
    skillsDatabaseManager.updateAgentSkill('test-agent-3', 'skill_javascript', 'expert');
    const profile = skillsDatabaseManager.getAgentProfile('test-agent-3');

    const requiredSkills = [
      { skillId: 'skill_javascript', proficiency: 'advanced' },
    ];

    const score = profile.calculateMatchScore(requiredSkills);
    expect(score).toBeGreaterThan(50);
  });
});

describe('TeamOrchestrationManager', () => {
  test('should register agent', () => {
    const agent = teamOrchestrationManager.registerAgent('test-agent-1', {
      name: 'Test Agent',
      role: 'developer',
      capabilities: ['coding'],
    });

    expect(agent).toBeDefined();
    expect(agent.id).toBe('test-agent-1');
    expect(agent.name).toBe('Test Agent');
  });

  test('should get agent', () => {
    teamOrchestrationManager.registerAgent('test-agent-2', { name: 'Agent 2' });
    const agent = teamOrchestrationManager.getAgent('test-agent-2');
    expect(agent).not.toBeNull();
    expect(agent.id).toBe('test-agent-2');
  });

  test('should get all agents', () => {
    teamOrchestrationManager.registerAgent('test-agent-3', { name: 'Agent 3' });
    const agents = teamOrchestrationManager.getAgents();
    expect(agents.length).toBeGreaterThan(0);
  });

  test('should get available agents', () => {
    teamOrchestrationManager.registerAgent('test-agent-4', {
      name: 'Agent 4',
      status: 'idle',
    });

    const available = teamOrchestrationManager.getAgents({ available: true });
    expect(available.length).toBeGreaterThan(0);
    available.forEach(agent => {
      expect(agent.status).toBe('idle');
    });
  });

  test('should assign task', () => {
    teamOrchestrationManager.registerAgent('test-agent-5', {
      name: 'Agent 5',
      status: 'idle',
    });

    teamOrchestrationManager.tasks.set('task-1', {
      id: 'task-1',
      type: 'code-generation',
      requiredCapabilities: ['coding'],
    });

    const assigned = teamOrchestrationManager.assignTask('task-1', 'test-agent-5');
    expect(assigned).toBe(true);

    const agent = teamOrchestrationManager.getAgent('test-agent-5');
    expect(agent.currentTask).toBe('task-1');
    expect(agent.status).toBe('busy');
  });

  test('should complete task', () => {
    teamOrchestrationManager.registerAgent('test-agent-6', {
      name: 'Agent 6',
      status: 'idle',
    });

    teamOrchestrationManager.tasks.set('task-2', {
      id: 'task-2',
      type: 'code-generation',
    });

    teamOrchestrationManager.assignTask('task-2', 'test-agent-6');
    const completed = teamOrchestrationManager.completeTask('task-2', 50);

    expect(completed).toBe(true);

    const agent = teamOrchestrationManager.getAgent('test-agent-6');
    expect(agent.currentTask).toBeNull();
    expect(agent.status).toBe('idle');
    expect(agent.tasksCompleted).toBe(1);
    expect(agent.totalEarnings).toBe(50);
  });

  test('should fail task', () => {
    teamOrchestrationManager.registerAgent('test-agent-7', {
      name: 'Agent 7',
      status: 'idle',
    });

    teamOrchestrationManager.tasks.set('task-3', {
      id: 'task-3',
      type: 'code-generation',
    });

    teamOrchestrationManager.assignTask('task-3', 'test-agent-7');
    const failed = teamOrchestrationManager.failTask('task-3');

    expect(failed).toBe(true);

    const agent = teamOrchestrationManager.getAgent('test-agent-7');
    expect(agent.tasksFailed).toBe(1);
  });

  test('should calculate success rate', () => {
    teamOrchestrationManager.registerAgent('test-agent-8', {
      name: 'Agent 8',
    });

    const agent = teamOrchestrationManager.getAgent('test-agent-8');
    agent.tasksCompleted = 8;
    agent.tasksFailed = 2;

    expect(agent.getSuccessRate()).toBe(0.8);
  });

  test('should get stats', () => {
    const stats = teamOrchestrationManager.getStats();
    expect(stats).toHaveProperty('agents');
    expect(stats).toHaveProperty('totalTasks');
    expect(stats).toHaveProperty('tasksAssigned');
  });
});
