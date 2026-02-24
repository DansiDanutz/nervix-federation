# Research Log - 2026-02-19

> **Researcher:** Nano 🦞
> **Method:** Question → Search → Documentation → Answer → GSD

---

## Batch 1: Strategic Questions

### Q1: What is the Minimal Viable Product (MVP) for Nervix?
**Question:** What are the absolute minimum features needed for Nervix to function as an AI agent marketplace?

**Search:** AI marketplace MVP, agent federation minimal requirements

**Research:** ✅ COMPLETE
- **Sources:** Perplexity search on AI marketplace MVP patterns
- **Key Finding:** Core MVP features for AI marketplace with agent federation

**Answer:**
The Nervix MVP requires these 5 core features:

1. **Agent/Model Catalog & Search**
   - Browsable directory of AI agents
   - Filters by task, price, performance metrics
   - AI-powered matching/recommendations
   - **Why Essential:** Attracts users, validates demand

2. **Agent Enrollment & Profiles**
   - Simple sign-up for agents (sellers)
   - Profiles showcasing capabilities
   - Agent metadata standard (inputs/outputs, capabilities)
   - **Why Essential:** Enables federation interoperability

3. **Task Transaction System**
   - Buying/selling flow with pricing
   - Escrow for trust
   - Transaction history
   - **Why Essential:** Enables revenue validation

4. **Testing Sandbox Interface**
   - Test agents instantly
   - Gather feedback data
   - **Why Essential:** Drives learning loop

5. **Federation API Endpoints**
   - Agent discovery (register, query)
   - Agent-to-agent communication
   - Task delegation protocol
   - **Why Essential:** Differentiates as AI marketplace, not just marketplace

**GSD Task:** Design and build the 5 MVP features in this order, prioritizing Catalog + Federation APIs first.

**Decision:** Start with Catalog + Federation APIs (enables agents to register and discover each other), then add transaction system, then testing sandbox.

---

### Q2: How Should Task Delegation Work?
**Question:** What is the technical architecture for delegating tasks to 26 nanobots efficiently?

**Search:** Task queue architecture, agent task distribution, message broker patterns

**Research:** ✅ COMPLETE
- **Sources:** Perplexity search on task queue patterns and message brokers
- **Key Finding:** Redis/BullMQ for persistent job queues + RabbitMQ for pub/sub events

**Answer:**

**Architecture for Nervix Task Delegation:**

**Option A: Redis + BullMQ (Recommended for MVP)**
```
Supabase Tasks Table (DB)
    ↓
BullMQ Queue (Redis)
    ↓
26 Nanobots (Workers pull tasks)
    ↓
Results → Supabase Tasks Table (DB)
```

**Why Redis/BullMQ:**
- ✅ Pull-based (workers pull when ready)
- ✅ Job persistence (survives crashes)
- ✅ Priority queues (urgent tasks first)
- ✅ Retries with exponential backoff
- ✅ Dependencies between tasks
- ✅ Simple, scales with Redis Cluster
- ✅ Already have Supabase (can add Redis)

**Option B: RabbitMQ (More complex, event-driven)**
```
RabbitMQ Exchange (Fanout/Topic)
    ↓
26 Nanobot Queues (Broker pushes)
    ↓
Consumers process
```

**Why RabbitMQ:**
- ✅ Pub/sub for events (agent discovery, status updates)
- ✅ Complex routing (direct, fanout, topic exchanges)
- ✅ Federation (multi-broker coordination)
- ❌ More complex setup
- ❌ Overkill for MVP task distribution

**Recommended Hybrid:**
1. **Redis/BullMQ** for task execution (jobs, retries, priorities)
2. **RabbitMQ** for events (agent discovery, broadcasts, status)

**Workflow:**
1. User creates task → Supabase `tasks` table
2. Supabase trigger → BullMQ queue
3. Nanobots poll/subscribe → Pull task from queue
4. Process task → Update Supabase with result
5. Failed tasks → DLQ → Admin review

**GSD Task:** Implement Redis/BullMQ task queue system for delegating tasks to 26 nanobots.

**Decision:** Use Redis/BullMQ for MVP (simpler, persistent, priority-based). Add RabbitMQ later for complex pub/sub events.

---

### Q3: What Are the First 5 Critical Features?
**Question:** Which features must exist before we can onboard real users/agents?

**Search:** AI marketplace core features, agent onboarding MVP

**Research:** ✅ COMPLETE
- **Sources:** Perplexity search on AI marketplace critical features
- **Key Finding:** Onboarding, UX, and code validation are critical

**Answer:**

**Critical Features Priority:**

