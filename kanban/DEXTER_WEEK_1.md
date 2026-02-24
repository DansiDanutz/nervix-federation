# 💻 Dexter - Weekly Tasks (Week 1: Foundations)

> **Date:** 2026-02-19
> **Agent:** Dexter (Dev Bot)
> **Focus:** Development Foundations - Gateway, API, Database
> **Goal:** Master core development skills and apply to Nervix

---

## 📅 This Week's Focus

### 🔥 Day 1-2: OpenClaw Gateway & Agent Architecture
**Objective:** Understand OpenClaw's agent system and tool providers.

**Tasks:**
- [ ] Read DEV_SKILLS.md - Skill 1: OpenClaw Gateway
- [ ] Study tool provider interface code
- [ ] Understand session management (main vs isolated)
- [ ] Learn cron job system
- [ ] Practice Exercise 1: Create simple tool provider
- [ ] Practice Exercise 2: Create cron job
- [ ] Study existing Nervix API structure

**Deliverables:**
- Simple tool provider implementation
- Cron job example
- Notes on OpenClaw architecture
- Understanding of session isolation

**Time Estimate:** 2 hours

---

### 🚀 Day 3-4: API Development (Express, REST)
**Objective:** Build robust, documented APIs.

**Tasks:**
- [ ] Read DEV_SKILLS.md - Skill 2: API Development
- [ ] Practice Exercise 1: Create REST API endpoints
- [ ] Practice Exercise 2: Add middleware (auth, validation)
- [ ] Practice Exercise 3: Add error handling
- [ ] Extend Nervix API with new endpoints
- [ ] Add input validation with Joi
- [ ] Document new endpoints

**Deliverables:**
- 5 new API endpoints implemented
- Middleware for auth & validation
- Error handling middleware
- OpenAPI/Swagger documentation
- Unit tests for endpoints

**Time Estimate:** 2 hours

---

### 🗄️ Day 5-6: Database Development (PostgreSQL, Prisma)
**Objective:** Design schemas, write queries, optimize performance.

**Tasks:**
- [ ] Read DEV_SKILLS.md - Skill 3: Database Development
- [ ] Practice Exercise 1: Design database schema
- [ ] Practice Exercise 2: Write Prisma schema
- [ ] Practice Exercise 3: Write optimized queries
- [ ] Create Nervix database schema
- [ ] Set up Prisma client
- [ ] Write migration scripts
- [ ] Add database indexes

**Deliverables:**
- Complete Prisma schema
- Migration scripts
- Database seed data
- Query examples
- Performance benchmarks

**Time Estimate:** 2 hours

---

### 📁 Day 7: Portfolio Week 1
**Objective:** Create portfolio demonstrating learned skills.

**Tasks:**
- [ ] Create Portfolio Item 1: Tool Provider demo
- [ ] Create Portfolio Item 2: REST API demo
- [ ] Create Portfolio Item 3: Database integration demo
- [ ] Document architecture decisions
- [ ] Write README for each demo
- [ ] Present to team (Nano, Memo, Sienna)

**Deliverables:**
- 3 portfolio items
- README files for each
- Architecture documentation
- Team feedback notes

**Time Estimate:** 3 hours

---

## 🎯 Daily Tasks Checklist

### Day 1 (Feb 19): OpenClaw Gateway - Part 1
- [ ] Read DEV_SKILLS.md - Skill 1
- [ ] Study tool provider interface
- [ ] Understand session management
- [ ] Start simple tool provider
- [ ] Commit work to Git

### Day 2 (Feb 20): OpenClaw Gateway - Part 2
- [ ] Complete tool provider
- [ ] Create cron job example
- [ ] Study existing Nervix API
- [ ] Document findings
- [ ] Commit work to Git

### Day 3 (Feb 21): API Development - Part 1
- [ ] Read DEV_SKILLS.md - Skill 2
- [ ] Create REST API endpoints
- [ ] Add middleware (auth, validation)
- [ ] Commit work to Git

### Day 4 (Feb 22): API Development - Part 2
- [ ] Add error handling middleware
- [ ] Extend Nervix API
- [ ] Add input validation
- [ ] Write unit tests
- [ ] Document endpoints
- [ ] Commit work to Git

### Day 5 (Feb 23): Database Development - Part 1
- [ ] Read DEV_SKILLS.md - Skill 3
- [ ] Design database schema
- [ ] Create Prisma schema
- [ ] Write migration scripts
- [ ] Commit work to Git

