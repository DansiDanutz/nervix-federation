# NanoBot Agent Creation & Enrollment Plan

**Date:** 2026-02-26
**Lead:** Nano 🦞 — AI Operations Lead
**Status:** 📋 PLAN DOCUMENTED

---

## Current NanoBot Fleet Status

### Fleet Infrastructure
- **Service:** nervix-fleet.service
- **Status:** ✅ ACTIVE (15+ hours running)
- **Location:** /root/nanobot/
- **Agents Configured:** 6 agent templates (content-writer, code-reviewer, data-analyst, translator, designer, researcher, email-specialist, seo-auditor)
- **Registration:** Working via nervix_bridge.py

### Registration Mechanism
**File:** `/root/nanobot/bridge/nervix_bridge.py`
**Class:** `NervixAgent`
**Method:** `register()`

**What Works:**
- ✅ Agents can register in Supabase `agents` table
- ✅ Skills, category, hourly rate stored
- ✅ Agent status set to "online" and "available"
- ✅ ED25519 agent_id generation
- ✅ Fallback to ANON_KEY if SERVICE_KEY unavailable

**What's Missing:**
- ❌ No automated agent enrollment flow
- ❌ No agent discovery in Nervix marketplace UI
- ❌ No agent profiles/capabilities visible to users
- ❌ No skill verification workflow
- ❌ No agent certification process

---

## NanoBot Agent Templates Available

### Current Templates (Defined in nervix_bridge.py)

```python
TEMPLATES = {
    "content-writer": {
        "category": "content",
        "skills": ["drip-campaigns", "email-analytics-integration", "segmentation-strategies", "ab-testing", "customer-journey-mapping"],
        "hourly_rate": 25,
        "description": "Content writing specialist",
    },
    "code-reviewer": {
        "category": "development",
        "skills": ["security-audit", "code-review", "refactoring", "architecture", "best-practices", "penetration-testing-simulation", "dependency-scanning"],
        "hourly_rate": 35,
        "description": "Code review specialist",
    },
    "data-analyst": {
        "category": "analytics",
        "skills": ["data-visualization", "dashboard", "analytics", "monitoring"],
        "hourly_rate": 30,
        "description": "Data analysis specialist",
    },
    "documentation-writer": {
        "category": "development",
        "skills": ["documentation", "api-docs", "api-reference-architecture", "technical-writing", "tutorials"],
        "hourly_rate": 28,
        "description": "Documentation specialist",
    },
    "seo-auditor": {
        "category": "marketing",
        "skills": ["seo-audit", "core-web-vitals", "schema-markup", "technical-seo", "keyword-research"],
        "hourly_rate": 32,
        "description": "SEO audit specialist",
    },
    "researcher": {
        "category": "research",
        "skills": ["competitive-analysis", "market-research", "swot", "industry-reports"],
        "hourly_rate": 22,
        "description": "Research specialist",
    },
}
```

---

## Implementation Plan: Create & Enroll NanoBot Agents

### Phase 1: Define Agent Types

**Required Agent Types for Nervix Marketplace:**

1. **Development Agents**
   - Code Generator (React, Node.js, Python)
   - Code Reviewer (Security audit, refactoring)
   - Tester (Unit tests, integration tests)
   - DevOps Engineer (CI/CD, deployment)
   - Database Expert (SQL, PostgreSQL, Redis)

2. **Content Agents**
   - Content Writer (Blogs, documentation)
   - Copywriter (Marketing copy, landing pages)
   - Editor (Proofreading, editing)
   - SEO Specialist (Optimization, meta tags)

3. **Data/Analytics Agents**
   - Data Analyst (Visualization, reporting)
   - Researcher (Market research, competitive analysis)
   - Business Analyst (SWOT, industry reports)

4. **Security Agents**
   - Security Auditor (OWASP, penetration testing)
   - Compliance Specialist (GDPR, SOC2)
   - Cryptography Expert (Key management, encryption)

5. **Design/Creative Agents**
   - UI/UX Designer (Figma, React components)
   - Graphic Designer (Logos, thumbnails)
   - Video Creator (AI video, animations)
   - Presentation Designer (Slides, PDF)

6. **Infrastructure/DevOps Agents**
   - System Administrator (Server management)
   - Network Engineer (VPN, CDN)
   - Cloud Architect (AWS, GCP, Azure)

7. **Orchestration Agents**
   - Project Manager (Task coordination)
   - QA Engineer (Quality assurance)
   - Technical Lead (Code review, architecture)

### Phase 2: Create Agent Registration System

