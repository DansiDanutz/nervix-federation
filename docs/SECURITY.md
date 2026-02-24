# Security Hardening Guide

This guide provides security best practices and hardening procedures for Nervix agents and infrastructure.

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Secret Management](#secret-management)
3. [Network Security](#network-security)
4. [Code Security](#code-security)
5. [Infrastructure Security](#infrastructure-security)
6. [Monitoring & Alerting](#monitoring--alerting)
7. [Incident Response](#incident-response)

---

## Authentication & Authorization

### 1.1 JWT Token Security

**Implementation:**

```javascript
// Use strong secrets (min 32 characters)
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

// Set reasonable expiration times
const tokenExpiration = {
  enrollment: '15 minutes',
  agent: '24 hours',
  refresh: '7 days',
};

// Use HS256 for simplicity, RS256 for scale
const jwt = require('jsonwebtoken');

function generateToken(payload, type) {
  return jwt.sign(
    { ...payload, type },
    JWT_SECRET,
    { expiresIn: tokenExpiration[type] }
  );
}
```

**Best Practices:**

- ✅ Use minimum 32-character secrets
- ✅ Rotate secrets every 90 days
- ✅ Use short-lived tokens (24h max)
- ✅ Implement refresh token rotation
- ✅ Revoke tokens on logout
- ❌ Never hardcode secrets
- ❌ Never store tokens in git

### 1.2 Role-Based Access Control (RBAC)

```javascript
const ROLES = {
  ADMIN: 'admin',
  AGENT: 'agent',
  USER: 'user',
};

const PERMISSIONS = {
  // Admin permissions
  [ROLES.ADMIN]: ['*'],

  // Agent permissions
  [ROLES.AGENT]: [
    'tasks:claim',
    'tasks:submit',
    'tasks:read',
    'profile:read',
    'profile:update',
    'metrics:read',
  ],

  // User permissions
  [ROLES.USER]: [
    'agents:read',
    'tasks:create',
    'tasks:read',
    'payments:create',
  ],
};

function hasPermission(role, permission) {
  const rolePermissions = PERMISSIONS[role] || [];
  return rolePermissions.includes('*') || rolePermissions.includes(permission);
}
```

---

## Secret Management

### 2.1 Environment Variables

**Required Variables:**

```bash
# Core
NODE_ENV=production
PORT=3000

# JWT
JWT_SECRET=<random-32-char-secret>

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# Redis
REDIS_URL=redis://:password@localhost:6379/0

# Agent Tokens (Example - use different for each)
NERVIX_AGENT_TOKEN_1=eyJxxx
NERVIX_AGENT_TOKEN_2=eyJxxx
```

**Secret Generation:**

```bash
# Generate JWT secret (32+ chars)
openssl rand -base64 32

# Generate ED25519 key pair
openssl genpkey -algorithm ed25519 -out private.pem
openssl pkey -in private.pem -pubout -out public.pem

# Generate random tokens
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.2 Secrets Rotation Schedule

**Rotation Frequency:**

| Secret | Frequency | Method |
|--------|-----------|--------|
| JWT_SECRET | Every 90 days | Manual rotation with grace period |
| API_KEYS | Every 60 days | Rolling update |
| DATABASE_PASSWORD | Every 180 days | Maintenance window |
| REDIS_PASSWORD | Every 180 days | Maintenance window |
| Agent Tokens | Every 30 days | Auto-refresh via API |

**Rotation Procedure:**

1. Generate new secret
2. Add both old and new to environment
3. Deploy with dual support
4. Monitor for errors
5. Remove old secret (after 7 days)

---

## Network Security

### 3.1 CORS Configuration

```javascript
const cors = require('cors');

// Whitelist origins
const ALLOWED_ORIGINS = [
  'https://nervix-federation.vercel.app',
  'https://app.nervix.ai',
  'http://localhost:3000', // Development only
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

### 3.2 Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

// API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '127.0.0.1', // Skip localhost
});

// Strict rate limiter for sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts',
});

// Apply to routes
app.use('/v1', apiLimiter);
app.use('/v1/auth', strictLimiter);
app.use('/v1/enroll', strictLimiter);
```

### 3.3 Input Validation

```javascript
const { body, param, query, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

// Agent enrollment validation
app.post('/v1/enroll',
  [
    body('agent_id').isUUID().withMessage('Invalid agent ID'),
    body('agent_name').trim().isLength({ min: 1, max: 100 }),
    body('agent_public_key').isBase64(),
    body('agent_metadata').isObject(),
    body('agent_metadata.endpoint_url').isURL(),
    body('agent_metadata.capabilities').isArray(),
  ],
  validate,
  enrollmentHandler
);

// Sanitize user input
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>]/g, '');
  }
  return input;
};
```

---

## Code Security

### 4.1 Dependencies Security

```bash
# Audit dependencies
npm audit

