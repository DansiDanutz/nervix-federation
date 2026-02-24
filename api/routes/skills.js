/**
 * Skills Routes
 * API endpoints for agent skills and capabilities
 *
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const { skillsDatabaseManager } = require('../services/skillsDatabase');

/**
 * @route   GET /api/v1/skills
 * @desc    Get all available skills
 * @access  Public
 */
router.get('/skills', async (req, res) => {
  try {
    const { category } = req.query;

    let skills;

    if (category) {
      skills = skillsDatabaseManager.getSkillsByCategory(category);
    } else {
      skills = skillsDatabaseManager.getAllSkills();
    }

    res.status(200).json({
      skills: skills.map(s => s.toJSON()),
      count: skills.length,
    });
  } catch (error) {
    console.error('Skills list error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve skills',
    });
  }
});

/**
 * @route   GET /api/v1/skills/search
 * @desc    Search for skills
 * @access  Public
 */
router.get('/skills/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing query parameter: q',
      });
    }

    const skills = skillsDatabaseManager.searchSkills(q);

    res.status(200).json({
      query: q,
      skills: skills.map(s => s.toJSON()),
      count: skills.length,
    });
  } catch (error) {
    console.error('Skills search error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to search skills',
    });
  }
});

/**
 * @route   GET /api/v1/skills/categories
 * @desc    Get skill categories
 * @access  Public
 */
router.get('/skills/categories', async (req, res) => {
  try {
    const { SkillCategory } = require('../services/skillsDatabase');
    const categories = Object.values(SkillCategory);

    res.status(200).json({
      categories,
      count: categories.length,
    });
  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve categories',
    });
  }
});

/**
 * @route   GET /api/v1/skills/proficiency-levels
 * @desc    Get proficiency levels
 * @access  Public
 */
router.get('/skills/proficiency-levels', async (req, res) => {
  try {
    const { ProficiencyLevel, ProficiencyScore } = require('../services/skillsDatabase');

    const levels = Object.entries(ProficiencyLevel).map(([key, value]) => ({
      level: value,
      score: ProficiencyScore[value],
    }));

    res.status(200).json({
      levels,
      count: levels.length,
    });
  } catch (error) {
    console.error('Proficiency levels error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve proficiency levels',
    });
  }
});

/**
 * @route   GET /api/v1/agents/:agentId/skills
 * @desc    Get agent skills
 * @access  Public (or require auth in production)
 */
router.get('/agents/:agentId/skills', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { category } = req.query;

    let skills;

    if (category) {
      skills = skillsDatabaseManager.getAgentProfile(agentId).getSkillsByCategory(category);
    } else {
      skills = skillsDatabaseManager.getAgentSkills(agentId);
    }

    res.status(200).json({
      agent_id: agentId,
      skills,
      count: skills.length,
    });
  } catch (error) {
    console.error('Agent skills error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve agent skills',
    });
  }
});

/**
 * @route   PUT /api/v1/agents/:agentId/skills
 * @desc    Update agent skill
 * @access  Private (requires agent auth)
 */
router.put('/agents/:agentId/skills', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { skill_id, proficiency } = req.body;

    if (!skill_id || !proficiency) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: skill_id, proficiency',
      });
    }

    // Verify skill exists
    const skill = skillsDatabaseManager.getSkill(skill_id);
    if (!skill) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Skill not found',
      });
    }

    // Verify proficiency level
    const { ProficiencyLevel } = require('../services/skillsDatabase');
    const validLevels = Object.values(ProficiencyLevel);

    if (!validLevels.includes(proficiency)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid proficiency level. Must be one of: ${validLevels.join(', ')}`,
      });
    }

    // Update agent skill
    skillsDatabaseManager.updateAgentSkill(agentId, skill_id, proficiency);

    res.status(200).json({
      message: 'Skill updated',
      agent_id: agentId,
      skill_id,
      proficiency,
    });
  } catch (error) {
    console.error('Update agent skill error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update agent skill',
    });
  }
});

/**
 * @route   DELETE /api/v1/agents/:agentId/skills/:skillId
 * @desc    Remove agent skill
 * @access  Private (requires agent auth)
 */
router.delete('/agents/:agentId/skills/:skillId', async (req, res) => {
  try {
    const { agentId, skillId } = req.params;

    const profile = skillsDatabaseManager.getAgentProfile(agentId);
    const removed = profile.removeSkill(skillId);

    if (!removed) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Agent skill not found',
      });
    }

    res.status(200).json({
      message: 'Skill removed',
      agent_id: agentId,
      skill_id: skillId,
    });
  } catch (error) {
    console.error('Remove agent skill error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to remove agent skill',
    });
  }
});

/**
 * @route   GET /api/v1/skills/match
 * @desc    Find agents matching required skills
 * @access  Public
 */
router.get('/skills/match', async (req, res) => {
  try {
    const { skills } = req.query;

    if (!skills) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing query parameter: skills',
      });
    }

    // Parse required skills (format: skill1:proficiency1,skill2:proficiency2)
    const requiredSkills = skills.split(',').map(s => {
      const [skillId, proficiency] = s.split(':');
      return { skillId, proficiency: proficiency || 'intermediate' };
    });

    const { min_score = 50 } = req.query;
    const matches = skillsDatabaseManager.findAgentsWithSkills(
      requiredSkills,
      parseInt(min_score)
    );

    res.status(200).json({
      required_skills: requiredSkills,
      min_score: parseInt(min_score),
      matches,
      count: matches.length,
    });
  } catch (error) {
    console.error('Skills match error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to find matching agents',
    });
  }
});

module.exports = router;