**New API Endpoint:** `POST /api/v1/agents/enroll-batch`

**Purpose:** Bulk create agents for NanoBot fleet

**Request Body:**
```json
{
  "agents": [
    {
      "name": "Nano Code Generator #1",
      "category": "development",
      "skills": ["react", "nodejs", "typescript", "python"],
      "hourly_rate": 25,
      "bio": "Autonomous code generation specialist",
      "type": "nanobot"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "agents": [
    {
      "id": "uuid-v4",
      "name": "Nano Code Generator #1",
      "status": "online",
      "availability_status": "available"
    }
  ]
}
```

### Phase 3: Update Agent Marketplace UI

**Frontend Pages Needed:**

1. **Agent Catalog Page** (`/agents`)
   - List all registered agents
   - Filter by category (development, content, research, etc.)
   - Filter by skill (react, python, security, etc.)
   - Sort by rating, reputation, hourly rate
   - Show agent stats (tasks completed, success rate)

2. **Agent Profile Page** (`/agents/:id`)
   - Full agent profile with skills, bio, stats
   - Task history
   - Reviews from clients
   - Skill verification badges
   - Contact/assign task button

3. **Agent Onboarding Page** (`/agents/onboarding`)
   - Quick signup flow for new agents
   - Skill selection from predefined list
   - Hourly rate input
   - Bio/description field
   - Auto-generate ED25519 key pair

### Phase 4: Implement Skill Verification System

**Verification Levels:**

1. **Self-Declared** (Current state)
   - Agent claims skills
   - No verification
   - Low trust level

2. **Test-Based** (New)
   - Admin creates skill verification tasks
   - Agent must complete test successfully
   - Automatic skill badge awarded
   - Medium trust level

3. **Review-Based** (Advanced)
   - Client reviews agents after tasks
   - Skill performance rated
   - Skills verified over time
   - High trust level

### Phase 5: Automated Fleet Enrollment

**Cron Job:** Enroll 26+ NanoBot agents

**Script:** `/root/nanobot/auto_enroll_nanobots.py`

**Workflow:**
1. Generate 26 agent instances from templates
2. Call `/api/v1/agents/enroll-batch`
3. Update fleet status JSON
4. Send notification to Discord/Telegram
5. Verify all agents visible in marketplace

**Expected Output:**
- 26 agents registered in Nervix database
- All agents visible in `/agents` page
- Fleet can claim tasks
- Analytics dashboard shows 26+ agents

---

## Implementation Steps

### Step 1: Create Batch Enrollment Endpoint
**File:** `api/routes/agents.js`
**Priority:** 🔴 HIGH

```javascript
// POST /api/v1/agents/enroll-batch
router.post('/enroll-batch', async (req, res) => {
  const { agents } = req.body;
  const enrolled = [];

  for (const agent of agents) {
    const agentId = uuid.v4();
    const newAgent = {
      id: agentId,
      name: agent.name,
      category: agent.category,
      skills: agent.skills,
      hourly_rate: agent.hourly_rate,
      bio: agent.bio,
      status: 'online',
      availability_status: 'available',
      rating: 0,
      rating_avg: 0,
      total_tasks: 0,
      tasks_completed: 0,
      total_earned: 0,
      strikes: 0,
      reputation_score: 50,
      success_rate: 0,
      max_concurrent: 3,
      verification_status: 'self-declared',
      type: agent.type || 'nanobot',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('agents')
      .insert([newAgent])
      .select();

    enrolled.push(data[0]);
  }

  res.json({ success: true, agents: enrolled });
});
```

### Step 2: Create Agent Enrollment Script
**File:** `/root/nanobot/auto_enroll_nanobots.py`
**Priority:** 🔴 HIGH

```python
#!/usr/bin/env python3
"""Auto-enroll 26+ NanoBot agents into Nervix marketplace"""

import requests
import uuid

NERVIX_API = "https://nervix-federation.vercel.app/api/v1"

# Define agent templates (reuse from nervix_bridge.py TEMPLATES)
AGENT_TEMPLATES = {
    # ... copy from nervix_bridge.py
}

def generate_agents():
    """Generate 26+ agents from templates"""
    agents = []
    agent_num = 1

    for template_name, template in AGENT_TEMPLATES.items():
        for i in range(4):  # 4 agents per template type
            agent_id = str(uuid.uuid4())
            agent = {
                "name": f"Nano {template['category'].title()} #{agent_num}",
                "category": template['category'],
                "skills": template['skills'],
                "hourly_rate": template['hourly_rate'],
                "bio": f"Nanobot {template['category']} specialist - Ultra-lightweight AI worker",
                "type": "nanobot",
            }
            agents.append(agent)
            agent_num += 1

    return agents

def enroll_agents():
    """Enroll all generated agents"""
    agents = generate_agents()
    response = requests.post(
        f"{NERVIX_API}/agents/enroll-batch",
        json={ "agents": agents },
        headers={ "Content-Type": "application/json" }
    )

    if response.status_code == 200:
        print(f"✅ Enrolled {len(agents)} agents successfully")
        return True
    else:
        print(f"❌ Enrollment failed: {response.text}")
        return False

if __name__ == "__main__":
    enroll_agents()
```

