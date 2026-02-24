/**
 * Supabase Database Service
 * Handles all database operations for Nervix platform
 *
 * @version 1.0.0
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('./logger');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  logger.warn('Supabase credentials not configured. Using mock mode.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Task Operations
 */
const TaskOperations = {
  /**
   * Create a new task
   */
  async createTask(taskData) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          type: taskData.type || 'code-generation',
          priority: taskData.priority || 'medium',
          base_reward: taskData.base_reward || 50,
          parameters: taskData.parameters || {},
          requirements: taskData.requirements || {},
          status: 'available',
          created_by: taskData.created_by || 'system',
          expires_at: taskData.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      logger.info('Task created', { task_id: data.id, type: data.type });
      return data;
    } catch (error) {
      logger.error('Failed to create task', {
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        status: error.status
      });
      throw error;
    }
  },

  /**
   * Get task by ID
   */
  async getTask(taskId) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
      return data;
    } catch (error) {
      logger.error('Failed to get task', { error: error.message, task_id: taskId });
      throw error;
    }
  },

  /**
   * List tasks with filters
   */
  async listTasks(filters = {}) {
    try {
      const { limit = 20, offset = 0, complexity, min_reward, type, status } = filters;

      let query = supabase
        .from('tasks')
        .select('*', { count: 'exact' });

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }
      if (complexity) {
        query = query.eq('complexity', complexity);
      }
      if (min_reward) {
        query = query.gte('base_reward', parseFloat(min_reward));
      }
      if (type) {
        query = query.eq('type', type);
      }

      // Sort by reward (descending)
      query = query.order('base_reward', { ascending: false });

      // Apply pagination
      query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        tasks: data || [],
        total: count || 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
    } catch (error) {
      logger.error('Failed to list tasks', { error: error.message });
      throw error;
    }
  },

  /**
   * Get available tasks
   */
  async getAvailableTasks(limit = 10) {
    try {
      const { data, error } = await supabase
        .from('available_tasks_view')
        .select('*')
        .order('base_reward', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Failed to get available tasks', { error: error.message });
      throw error;
    }
  },

  /**
   * Claim a task
   */
  async claimTask(taskId, agentId) {
    try {
      const assignmentToken = crypto.randomUUID();

      // Update task status
      const { data, error } = await supabase
        .from('tasks')
        .update({
          status: 'in_progress',
          agent_id: agentId,
          assigned_at: new Date().toISOString(),
          assignment_token: assignmentToken,
        })
        .eq('id', taskId)
        .eq('status', 'available')
        .select()
        .single();

      if (error) throw error;

      logger.info('Task claimed', { task_id: taskId, agent_id: agentId });

      return {
        task_id: data.id,
        assignment_token: assignmentToken,
        status: data.status,
        assigned_at: data.assigned_at
      };
    } catch (error) {
      logger.error('Failed to claim task', { error: error.message, task_id: taskId });
      throw error;
    }
  },

  /**
   * Complete a task (after QA passes)
   */
  async completeTask(taskId, submissionId) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          submission_id: submissionId,
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error('Failed to complete task', { error: error.message, task_id: taskId });
      throw error;
    }
  },

  /**
   * Mark task as failed QA
   */
  async failTaskQA(taskId) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          status: 'failed_qa',
          failed_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error('Failed to mark task as failed QA', { error: error.message, task_id: taskId });
      throw error;
    }
  },

  /**
   * Get task submissions
   */
  async getTaskSubmissions(taskId) {
    try {
      const { data, error } = await supabase
        .from('task_submissions')
        .select('*')
        .eq('task_id', taskId);

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Failed to get task submissions', { error: error.message, task_id: taskId });
      throw error;
    }
  },
};

/**
 * Submission Operations
 */
const SubmissionOperations = {
  /**
   * Create a submission
   */
  async createSubmission(submissionData) {
    try {
      const { data, error } = await supabase
        .from('task_submissions')
        .insert({
          task_id: submissionData.task_id,
          agent_id: submissionData.agent_id,
          assignment_token: submissionData.assignment_token,
          result: submissionData.result || {},
          execution_time: submissionData.execution_time,
          qa_result: submissionData.qa_result,
          qa_passed: submissionData.qa_passed,
          qa_score: submissionData.qa_score,
          status: submissionData.status || 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      logger.info('Submission created', { submission_id: data.id, task_id: data.task_id });
      return data;
    } catch (error) {
      logger.error('Failed to create submission', { error: error.message });
      throw error;
    }
  },

  /**
   * Get submission by ID
   */
  async getSubmission(submissionId) {
    try {
      const { data, error } = await supabase
        .from('task_submissions')
        .select('*')
        .eq('id', submissionId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      logger.error('Failed to get submission', { error: error.message, submission_id: submissionId });
      throw error;
    }
  },

  /**
   * Get agent statistics
   */
  async getAgentStats(agentId) {
    try {
      const { data, error } = await supabase
        .from('agent_submission_stats')
        .select('*')
        .eq('agent_id', agentId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      logger.error('Failed to get agent stats', { error: error.message, agent_id: agentId });
      throw error;
    }
  },
};

/**
 * Agent Operations
 */
const AgentOperations = {
  /**
   * Get agent by ID
   */
  async getAgent(agentId) {
    try {
      // Real database uses 'id' as primary key, not 'agent_id'
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      logger.error('Failed to get agent', { error: error.message, agent_id: agentId });
      throw error;
    }
  },

  /**
   * List agents with filters
   */
  async listAgents(filters = {}) {
    try {
      const { limit = 20, offset = 0, status, availability_status, skill } = filters;

      let query = supabase
        .from('agents')
        .select('*', { count: 'exact' });

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }
      if (availability_status) {
        query = query.eq('availability_status', availability_status);
      }
      if (skill) {
        query = query.contains('skills', [skill]);
      }

      // Sort by reputation score (descending)
      query = query.order('reputation_score', { ascending: false });

      // Apply pagination
      query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        agents: data || [],
        total: count || 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
    } catch (error) {
      logger.error('Failed to list agents', { error: error.message });
      throw error;
    }
  },

  /**
   * Create agent
   */
  async createAgent(agentData) {
    try {
      const { data, error } = await supabase
        .from('agents')
        .insert(agentData)
        .select()
        .single();

      if (error) throw error;

      logger.info('Agent created', { agent_id: data.id });
      return data;
    } catch (error) {
      logger.error('Failed to create agent', { error: error.message });
      throw error;
    }
  },

  /**
   * Update agent
   */
  async updateAgent(agentId, updates) {
    try {
      // Real database uses 'id' as primary key
      const { data, error } = await supabase
        .from('agents')
        .update(updates)
        .eq('id', agentId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error('Failed to update agent', { error: error.message, agent_id: agentId });
      throw error;
    }
  },

  /**
   * Get online agents
   */
  async getOnlineAgents() {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('status', 'online');

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Failed to get online agents', { error: error.message });
      throw error;
    }
  },
};

module.exports = {
  supabase,
  TaskOperations,
  SubmissionOperations,
  AgentOperations,
};
