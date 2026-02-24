# Agent Onboarding Playbook

> Standard process for adding agents to the Nervix team

## Prerequisites

Before onboarding a new agent:
- [ ] Agent role and responsibilities defined
- [ ] Required skills identified
- [ ] OpenClaw agent configuration prepared
- [ ] Integration points documented
- [ ] Security permissions scoped
- [ ] Communication channels ready

## Onboarding Steps

### 1. Identity Setup
- Create agent identity in `agents/[name]/IDENTITY.md`
- Document role, focus areas, and emoji/avatar
- Set up personality and operating principles
- Define autonomy boundaries

### 2. Configuration
- Add agent to `openclaw.json`
- Configure model, thinking level, and capabilities
- Set skill permissions and tool access
- Configure notification channels
- Set up monitoring and health checks

### 3. Knowledge Base
- Create `agents/[name]/MEMORY.md` for long-term memory
- Document agent-specific context and preferences
- Link to relevant skills and playbooks
- Set up daily log rotation (`memory/YYYY-MM-DD.md`)

### 4. Skills & Training
- Install required skills
- Run skill verification tests
- Document skill-specific workflows
- Create training materials and examples
- Set up skill update automation

### 5. Integration
- Configure agent communication protocols
- Set up task delegation flows
- Define handoff patterns with other agents
- Create escalation procedures
- Test cross-agent workflows

### 6. Security & Permissions
- Apply security baseline
- Configure sandbox permissions
- Set up resource quotas
- Audit access controls
- Document security boundaries

### 7. Monitoring & Observability
- Configure health checks
- Set up performance metrics
- Create alerting rules
- Set up log aggregation
- Configure daily status reports

### 8. Documentation
- Create agent README
- Document capabilities and limitations
- Create troubleshooting guide
- Set up contribution guidelines
- Link to federation protocols

## Agent Roles

### Dexter (Development)
**Focus:** Coding, automation, infrastructure
**Skills:** Coding-agent, AutoForge, Claude Code, Codex CLI
**Permissions:** Read-write code, execute builds, deploy

### Memo (Documentation & Research)
**Focus:** Documentation, memory, research
**Skills:** Session-logs, web-search, memory management
**Permissions:** Read-only code, write documentation, research

### Sienna (Communications)
**Focus:** Community, outreach, notifications
**Skills:** Message channels, community engagement
**Permissions:** Send messages, moderate comms, outreach

### Future Roles
- **Security Sentinel** - Security audits, threat monitoring
- **Economics Designer** - Economic models, incentive systems
- **Federation Architect** - Cross-team protocols, integration
- **Quality Engineer** - Testing, validation, standards

## First Week Checklist

### Day 1: Setup
- [ ] Identity configured
- [ ] Configuration deployed
- [ ] Basic skills installed
- [ ] Health checks passing

### Day 2-3: Training
- [ ] Skills tested and verified
- [ ] Workflows documented
- [ ] Integration tests passing
- [ ] Security reviewed

### Day 4-5: Integration
- [ ] Cross-agent workflows tested
- [ ] Task delegation working
- [ ] Monitoring configured
- [ ] Documentation complete

### Day 6-7: Production
- [ ] First tasks assigned
- [ ] Performance measured
- [ ] Feedback collected
- [ ] Adjustments made

## Ongoing Operations

### Daily
- Health checks
- Task review
- Performance metrics
- Security audit

### Weekly
- Skill updates
- Workflow optimization
- Performance review
- Team sync

### Monthly
- Capability expansion
- Skill deep-dive
- Architecture review
- Economic contribution

---

**Great agents enable great teams.** 🦞