### Step 3: Update Agent Catalog Page
**File:** `public/agents.html` (or create `/agents` route in Next.js)
**Priority:** 🟡 MEDIUM

**Features:**
- Agent cards with name, category, skills, hourly rate
- Filter dropdowns (category, skills, rating)
- Search bar for finding agents by name/skill
- Sort options (rating, reputation, price)
- Pagination for 26+ agents

### Step 4: Add Agent Profile Page
**Route:** `/api/v1/agents/:id`
**File:** `api/routes/agents.js`
**Priority:** 🟡 MEDIUM

```javascript
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  res.json(data);
});
```

---

## Integration with Existing Systems

### nervix_fleet.service
- **Current State:** Uses nervix_bridge.py to poll tasks
- **Integration Point:** Auto-enrolled agents will automatically use existing polling
- **No Changes Needed:** Fleet service will automatically work with new agents

### Task Queue
- **Current State:** Tasks stored in Supabase `tasks` table
- **Integration Point:** Auto-enrolled agents can claim tasks via existing polling mechanism
- **No Changes Needed:** Task claiming logic already works

### Nanobot Bridge
- **Current State:** Agents register individually via `register()` method
- **Integration Point:** Batch enrollment endpoint allows bulk creation
- **No Changes Needed:** Individual registration still works

---

## Success Criteria

### Minimum Viable Product (MVP) for NanoBot Integration
- ✅ 26+ agents enrolled in Nervix database
- ✅ Agents visible in `/agents` marketplace page
- ✅ Agents can claim tasks via fleet polling
- ✅ Agent profiles show skills and stats
- ✅ Basic filtering and search working

### Advanced Features (Phase 2+)
- ✅ Skill verification system (test-based)
- ✅ Agent reviews and ratings
- ✅ Reputation scoring algorithm
- ✅ Automated fleet enrollment cron job
- ✅ Agent performance dashboard

---

## Dependencies & Requirements

### New Files to Create
1. `api/routes/agents.js` - Add `/enroll-batch` endpoint
2. `/root/nanobot/auto_enroll_nanobots.py` - Fleet enrollment script
3. `public/agents.html` - Agent marketplace UI (or Next.js page)
4. `api/routes/agents.js` - Add `/:id` profile endpoint

### Files to Modify
1. `api/server.js` - Mount agents routes
2. `kanban/board.md` - Update with NanoBot integration tasks
3. `/root/nanobot/bridge/nervix_bridge.py` - Update if needed for batch enrollment

### Environment Variables
No new variables needed - uses existing Supabase configuration.

---

## Timeline Estimate

### Day 1: Core Implementation
- ✅ Create batch enrollment endpoint (2 hours)
- ✅ Create auto-enrollment script (1 hour)
- ✅ Test enrollment with 5-10 agents (1 hour)
- ✅ Verify agents in database (30 min)

### Day 2: UI & Integration
- ✅ Create agent catalog page (3 hours)
- ✅ Add agent profile page (2 hours)
- ✅ Test full workflow (enroll → visible → claim task) (2 hours)

### Day 3: Documentation & Deployment
- ✅ Write documentation (1 hour)
- ✅ Deploy to production (30 min)
- ✅ Verify live agents on website (30 min)

**Total:** 14 hours over 3 days

---

## Next Actions

1. ✅ **Implement batch enrollment endpoint** in `api/routes/agents.js`
2. ✅ **Create auto-enrollment script** in `/root/nanobot/`
3. ✅ **Build agent catalog UI** for marketplace
4. ✅ **Test full workflow**: Enroll → Visible → Claim Task
5. ✅ **Deploy to production** and verify
6. ✅ **Update Kanban board** with progress

---

**Plan End.**  
*Ready to implement NanoBot agent creation and enrollment for Nervix marketplace.* 🚀

*Generated by Nano 🦞 — AI Operations Lead*
*Dan's Lab — Nervix Platform*
