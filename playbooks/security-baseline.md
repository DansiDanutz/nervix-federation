# Security Baseline for Nervix

> Security-first approach for AI agent federation

## Principles

1. **Zero Trust** - Verify everything, trust nothing
2. **Defense in Depth** - Multiple layers of protection
3. **Audit Everything** - Complete transparency & traceability
4. **Secure by Default** - Secure settings, not optional
5. **Incident Ready** - Have plans, practice them

## Baseline Checklist

### 1. System Security
- [x] User access restricted to authorized accounts
- [ ] SSH key-based authentication only
- [ ] SSH keys rotated monthly
- [ ] SSH password authentication disabled
- [ ] Root login disabled via SSH
- [ ] Firewall configured (ufw/firewalld)
- [ ] Only necessary ports open (22, 443, 8080)
- [ ] System updates automated
- [ ] Security patches applied within 24h
- [ ] Audit logging enabled

### 2. Secrets Management
- [x] API keys stored securely (env vars or secret manager)
- [ ] Secrets rotated every 90 days
- [ ] Secrets never committed to git
- [ ] Secret templates documented (no real values)
- [ ] Access to secrets audited
- [ ] Principle of least privilege applied

### 3. Application Security
- [ ] OpenClaw configuration hardened
- [ ] Agent permissions minimal & scoped
- [ ] Input validation on all agent inputs
- [ ] Output sanitization on all agent outputs
- [ ] Rate limiting on public endpoints
- [ ] CORS properly configured
- [ ] HTTPS enforced everywhere

### 4. Network Security
- [ ] TLS certificates valid and auto-renewed
- [ ] DNSSEC configured where possible
- [ ] Network segmentation considered
- [ ] VPN for remote access (if needed)
- [ ] DDoS protection enabled

### 5. Monitoring & Alerting
- [ ] Security logs collected & centralized
- [ ] Anomaly detection configured
- [ ] Alerts for security events
- [ ] Daily security reports generated
- [ ] Monthly security reviews scheduled

### 6. Agent Security
- [ ] Agent sandboxes isolated
- [ ] Agent communication authenticated
- [ ] Agent execution time-limited
- [ ] Agent resource quotas enforced
- [ ] Agent outputs sanitized
- [ ] Agent permissions audited

## Incident Response

### Triage
1. Detect & acknowledge incident
2. Assess severity & scope
3. Contain immediate threat
4. Notify stakeholders (if public)

### Response
1. Investigate root cause
2. Implement temporary fixes
3. Implement permanent fixes
4. Document & learn

### Recovery
1. Verify fix effectiveness
2. Monitor for recurrence
3. Update playbooks
4. Train team

## Compliance & Standards

- Follow OWASP Top 10 for web security
- Follow NIST guidelines for AI security
- Regular penetration testing
- Security training for all agents & humans

## Daily Security Routine

**Automated (Nano)**
- [ ] Check for security updates
- [ ] Review auth logs
- [ ] Monitor for anomalies
- [ ] Verify firewall rules
- [ ] Audit agent permissions

**Weekly**
- [ ] Full security audit
- [ ] Review incident logs
- [ ] Update threat models
- [ ] Test recovery procedures

---

**Security is not a feature. It's the foundation.** 🦞
