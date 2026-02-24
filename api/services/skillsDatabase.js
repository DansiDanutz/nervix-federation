/**
 * Agent Skills Database
 * Tracks and manages agent skills, capabilities, and proficiencies
 *
 * @version 1.0.0
 */

// Skill Categories
const SkillCategory = {
  CODING: 'coding',
  TESTING: 'testing',
  RESEARCH: 'research',
  WRITING: 'writing',
  DESIGN: 'design',
  ANALYSIS: 'analysis',
  INFRASTRUCTURE: 'infrastructure',
  SECURITY: 'security',
  DEVOPS: 'devops',
  DOCUMENTATION: 'documentation',
};

// Skill Proficiency Levels
const ProficiencyLevel = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  EXPERT: 'expert',
  MASTER: 'master',
};

// Proficiency Scores
const ProficiencyScore = {
  BEGINNER: 25,
  INTERMEDIATE: 50,
  ADVANCED: 75,
  EXPERT: 90,
  MASTER: 100,
};

/**
 * Skill Definition
 */
class Skill {
  constructor(name, category, description) {
    this.id = `skill_${name.toLowerCase().replace(/\s+/g, '_')}`;
    this.name = name;
    this.category = category;
    this.description = description;
  }

  /**
   * Convert to object
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      description: this.description,
    };
  }
}

/**
 * Predefined Skills
 */
const PREDEFINED_SKILLS = [
  // Coding
  new Skill('JavaScript', SkillCategory.CODING, 'JavaScript programming language'),
  new Skill('TypeScript', SkillCategory.CODING, 'TypeScript programming language'),
  new Skill('Python', SkillCategory.CODING, 'Python programming language'),
  new Skill('Node.js', SkillCategory.CODING, 'Node.js runtime'),
  new Skill('React', SkillCategory.CODING, 'React framework'),
  new Skill('Vue.js', SkillCategory.CODING, 'Vue.js framework'),
  new Skill('Database Design', SkillCategory.CODING, 'Database schema design'),
  new Skill('API Design', SkillCategory.CODING, 'RESTful API design'),

  // Testing
  new Skill('Unit Testing', SkillCategory.TESTING, 'Unit testing practices'),
  new Skill('Integration Testing', SkillCategory.TESTING, 'Integration testing'),
  new Skill('E2E Testing', SkillCategory.TESTING, 'End-to-end testing'),
  new Skill('Jest', SkillCategory.TESTING, 'Jest testing framework'),
  new Skill('Cypress', SkillCategory.TESTING, 'Cypress E2E testing'),

  // Research
  new Skill('Web Research', SkillCategory.RESEARCH, 'Web-based research'),
  new Skill('Data Analysis', SkillCategory.RESEARCH, 'Data analysis'),
  new Skill('Literature Review', SkillCategory.RESEARCH, 'Academic literature review'),

  // Writing
  new Skill('Technical Writing', SkillCategory.WRITING, 'Technical documentation'),
  new Skill('API Documentation', SkillCategory.WRITING, 'API documentation'),
  new Skill('User Documentation', SkillCategory.WRITING, 'User-facing documentation'),

  // Infrastructure
  new Skill('Docker', SkillCategory.INFRASTRUCTURE, 'Docker containerization'),
  new Skill('Kubernetes', SkillCategory.INFRASTRUCTURE, 'Kubernetes orchestration'),
  new Skill('CI/CD', SkillCategory.INFRASTRUCTURE, 'CI/CD pipelines'),
  new Skill('AWS', SkillCategory.INFRASTRUCTURE, 'AWS cloud services'),
  new Skill('Vercel', SkillCategory.INFRASTRUCTURE, 'Vercel deployment'),

  // Security
  new Skill('Security Auditing', SkillCategory.SECURITY, 'Security code review'),
  new Skill('Penetration Testing', SkillCategory.SECURITY, 'Penetration testing'),
  new Skill('Cryptography', SkillCategory.SECURITY, 'Cryptographic implementations'),

  // DevOps
  new Skill('Linux', SkillCategory.DEVOPS, 'Linux administration'),
  new Skill('Git', SkillCategory.DEVOPS, 'Git version control'),
  new Skill('Monitoring', SkillCategory.DEVOPS, 'System monitoring'),
];

/**
 * Agent Skill Profile
 */
class AgentSkillProfile {
  constructor(agentId) {
    this.agentId = agentId;
    this.skills = new Map(); // skillId -> proficiency
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
  }

  /**
   * Add or update skill
   * @param {string} skillId - Skill ID
   * @param {string} proficiency - Proficiency level
   * @returns {void}
   */
  setSkill(skillId, proficiency) {
    this.skills.set(skillId, {
      proficiency,
      score: ProficiencyScore[proficiency] || ProficiencyScore.INTERMEDIATE,
      updatedAt: Date.now(),
    });
    this.updatedAt = Date.now();
  }

  /**
   * Remove skill
   * @param {string} skillId - Skill ID
   * @returns {boolean}
   */
  removeSkill(skillId) {
    const removed = this.skills.delete(skillId);
    if (removed) {
      this.updatedAt = Date.now();
    }
    return removed;
  }

  /**
   * Get skill
   * @param {string} skillId - Skill ID
   * @returns {Object|null>} Skill proficiency or null
   */
  getSkill(skillId) {
    return this.skills.get(skillId) || null;
  }

  /**
   * Get all skills
   * @returns {Array>} List of skills
   */
  getAllSkills() {
    return Array.from(this.skills.entries()).map(([skillId, data]) => ({
      skillId,
      ...data,
    }));
  }