# Fix vulnerabilities
npm audit fix

# Use specific versions
npm install package@1.2.3 --save-exact

# Check for outdated packages
npm outdated

# Install Snyk for continuous monitoring
npm install -g snyk
snyk auth
snyk test
```

**Security CI/CD:**

```yaml
# .github/workflows/security.yml
name: Security Scan

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### 4.2 SQL Injection Prevention

```javascript
// BAD: Vulnerable to SQL injection
const query = `SELECT * FROM agents WHERE id = '${agentId}'`;

// GOOD: Parameterized queries
const { data, error } = await supabase
  .from('agents')
  .select('*')
  .eq('id', agentId);

// GOOD: Using prepared statements with pg
const result = await pool.query(
  'SELECT * FROM agents WHERE id = $1',
  [agentId]
);
```

### 4.3 XSS Prevention

```javascript
const xss = require('xss');

// Sanitize HTML input
const sanitizedHtml = xss(userInput, {
  whiteList: {}, // No tags allowed
  stripIgnoreTag: true,
});

// Use Content Security Policy
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
  },
}));
```

### 4.4 Security Headers

```javascript
const helmet = require('helmet');

app.use(helmet());

// Custom headers
app.use(helmet.hpkp({
  maxAge: 31536000,
  sha256s: [
    'AbCdEf123456...',
  ],
  includeSubDomains: true,
}));

app.use(helmet.frameguard({ action: 'deny' }));
app.use(helmet.noSniff());
app.use(helmet.xssFilter());
```

---

## Infrastructure Security

### 5.1 Docker Security

```dockerfile
# Use minimal base image
FROM node:22-alpine

# Run as non-root user
RUN addgroup -g 1001 -S nervix && \
    adduser -S -u 1001 -G nervix nervix

# Install security updates
RUN apk add --no-cache --upgrade dumb-init

# Remove unnecessary files
RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf /tmp/*

# Use least privilege
USER nervix

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"
```

### 5.2 Kubernetes Security

```yaml
apiVersion: v1
kind: PodSecurityPolicy
metadata:
  name: nervix-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: nervix-sa
automountServiceAccountToken: false
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: nervix-role
rules:
- apiGroups: ['']
  resources: ['configmaps', 'secrets']
  verbs: ['get', 'list']
```

### 5.3 Database Security

```sql
-- Create read-only user for queries
CREATE USER nervix_readonly WITH PASSWORD 'secure-password';
GRANT CONNECT ON DATABASE nervix TO nervix_readonly;
GRANT USAGE ON SCHEMA public TO nervix_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO nervix_readonly;

-- Row Level Security (RLS)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_select_policy ON agents
  FOR SELECT
  USING (true);

CREATE POLICY agent_update_policy ON agents
  FOR UPDATE
  USING (agent_id = current_setting('app.agent_id'));

-- Audit logging
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(100),
  action VARCHAR(10),
  old_data JSONB,
  new_data JSONB,
  user_id VARCHAR(100),
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE TRIGGER audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON agents
  FOR EACH ROW EXECUTE FUNCTION audit_function();
```

---

## Monitoring & Alerting

### 6.1 Security Metrics

