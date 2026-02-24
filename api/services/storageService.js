/**
 * Unified Storage Layer with Supabase + In-Memory Fallback
 * Uses Supabase when configured, falls back to in-memory storage
 *
 * @version 1.0.0
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('./logger');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes('mock.supabase.co') &&
                            supabaseServiceKey && !supabaseServiceKey.includes('mock');

let supabase = null;

if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    logger.info('Supabase initialized', { url: supabaseUrl });
  } catch (error) {
    logger.warn('Failed to initialize Supabase, using fallback', { error: error.message });
  }
} else {
  logger.warn('Supabase not configured, using in-memory fallback');
}

// In-memory fallback storage
const fallbackTasks = new Map();
const fallbackSubmissions = new Map();
const fallbackAgents = new Map();

/**
 * Check if Supabase is available
 */
function isSupabaseAvailable() {
  return supabase !== null;
}

/**
 * Task Operations
 */
const TaskOperations = {
  /**
   * Create a new task
   */
  async createTask(taskData) {
    try {
      if (isSupabaseAvailable()) {
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
        logger.info('Task created (Supabase)', { task_id: data.id });
        return data;
      } else {
        // Fallback to in-memory
        const task = {
          id: crypto.randomUUID(),
          type: taskData.type || 'code-generation',
          priority: taskData.priority || 'medium',
          base_reward: taskData.base_reward || 50,
          parameters: taskData.parameters || {},
          requirements: taskData.requirements || {},
          status: 'available',
          created_by: taskData.created_by || 'system',
          expires_at: taskData.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        fallbackTasks.set(task.id, task);
        logger.info('Task created (fallback)', { task_id: task.id });
        return task;
      }
    } catch (error) {
      logger.error('Failed to create task', { error: error.message });
      throw error;
    }
  },

  /**
   * Get task by ID
   */
  async getTask(taskId) {
    try {
      if (isSupabaseAvailable()) {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
      } else {
        // Fallback to in-memory
        return fallbackTasks.get(taskId) || null;
      }
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

      if (isSupabaseAvailable()) {
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
      } else {
        // Fallback to in-memory
        let tasks = Array.from(fallbackTasks.values());

        // Apply filters
        if (status) {
          tasks = tasks.filter(task => task.status === status);
        }
        if (min_reward) {
          tasks = tasks.filter(task => task.base_reward >= parseFloat(min_reward));
        }
        if (type) {
          tasks = tasks.filter(task => task.type === type);
        }

        // Sort by reward
        tasks.sort((a, b) => b.base_reward - a.base_reward);

        // Apply pagination
        const total = tasks.length;
        const paginatedTasks = tasks.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

        return {
          tasks: paginatedTasks,
          total,
          limit: parseInt(limit),
          offset: parseInt(offset)
        };
      }
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
      if (isSupabaseAvailable()) {
        const { data, error } = await supabase
          .from('available_tasks_view')
          .select('*')
          .order('base_reward', { ascending: false })
          .limit(limit);

        if (error) throw error;
        return data || [];
      } else {
        // Fallback to in-memory
        const tasks = Array.from(fallbackTasks.values())
          .filter(task => task.status === 'available')
          .sort((a, b) => b.base_reward - a.base_reward)
          .slice(0, limit);

        return tasks.map(task => ({
          ...task,
          title: task.parameters?.title || 'Untitled',
          description: task.parameters?.description || 'No description',
          complexity: task.parameters?.complexity || 'medium',
          high_priority: task.base_reward > 50,
        }));
      }
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

      if (isSupabaseAvailable()) {
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

        logger.info('Task claimed (Supabase)', { task_id: taskId, agent_id: agentId });

        return {
          task_id: data.id,
          assignment_token: assignmentToken,
          status: data.status,
          assigned_at: data.assigned_at
        };
      } else {
        // Fallback to in-memory
        const task = fallbackTasks.get(taskId);

        if (!task || task.status !== 'available') {
          throw new Error('Task not found or not available');
        }

        task.status = 'in_progress';
        task.agent_id = agentId;
        task.assigned_at = new Date().toISOString();
        task.assignment_token = assignmentToken;
        task.updated_at = new Date().toISOString();

        logger.info('Task claimed (fallback)', { task_id: taskId, agent_id: agentId });

        return {
          task_id: task.id,
          assignment_token: assignmentToken,
          status: task.status,
          assigned_at: task.assigned_at
        };
      }
    } catch (error) {
      logger.error('Failed to claim task', { error: error.message, task_id: taskId });
      throw error;
    }
  },

  /**
   * Complete a task
   */
  async completeTask(taskId, submissionId) {
    try {
      if (isSupabaseAvailable()) {
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
      } else {
        const task = fallbackTasks.get(taskId);
        if (!task) throw new Error('Task not found');

        task.status = 'completed';
        task.completed_at = new Date().toISOString();
        task.submission_id = submissionId;
        task.updated_at = new Date().toISOString();

        return task;
      }
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
      if (isSupabaseAvailable()) {
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
      } else {
        const task = fallbackTasks.get(taskId);
        if (!task) throw new Error('Task not found');

        task.status = 'failed_qa';
        task.failed_at = new Date().toISOString();
        task.updated_at = new Date().toISOString();

        return task;
      }
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
      if (isSupabaseAvailable()) {
        const { data, error } = await supabase
          .from('task_submissions')
          .select('*')
          .eq('task_id', taskId);

        if (error) throw error;
        return data || [];
      } else {
        return Array.from(fallbackSubmissions.values())
          .filter(sub => sub.task_id === taskId);
      }
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
      if (isSupabaseAvailable()) {
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
        logger.info('Submission created (Supabase)', { submission_id: data.id });
        return data;
      } else {
        const submission = {
          id: crypto.randomUUID(),
          task_id: submissionData.task_id,
          agent_id: submissionData.agent_id,
          assignment_token: submissionData.assignment_token,
          result: submissionData.result || {},
          execution_time: submissionData.execution_time,
          qa_result: submissionData.qa_result,
          qa_passed: submissionData.qa_passed,
          qa_score: submissionData.qa_score,
          status: submissionData.status || 'pending',
          submitted_at: new Date().toISOString(),
        };
        fallbackSubmissions.set(submission.id, submission);
        logger.info('Submission created (fallback)', { submission_id: submission.id });
        return submission;
      }
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
      if (isSupabaseAvailable()) {
        const { data, error } = await supabase
          .from('task_submissions')
          .select('*')
          .eq('id', submissionId)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
      } else {
        return fallbackSubmissions.get(submissionId) || null;
      }
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
      if (isSupabaseAvailable()) {
        const { data, error } = await supabase
          .from('agent_submission_stats')
          .select('*')
          .eq('agent_id', agentId)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
      } else {
        const submissions = Array.from(fallbackSubmissions.values())
          .filter(sub => sub.agent_id === agentId);

        const total_submissions = submissions.length;
        const passed_submissions = submissions.filter(sub => sub.qa_passed).length;
        const total_earnings = submissions
          .filter(sub => sub.qa_passed)
          .reduce((sum, sub) => sum + (sub.reward_amount || 0), 0);
        const qa_scores = submissions.filter(sub => sub.qa_score).map(sub => sub.qa_score);
        const avg_qa_score = qa_scores.length > 0
          ? qa_scores.reduce((a, b) => a + b, 0) / qa_scores.length
          : 0;

        return {
          agent_id: agentId,
          total_submissions,
          passed_submissions,
          total_earnings,
          avg_qa_score,
          avg_execution_time: submissions.reduce((a, b) => a + (b.execution_time || 0), 0) / total_submissions || 0,
          last_submission_at: submissions.length > 0 ? submissions[0].submitted_at : null,
        };
      }
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
      if (isSupabaseAvailable()) {
        const { data, error } = await supabase
          .from('agents')
          .select('*')
          .eq('agent_id', agentId)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
      } else {
        return fallbackAgents.get(agentId) || null;
      }
    } catch (error) {
      logger.error('Failed to get agent', { error: error.message, agent_id: agentId });
      throw error;
    }
  },

  /**
   * Create agent
   */
  async createAgent(agentData) {
    try {
      if (isSupabaseAvailable()) {
        const { data, error } = await supabase
          .from('agents')
          .insert(agentData)
          .select()
          .single();

        if (error) throw error;
        logger.info('Agent created (Supabase)', { agent_id: data.agent_id });
        return data;
      } else {
        const agent = {
          ...agentData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        fallbackAgents.set(agentData.agent_id, agent);
        logger.info('Agent created (fallback)', { agent_id: agent.agent_id });
        return agent;
      }
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
      if (isSupabaseAvailable()) {
        const { data, error } = await supabase
          .from('agents')
          .update(updates)
          .eq('agent_id', agentId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const agent = fallbackAgents.get(agentId);
        if (!agent) throw new Error('Agent not found');

        Object.assign(agent, updates, { updated_at: new Date().toISOString() });
        return agent;
      }
    } catch (error) {
      logger.error('Failed to update agent', { error: error.message, agent_id: agentId });
      throw error;
    }
  },
};

module.exports = {
  isSupabaseAvailable,
  TaskOperations,
  SubmissionOperations,
  AgentOperations,
};