### Day 6 (Feb 24): Database Development - Part 2
- [ ] Set up Prisma client
- [ ] Add database indexes
- [ ] Write seed data
- [ ] Benchmark queries
- [ ] Commit work to Git

### Day 7 (Feb 25): Portfolio Week 1
- [ ] Create Portfolio Item 1: Tool Provider
- [ ] Create Portfolio Item 2: REST API
- [ ] Create Portfolio Item 3: Database
- [ ] Write README files
- [ ] Present to team
- [ ] Commit work to Git

---

## 📊 Progress Tracking

### Skills Mastered
- [ ] OpenClaw Gateway & Agent Architecture (Day 1-2)
- [ ] API Development (Day 3-4)
- [ ] Database Development (Day 5-6)

### Tasks Completed
- [ ] 0/7 days completed

### Deliverables Created
- [ ] 0/3 portfolio items
- [ ] 0/9 practice exercises

### Team Feedback
- [ ] Not yet presented

---

## 📈 Daily Report Template

**Day X - [Skill Name]**

**Completed:**
- [List of tasks completed]

**Learned:**
- [Key insights from today's work]

**Challenges:**
- [Any blockers or difficulties]

**Next:**
- [Plan for tomorrow]

**Work:**
- [Link to commits/PRs]

---

## 💬 Questions for Team

### For Nano (Operations Lead)
- Which API endpoints should I prioritize?
- Should I focus on enrollment service or matching engine first?
- What's our database strategy (Supabase, PostgreSQL, etc.)?

### For Memo (Documentation)
- How should I document API endpoints?
- Format preferences for code documentation?
- Where to store architecture decisions?

### For Sienna (Design)
- API response format preferences?
- Error handling format preferences?
- Any UI integration considerations?

---

## 🚀 Week 1 Success Criteria

### Must Have (Required)
- ✅ 3 skills mastered (Gateway, API, Database)
- ✅ 9 practice exercises completed
- ✅ 3 portfolio items created
- ✅ All work committed to Git
- ✅ Team presentation completed

### Nice to Have (Bonus)
- ⭐ Tool provider deployed
- ⭐ API tests passing
- ⭐ Database benchmark report
- ⭐ Architecture decision record

---

## 📅 Schedule

| Day | Date | Skill | Tasks |
|-----|------|-------|-------|
| 1 | Feb 19 | OpenClaw Gateway 1 | Read + Study + Tool Provider |
| 2 | Feb 20 | OpenClaw Gateway 2 | Cron Job + Existing API |
| 3 | Feb 21 | API Development 1 | REST Endpoints + Middleware |
| 4 | Feb 22 | API Development 2 | Error Handling + Validation |
| 5 | Feb 23 | Database Development 1 | Schema + Prisma |
| 6 | Feb 24 | Database Development 2 | Migrations + Indexes |
| 7 | Feb 25 | Portfolio Week 1 | 3 Portfolio Items + Presentation |

---

## 🔧 Practice Exercises

### Exercise 1.1: Simple Tool Provider
Create a tool provider that:
- Accepts a text input
- Converts to uppercase
- Returns the result
- Handles errors gracefully

### Exercise 1.2: Cron Job
Create a cron job that:
- Runs every hour
- Logs "Hello from Dexter!"
- Runs in isolated session
- Delivers message to main session

### Exercise 2.1: REST API
Create endpoints:
- `GET /api/items` - List all items
- `GET /api/items/:id` - Get single item
- `POST /api/items` - Create item
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item

### Exercise 2.2: Middleware
Create middleware for:
- JWT authentication
- Request validation (Joi)
- Rate limiting
- Request logging
- Error handling

### Exercise 3.1: Database Schema
Design schema for:
- Users (id, name, email, password_hash)
- Posts (id, title, content, author_id)
- Comments (id, content, post_id, author_id)
- Relationships (user has many posts, post has many comments)

### Exercise 3.2: Prisma Queries
Write queries for:
- Get all users with their posts
- Get single post with author and comments
- Create post with tags
- Update user profile
- Delete post (soft delete)

---

**Dexter 💻 - Week 1: Development Foundations**

*Total Time Estimate: 11 hours*
*Target Completion: Feb 25, 2026*
*Next Milestone: Week 2 - Advanced (Authentication, WebSockets, Testing)*

---

**Let's build robust systems!** 🚀💻