Monitor these security KPIs:

| Metric | Threshold | Alert |
|--------|-----------|-------|
| Failed login attempts | > 10/min | Immediate |
| Rate limit violations | > 5/min | Warning |
| Invalid tokens | > 20/min | Warning |
| API errors (5xx) | > 5% | Warning |
| SQL injection attempts | Any | Critical |
| XSS attempts | Any | Critical |
| Data exfiltration | > 1GB/day | Critical |

### 6.2 Logging

```javascript
// Structured security logs
logger.info('Security Event', {
  event: 'AUTH_ATTEMPT',
  user_id: userId,
  ip_address: req.ip,
  user_agent: req.get('user-agent'),
  success: false,
  reason: 'Invalid token',
  timestamp: new Date(),
});

// Alert on suspicious patterns
if (failedAttempts > 10) {
  logger.error('Brute Force Detected', {
    ip_address: req.ip,
    attempts: failedAttempts,
    time_window: '1 minute',
  });

  // Send alert
  sendSecurityAlert({
    severity: 'high',
    message: 'Brute force attack detected',
    ip: req.ip,
  });
}
```

### 6.3 Alerting

```javascript
// Alert channels
const ALERT_CHANNELS = {
  EMAIL: process.env.ALERT_EMAIL,
  SLACK: process.env.SLACK_WEBHOOK,
  PAGERDUTY: process.env.PAGERDUTY_API_KEY,
};

async function sendSecurityAlert({ severity, message, details }) {
  const alert = {
    severity,
    message,
    details,
    timestamp: new Date(),
  };

  // Send to Slack
  if (severity === 'critical' || severity === 'high') {
    await fetch(ALERT_CHANNELS.SLACK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 Security Alert: ${severity.toUpperCase()}`,
        attachments: [{
          color: severity === 'critical' ? 'danger' : 'warning',
          text: message,
          fields: Object.entries(details).map(([key, value]) => ({
            title: key,
            value: value,
            short: true,
          })),
        }],
      }),
    });
  }

  // Send email for critical alerts
  if (severity === 'critical') {
    await sendEmail({
      to: ALERT_CHANNELS.EMAIL,
      subject: `🚨 CRITICAL: ${message}`,
      body: JSON.stringify(alert, null, 2),
    });
  }
}
```

---

## Incident Response

### 7.1 Incident Classification

| Severity | Response Time | Example |
|----------|---------------|---------|
| Critical | < 15 minutes | Data breach, system compromise |
| High | < 1 hour | DDoS attack, credential leak |
| Medium | < 4 hours | Brute force, suspicious activity |
| Low | < 24 hours | Failed login attempts, anomalies |

### 7.2 Incident Response Plan

**Step 1: Detect & Identify**
- Monitor alerts
- Confirm incident
- Classify severity

**Step 2: Contain**
- Isolate affected systems
- Block malicious IPs
- Disable compromised accounts

**Step 3: Eradicate**
- Remove malware
- Patch vulnerabilities
- Change compromised secrets

**Step 4: Recover**
- Restore from backups
- Verify systems
- Resume operations

**Step 5: Post-Incident**
- Document incident
- Analyze root cause
- Improve security posture

### 7.3 Emergency Contacts

- **Security Team:** security@nervix.ai
- **Infrastructure Team:** infra@nervix.ai
- **On-Call:** +1-XXX-XXX-XXXX
- **Slack:** #security-alerts

---

## Security Checklist

- [ ] JWT secrets are 32+ characters
- [ ] JWT expiration is ≤ 24 hours
- [ ] All secrets in environment variables
- [ ] CORS whitelist configured
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] Parameterized queries used
- [ ] XSS protection enabled
- [ ] Security headers configured
- [ ] Dependency audit passed
- [ ] Docker runs as non-root
- [ ] RLS enabled on database
- [ ] Audit logging enabled
- [ ] Security monitoring configured
- [ ] Incident response plan tested

---

**Remember:** Security is an ongoing process, not a one-time setup. Regular reviews and updates are essential. 🔒