  /**
   * Get skills by category
   * @param {string} category - Skill category
   * @returns {Array>} List of skills in category
   */
  getSkillsByCategory(category) {
    return this.getAllSkills().filter(skill => {
      const predefinedSkill = PREDEFINED_SKILLS.find(s => s.id === skill.skillId);
      return predefinedSkill && predefinedSkill.category === category;
    });
  }

  /**
   * Check if agent has skill
   * @param {string} skillId - Skill ID
   * @param {string} minProficiency - Minimum proficiency level
   * @returns {boolean}
   */
  hasSkill(skillId, minProficiency = ProficiencyLevel.BEGINNER) {
    const skill = this.getSkill(skillId);
    if (!skill) return false;

    const minScore = ProficiencyScore[minProficiency] || 0;
    return skill.score >= minScore;
  }

  /**
   * Calculate match score for required skills
   * @param {Array>} requiredSkills - List of required skills
   * @returns {number} Match score (0-100)
   */
  calculateMatchScore(requiredSkills) {
    if (requiredSkills.length === 0) return 100;

    let totalScore = 0;

    for (const { skillId, proficiency, weight = 1 } of requiredSkills) {
      const skill = this.getSkill(skillId);
      const requiredScore = ProficiencyScore[proficiency] || ProficiencyScore.INTERMEDIATE;
      const actualScore = skill?.score || 0;
      const weightedScore = (actualScore / requiredScore) * weight;

      totalScore += Math.min(weightedScore, weight);
    }

    const maxScore = requiredSkills.reduce((sum, s) => sum + (s.weight || 1), 0);
    return Math.round((totalScore / maxScore) * 100);
  }
}

/**
 * Skills Database Manager
 */
class SkillsDatabaseManager {
  constructor() {
    this.skills = new Map();
    this.agentProfiles = new Map();

    // Initialize predefined skills
    for (const skill of PREDEFINED_SKILLS) {
      this.skills.set(skill.id, skill);
    }
  }

  /**
   * Get skill by ID
   * @param {string} skillId - Skill ID
   * @returns {Skill|null>}
   */
  getSkill(skillId) {
    return this.skills.get(skillId) || null;
  }

  /**
   * Get all skills
   * @returns {Array<Skill>>} List of all skills
   */
  getAllSkills() {
    return Array.from(this.skills.values());
  }

  /**
   * Get skills by category
   * @param {string} category - Skill category
   * @returns {Array<Skill>>} List of skills in category
   */
  getSkillsByCategory(category) {
    return this.getAllSkills().filter(skill => skill.category === category);
  }

  /**
   * Search skills
   * @param {string} query - Search query
   * @returns {Array<Skill>>} Matching skills
   */
  searchSkills(query) {
    const lowerQuery = query.toLowerCase();

    return this.getAllSkills().filter(skill =>
      skill.name.toLowerCase().includes(lowerQuery) ||
      skill.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get or create agent profile
   * @param {string} agentId - Agent ID
   * @returns {AgentSkillProfile}
   */
  getAgentProfile(agentId) {
    if (!this.agentProfiles.has(agentId)) {
      this.agentProfiles.set(agentId, new AgentSkillProfile(agentId));
    }
    return this.agentProfiles.get(agentId);
  }

  /**
   * Update agent skill
   * @param {string} agentId - Agent ID
   * @param {string} skillId - Skill ID
   * @param {string} proficiency - Proficiency level
   * @returns {boolean} Success
   */
  updateAgentSkill(agentId, skillId, proficiency) {
    const profile = this.getAgentProfile(agentId);
    profile.setSkill(skillId, proficiency);
    return true;
  }

  /**
   * Get agent skills
   * @param {string} agentId - Agent ID
   * @returns {Array>} List of agent skills
   */
  getAgentSkills(agentId) {
    const profile = this.agentProfiles.get(agentId);
    if (!profile) return [];
    return profile.getAllSkills();
  }

  /**
   * Find agents with required skills
   * @param {Array>} requiredSkills - Required skills
   * @param {number} minMatchScore - Minimum match score (0-100)
   * @returns {Array>} Matching agents
   */
  findAgentsWithSkills(requiredSkills, minMatchScore = 50) {
    const matches = [];

    for (const [agentId, profile] of this.agentProfiles) {
      const matchScore = profile.calculateMatchScore(requiredSkills);

      if (matchScore >= minMatchScore) {
        matches.push({
          agentId,
          matchScore,
          skills: profile.getAllSkills(),
        });
      }
    }

    // Sort by match score (highest first)
    matches.sort((a, b) => b.matchScore - a.matchScore);

    return matches;
  }

  /**
   * Get statistics
   * @returns {Object}
   */
  getStats() {
    const skillCount = this.skills.size;
    const agentCount = this.agentProfiles.size;

    const categoryCounts = {};
    for (const skill of this.skills.values()) {
      categoryCounts[skill.category] = (categoryCounts[skill.category] || 0) + 1;
    }

    return {
      totalSkills: skillCount,
      totalAgents: agentCount,
      categories: categoryCounts,
    };
  }
}

// Singleton instance
const skillsDatabaseManager = new SkillsDatabaseManager();

module.exports = {
  SkillCategory,
  ProficiencyLevel,
  ProficiencyScore,
  Skill,
  PREDEFINED_SKILLS,
  AgentSkillProfile,
  SkillsDatabaseManager,
  skillsDatabaseManager,
};
