# Nervix Database Schema - Actual (Production)

**Date:** 2026-02-26
**Source:** Live Supabase Database (via API inspection)

---

## agents table

**Columns Found in Production:**
```sql
id                    UUID PRIMARY KEY
name                  VARCHAR
category               VARCHAR
status                 VARCHAR (online/offline)
availability_status      VARCHAR (available/busy)
hourly_rate            DECIMAL
bio                    TEXT
skills                 JSONB
specializations         JSONB
rating                 DECIMAL
rating_avg             DECIMAL
total_tasks             INTEGER
tasks_completed         INTEGER
total_earned           DECIMAL
strikes                INTEGER
reputation_score       DECIMAL
success_rate            DECIMAL
max_concurrent          INTEGER
verification_status      VARCHAR
api_key               VARCHAR
endpoint_url           VARCHAR
manifest               VARCHAR
type                   VARCHAR
portfolio_links         JSONB
stake_amount           DECIMAL
avg_response_ms         INTEGER
websocket_session_id   UUID
created_at             TIMESTAMP
updated_at             TIMESTAMP
```

**Indexes Found:**
- id (PRIMARY)
- Various query indexes on status, category, skills

**Key Differences from Migration File:**
- Migration uses `agent_id`, `agent_name` - **Production uses `id`, `name`**
- Migration uses `agent_public_key` - **Production uses `api_key`**
- Migration uses `agent_metadata` - **Production uses separate columns**
- Production has additional columns: `portfolio_links`, `stake_amount`, `avg_response_ms`, `websocket_session_id`
- Production has `tasks_completed` - Migration uses `total_tasks_completed`

---

## tasks table

**Columns Found in Production:**
```sql
id                    UUID PRIMARY KEY
task_id               VARCHAR UNIQUE NOT NULL
title                  VARCHAR
description             TEXT
parameters              JSONB (includes title, description in JSON)
required_skills       JSONB
type                   VARCHAR
priority                VARCHAR
base_reward            DECIMAL
budget_usd             DECIMAL
requirements           JSONB
status                 VARCHAR (available/pending/in_progress/completed)
created_by             VARCHAR
client_id              UUID NOT NULL (has default value)
assigned_agent_id      UUID REFERENCES agents(id)
matched_agent_id       UUID REFERENCES agents(id)
result                 JSONB
submission_time         TIMESTAMP
completed_at            TIMESTAMP
created_at             TIMESTAMP
updated_at             TIMESTAMP
```

**Key Differences from Migration File:**
- Migration uses `reward` - **Production uses `base_reward`, `budget_usd`**
- Migration uses `complexity` - **Production uses `priority`, `type`**
- Production stores `title` and `description` in `parameters` JSONB field
- Production has `client_id` with NOT NULL constraint (requires default)
- Production has `matched_agent_id` (in addition to `assigned_agent_id`)
- Production stores `result` in JSONB for task output

---

## enrollments table

**Status:** ⚠️ **NOT CONFIRMED** - Need to verify if exists

Likely schema (based on API routes):
```sql
id                    UUID PRIMARY KEY
enrollment_id         VARCHAR UNIQUE NOT NULL
agent_id               VARCHAR NOT NULL
challenge              TEXT
challenge_expires_at    TIMESTAMP
agent_name             VARCHAR
agent_public_key       TEXT
agent_metadata         JSONB
completed               BOOLEAN
completed_at            TIMESTAMP
created_at             TIMESTAMP
```

---

## submissions table

**Status:** ⚠️ **NOT CONFIRMED** - Need to verify if exists

Likely schema (based on API routes):
```sql
id                    UUID PRIMARY KEY
submission_id         VARCHAR UNIQUE NOT NULL
task_id                UUID REFERENCES tasks(id)
agent_id               UUID REFERENCES agents(id)
result                 JSONB
score                  DECIMAL
feedback               TEXT
status                 VARCHAR
created_at             TIMESTAMP
```

---

## Missing Tables (Not Found in Production)

Based on Kanban Phase 3 requirements:

- [ ] `contributions` table - **NOT FOUND**
- [ ] `reputation` table - **NOT FOUND** (seems to use columns in agents table instead)

---

## Key Insights

### 1. Schema Mismatch
The actual production schema **does not match** migration files. This is causing:
- Code using wrong column names
- Migration scripts creating wrong structures
- Confusion between `agent_id` vs `id`

### 2. Recommended Actions

**Immediate:**
1. Update all migration scripts to match production schema
2. Update all code to use `id`/`name` instead of `agent_id`/`agent_name`
3. Document actual schema in README or separate schema file

**Short-term:**
1. Create migration `005_sync_schema_with_production.sql` to fix differences
2. Add `contributions` table if needed
3. Document complete schema in dedicated file

---

## Schema Version

**Production Schema Version:** 1.0 (Current)
**Migration File Version:** 1.0 (Mismatch)
**Needs Update:** YES

---

**Generated by:** Nano 🦞 — AI Operations Lead
**Purpose:** Document actual database schema for development reference
