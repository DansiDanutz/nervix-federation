# Migration Files Saved - 2026-02-28 22:24 UTC

**Agent:** Nano 🦞

---

## ✅ Migrations Saved

**Folder Created:** `nervix/migrations/`

### 1. **kanban_migration_v2.sql** (3.1KB)

**Creates:** `kanban_tasks` table

**Schema:**
- id (UUID, PRIMARY KEY)
- title (TEXT, NOT NULL)
- description (TEXT)
- category (TEXT)
- priority (TEXT, CHECK: critical|high|medium|low)
- status (TEXT, CHECK: todo|in-progress|done|blocked|cancelled|pending)
- assigned_to (TEXT, NOT NULL)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
- completed_at (TIMESTAMPTZ)
- due_date (TIMESTAMPTZ)
- labels (JSONB)
- blockers (JSONB)
- dependencies (JSONB)

**Features:**
- 5 indexes for performance
- RLS policies for service_role and authenticated
- Auto-update trigger on updated_at
- 5 initial tasks seeded for Nano

---

### 2. **war_room_migration_v2.sql** (2.1KB)

**Creates:** `war_room_messages` table

**Schema:**
- id (UUID, PRIMARY KEY)
- sender_name (TEXT, NOT NULL)
- message (TEXT, NOT NULL)
- priority (TEXT)
- message_type (TEXT)
- metadata (JSONB)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)

**Features:**
- 4 indexes for performance
- RLS policies for authenticated (read+insert)
- Auto-update trigger on updated_at
- 1 welcome message seeded from System

---

## 📋 How to Apply

### Apply ONE AT A TIME:

#### **Step 1: Apply kanban_migration_v2.sql**

1. Go to: https://supabase.com/dashboard/project/kisncxslqjgdesgxmwen/sql/new
2. Copy contents of: `nervix/migrations/kanban_migration_v2.sql`
3. Paste into SQL Editor
4. Click "Run"
5. Verify: No errors

#### **Step 2: Apply war_room_migration_v2.sql**

1. Go to: https://supabase.com/dashboard/project/kisncxslqjgdesgxmwen/sql/new
2. Copy contents of: `nervix/migrations/war_room_migration_v2.sql`
3. Paste into SQL Editor
4. Click "Run"
5. Verify: No errors

---

## ✅ After Applying

### Verify Tables Created:

1. **Supabase Dashboard → Table Editor**
   - Look for: kanban_tasks
   - Look for: war_room_messages

2. **Check Initial Data:**
   - kanban_tasks should have 5 rows
   - war_room_messages should have 1 row (System message)

3. **Test Heartbeat:**
   ```bash
   node /home/Nano1981/.openclaw/workspace/heartbeat_check.js
   ```
   - Should find Nano's 5 tasks
   - Should show no messages from David (only system message)

---

## 📊 What Heartbeat Will Do

### Check kanban_tasks:
```javascript
await supabase
  .from('kanban_tasks')
  .select('*')
  .in('status', ['todo', 'in-progress', 'pending'])
  .order('created_at', { ascending: false })
  .limit(10);
```

**Expected Output:**
- 5 tasks assigned to Nano
- Tasks: Apply Rate Limiting, Test Security, Restart API, TON Smart Contract, Webhooks

---

### Check war_room_messages:
```javascript
await supabase
  .from('war_room_messages')
  .select('*')
  .ilike('sender_name', 'David')
  .order('created_at', { ascending: false })
  .limit(5);
```

**Expected Output:**
- 0 messages from David
- Only 1 system welcome message

---

## 🎯 Status

**Migrations:** ✅ **SAVED IN nervix/migrations/**
**SQL Syntax:** ✅ **NO ERRORS** (removed IF NOT EXISTS from policies)
**Documentation:** ✅ MIGRATIONS_FIXED.md created
**Ready:** ✅ **READY TO APPLY**

---

**File Locations:**
- `/home/Nano1981/.openclaw/workspace/nervix/migrations/kanban_migration_v2.sql`
- `/home/Nano1981/.openclaw/workspace/nervix/migrations/war_room_migration_v2.sql`

**Dashboard:** https://supabase.com/dashboard/project/kisncxslqjgdesgxmwen/sql/new

---

**Apply both migrations, then Nano can start working on assigned tasks!** 🦞
