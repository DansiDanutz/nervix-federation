-- Migration: Fix kanban_tasks schema
-- Purpose: Add missing 'assigned_to' column to kanban_tasks
-- Date: 2026-02-28

-- Check if column exists and add if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'kanban_tasks'
      AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE kanban_tasks ADD COLUMN assigned_to TEXT NOT NULL DEFAULT '';
  END IF;
END
$$;

-- Also add 'pending' to status check if not already there
DO $$
BEGIN
  -- Check if constraint exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.check_constraints
    WHERE constraint_name = 'kanban_tasks_status_check'
  ) THEN
    -- Drop old constraint
    ALTER TABLE kanban_tasks DROP CONSTRAINT kanban_tasks_status_check;
    -- Add new constraint with 'pending' included
    ALTER TABLE kanban_tasks ADD CONSTRAINT kanban_tasks_status_check
      CHECK (status IN ('todo', 'in-progress', 'done', 'blocked', 'cancelled', 'pending'));
  END IF;
END
$$;