1. **Onboarding (PRIORITY 1)**
   - Simple agent registration (one-click)
   - Profile setup with capabilities
   - Quick task posting for buyers
   - **Why:** Attracts early adopters, tests market fit

2. **User Experience - Discovery (PRIORITY 1)**
   - Agent catalog with search/filters
   - Agent capabilities display
   - Preview/test interface
   - **Why:** Retains users, shows value clearly

3. **Code Validation Automation (PRIORITY 2)**
   - Automated testing for agent code
   - Security vulnerability scanning
   - Code quality checks
   - **Why:** Builds trust, prevents errors

4. **Task Execution Pipeline (PRIORITY 2)**
   - Task queue (Redis/BullMQ from Q2)
   - Worker process management
   - Result aggregation
   - **Why:** Core functionality

5. **Feedback & Analytics (PRIORITY 3)**
   - Ratings/reviews system
   - Usage metrics tracking
   - Agent performance stats
   - **Why:** Drives improvement loop

**GSD Task:** Build features in this order: Onboarding → Discovery → Code Validation → Task Pipeline → Feedback.

**Decision:** Start with Onboarding + Discovery (users can register and find agents). Add Code Validation + Task Pipeline next.

---

### Q4: How Do We Test Nanobot Submissions?
**Question:** What validation system ensures nanobots deliver quality work?

**Search:** AI output validation, code review automation, quality gates

**Research:** ✅ COMPLETE
- **Sources:** Perplexity search on AI code review tools
- **Key Finding:** CI/CD integration with automated code review tools

**Answer:**

**Nanobot Testing Strategy:**

**1. Automated Code Review (CI/CD Pipeline)**
```
Nanobot Submits → PR/Git Commit → CI Trigger → Code Review Tool → Quality Gate → Approve/Reject
```

**Tools to Use:**
- **CodeRabbit**: Context-aware PR analysis, auto-fixes, adapts to team patterns
- **GitHub Copilot PR Agent**: Bug/performance detection for AI-generated code
- **SonarQube (Open Source)**: Rule-based quality enforcement, test coverage tracking

**2. Quality Gates (Must Pass to Merge)**
- ✅ No security vulnerabilities
- ✅ No critical bugs
- ✅ Code style compliance
- ✅ Test coverage > 80%
- ✅ No performance regressions

**3. Automated Testing**
- Unit tests for each nanobot
- Integration tests for federation
- End-to-end tests for task execution
- Load testing for scalability

**4. Manual Review (for complex tasks)**
- Nano reviews critical submissions
- Check for security issues
- Verify task completion
- Score performance

**GSD Task:** Set up GitHub Actions with CodeRabbit + SonarQube for automated nanobot code review.

**Decision:** Use CodeRabbit for AI-aware review + SonarQube for rule-based quality gates. Both integrate with GitHub Actions.

---

### Q5: What Metrics Should We Track?
**Question:** What KPIs matter for measuring Nervix success?

**Search:** AI marketplace metrics, agent federation KPIs, marketplace health

**Research:** ✅ COMPLETE
- **Sources:** Perplexity search on AI marketplace KPIs
- **Key Finding:** Adoption, frequency, revenue, and federation-specific metrics

**Answer:**

**Nervix Metrics Dashboard - KPIs to Track:**

**Adoption & Growth:**
1. **Monthly Active Users (MAU)** - Core growth indicator
2. **Daily Active Users (DAU)** - Daily engagement
3. **New Agent Sign-ups** - Federation growth
4. **Visitor to Sign-up Rate** - Conversion funnel

**Engagement & Frequency:**
5. **Tasks per User** - Usage depth
6. **Tasks Completed per Day** - System throughput
7. **Agent Availability %** - Federation health
8. **Average Task Completion Time** - Performance

**Business Impact:**
9. **Revenue per Visit (RPV)** - Monetization efficiency
10. **Total Earnings Distributed** - Value created
11. **Task Success Rate** - Quality metric
12. **NPS (Net Promoter Score)** - User satisfaction

**Federation-Specific:**
13. **Active Agents Online** - Real-time health
14. **Agent Success Rate** - Individual performance
15. **Tasks per Agent** - Workload distribution
16. **Agent Quality Score** - Reputation system

**Infrastructure:**
17. **Request Throughput** - System load
18. **Token Throughput** - AI processing capacity
19. **API Response Time** - Performance
20. **Error Rate** - Reliability

**GSD Task:** Build metrics dashboard tracking these 20 KPIs with Vercel Analytics + Supabase.

**Decision:** Track all 20 metrics. Prioritize adoption/engagement for dashboard overview. Federation metrics for operations.

---

## Research Results
[Will be populated as research completes]
