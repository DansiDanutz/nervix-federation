# 💻 Dev Skills Guide - Building Robust Systems

> **For:** Dev Bot (Dexter - Development & Automation)
> **Purpose:** Master full-stack development, automation, and scalable systems
> **Created:** 2026-02-19

---

## 🚀 Development Philosophy

**Goal:** Build scalable, secure, maintainable systems that power Nervix federation.

**Core Principles:**
1. **Code Quality First** - Clean, readable, maintainable code
2. **Security by Design** - Never bolt on security, build it in
3. **Test Everything** - Unit, integration, end-to-end tests
4. **Performance Matters** - Optimize for speed and scale
5. **Automation Over Manual** - Scripts, CI/CD, infrastructure as code

---

## 🛠️ Essential Development Skills

### Skill 1: OpenClaw Gateway & Agent Architecture

**What It Is:**
Understanding OpenClaw's agent system, tool invocation, and session management.

**Key Concepts:**

1. **Gateway Architecture**
   - Single Gateway daemon manages all sessions
   - Tool provider system for extensibility
   - Session isolation and security boundaries
   - Message routing between providers and models

2. **Agent Development**
   - Agent configuration (tools, models, skills)
   - Session management (main vs isolated)
   - Sub-agent orchestration
   - Memory and context management

3. **Tool Building**
   - Tool provider interface
   - Tool configuration and permissions
   - Tool lifecycle (start, run, cleanup)
   - Error handling and recovery

4. **Cron Jobs & Automation**
   - Cron job scheduling (at, every, cron expressions)
   - Payload types (systemEvent, agentTurn)
   - Delivery modes (announce, direct)
   - Job execution and monitoring

**Practice Exercise:**
```javascript
// Tool Provider Example (TypeScript)
import { ToolProvider } from '@openclaw/gateway';

export class CustomToolProvider implements ToolProvider {
  name = 'custom-tool';
  version = '1.0.0';

  async start(config: any): Promise<void> {
    // Initialize tool
    console.log('Custom tool started');
  }

  async execute(params: any): Promise<any> {
    // Execute tool logic
    return { success: true, data: 'result' };
  }

  async stop(): Promise<void> {
    // Cleanup
    console.log('Custom tool stopped');
  }
}
```

---

### Skill 2: API Development (Express, REST, GraphQL)

**What It Is:**
Building robust, documented, scalable APIs.

**Key Techniques:**

1. **REST API Design**
   - Resource-based URLs (nouns, not verbs)
   - HTTP methods (GET, POST, PUT, PATCH, DELETE)
   - Status codes (200, 201, 400, 401, 403, 404, 500)
   - Versioning (v1, v2 in URL or header)
   - Pagination (limit, offset, page, per_page)
   - Filtering, sorting, searching

2. **Express.js Best Practices**
   - Middleware chain (request → response)
   - Error handling middleware
   - Route organization (router modules)
   - Async/await error handling
   - Request validation (express-validator, Joi)
   - Response formatting (standardized structure)

3. **GraphQL (Optional)**
   - Schema definition (type, query, mutation)
   - Resolvers (data fetching logic)
   - Query optimization (dataloader, caching)
   - Subscription (real-time updates)

4. **API Documentation**
   - OpenAPI/Swagger spec
   - Request/response examples
   - Error code documentation
   - Authentication/authorization notes

**Practice Exercise:**
```javascript
// Express API with Validation
import express, { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests',
});

app.use('/api/', apiLimiter);

// Validation schema
const createAgentSchema = Joi.object({
  name: Joi.string().required().min(3).max(100),
  publicKey: Joi.string().required(),
  capabilities: Joi.array().items(Joi.string()),
});

// Route with validation
app.post('/api/agents',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate input
      const { error, value } = createAgentSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
      }

      // Business logic
      const agent = await createAgent(value);

      res.status(201).json({
        success: true,
        data: agent,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

export default app;
```

---

### Skill 3: Database Development (PostgreSQL, Prisma/TypeORM)

**What It Is:**
Designing schemas, writing queries, and optimizing database performance.

**Key Techniques:**

1. **Schema Design**
   - Normalization (1NF, 2NF, 3NF)
   - Indexing (B-tree, composite, unique)
   - Foreign keys and relationships (1:1, 1:N, N:M)
   - Constraints (NOT NULL, CHECK, UNIQUE)
   - Migrations (version control for schema)

2. **Query Optimization**
   - EXPLAIN ANALYZE (query planning)
   - Index usage (avoid table scans)
   - Query patterns (JOIN vs subqueries)
   - Connection pooling
   - Prepared statements

3. **ORM/Query Builders**
   - Prisma (type-safe, auto-generated types)
   - TypeORM (active record, TypeScript)
   - Knex.js (query builder)
   - Raw SQL fallback

4. **Data Modeling**
   - Entity-Relationship Diagrams
   - Data integrity rules
   - Soft deletes (deleted_at)
   - Auditing (created_at, updated_at)
   - Time zones (UTC everywhere)

**Practice Exercise:**
```javascript
// Prisma Schema
// schema.prisma

model Agent {
  id          String    @id @default(cuid())
  name        String
  publicKey   String    @unique
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  tasks       Task[]    @relation("AgentTasks")
  submissions Submission[]
  reputation  Reputation?
}

model Task {
  id          String       @id @default(cuid())
  title       String
  description String
  requirements Json?
  reward      Decimal      @db.Decimal(10, 2)
  status      TaskStatus   @default(PENDING)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  deadline    DateTime?

  agent       Agent?       @relation("AgentTasks")
  submissions Submission[]
}

model Submission {
  id          String   @id @default(cuid())
  taskId      String
  agentId     String
  result      Json
  status      SubmissionStatus @default(PENDING)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  task        Task     @relation(fields: [taskId], references: [id])
  agent       Agent    @relation(fields: [agentId], references: [id])
}

enum TaskStatus {
  PENDING
  CLAIMED
  IN_PROGRESS
  COMPLETED
  FAILED
}

enum SubmissionStatus {
  PENDING
  APPROVED
  REJECTED
}
```

```typescript
// Prisma Client with Transactions
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTaskWithSubmission(
  taskData: any,
  submissionData: any
) {
  return await prisma.$transaction(async (tx) => {
    // Create task
    const task = await tx.task.create({
      data: taskData,
    });

    // Create submission
    const submission = await tx.submission.create({
      data: {
        ...submissionData,
        taskId: task.id,
      },
    });

    return { task, submission };
  });
}
```

---

### Skill 4: Authentication & Security (JWT, OAuth, Encryption)

**What It Is:**
Implementing secure authentication, authorization, and data protection.

**Key Techniques:**

1. **Authentication Methods**
   - JWT (JSON Web Tokens) - stateless
   - OAuth 2.0 - third-party auth
   - API Keys - simple token auth
   - Session cookies - server-side sessions

2. **Cryptography**
   - Ed25519 - signatures (agent identity)
   - Ed25519ph - pre-hashed signatures
   - AES-256-GCM - encryption
   - Argon2 - password hashing
   - SHA-256 - hashing

3. **Security Best Practices**
   - HTTPS only (enforce via HSTS)
   - Secure cookies (HttpOnly, SameSite)
   - CSRF protection
   - Input validation & sanitization
   - SQL injection prevention (parameterized queries)
   - XSS prevention (escape output)

4. **Authorization**
   - RBAC (Role-Based Access Control)
   - ABAC (Attribute-Based Access Control)
   - Resource-level permissions
   - Action-level permissions

**Practice Exercise:**
```typescript
// JWT Authentication with Ed25519
import jwt from 'jsonwebtoken';
import { Signer, Verifier } from '@noble/ed25519';

interface TokenPayload {
  agentId: string;
  publicKey: string;
  capabilities: string[];
  iat: number;
  exp: number;
}

// Generate JWT token
async function generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (90 * 24 * 60 * 60); // 90 days

  const fullPayload: TokenPayload = {
    ...payload,
    iat: now,
    exp,
  };

  return jwt.sign(fullPayload, process.env.JWT_SECRET!, {
    algorithm: 'HS256',
  });
}

// Verify JWT token
function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}

// Ed25519 signature verification
async function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): Promise<boolean> {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = new Uint8Array(Buffer.from(signature, 'hex'));
    const publicKeyBytes = new Uint8Array(Buffer.from(publicKey, 'hex'));

    return await Signer.verify(signatureBytes, messageBytes, publicKeyBytes);
  } catch (err) {
    return false;
  }
}

// Authentication middleware
function authMiddleware(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.agent = payload;
  next();
}
```

---

### Skill 5: WebSocket & Real-Time (Socket.io, WebRTC)

**What It Is:**
Building real-time communication systems for live updates and collaboration.

**Key Techniques:**

1. **WebSocket Basics**
   - Connection lifecycle (connect, message, disconnect)
   - Rooms and namespaces
   - Broadcasting (global, room, socket)
   - Authentication (socket handshake)

2. **Socket.io**
   - Automatic reconnection
   - Fallback to HTTP long-polling
   - Binary data support
   - Events and acknowledgments

3. **Real-Time Patterns**
   - Pub/Sub (publish-subscribe)
   - Event sourcing
   - Presence systems (who's online)
   - Live notifications
   - Collaboration (cursors, edits)

4. **Scalability**
   - Redis adapter (multiple servers)
   - Load balancing
   - Connection limits
   - Graceful degradation

**Practice Exercise:**
```typescript
// Socket.io Server
import { Server } from 'socket.io';
import { createServer } from 'http';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Authentication middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const payload = verifyToken(token);

  if (!payload) {
    return next(new Error('Authentication failed'));
  }

  socket.data.agent = payload;
  next();
});

// Connection handler
io.on('connection', (socket) => {
  const agentId = socket.data.agent.agentId;
  console.log(`Agent connected: ${agentId}`);

  // Join agent's room
  socket.join(`agent:${agentId}`);

  // Join team rooms
  socket.data.agent.capabilities.forEach((cap: string) => {
    socket.join(`team:${cap}`);
  });

  // Handle task updates
  socket.on('task:update', (data) => {
    io.to(`team:${data.capability}`).emit('task:updated', data);
  });

  // Handle submission
  socket.on('submission:new', (data) => {
    io.to(`agent:${data.agentId}`).emit('submission:created', data);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Agent disconnected: ${agentId}`);
  });
});

// Start server
httpServer.listen(3001, () => {
  console.log('WebSocket server running on port 3001');
});
```

---

### Skill 6: Testing (Jest, Cypress, Integration Tests)

**What It Is:**
Ensuring code quality through comprehensive testing.

**Key Techniques:**

1. **Unit Testing**
   - Test individual functions/modules
   - Mock external dependencies
   - Cover edge cases
   - Aim for 80%+ coverage

2. **Integration Testing**
   - Test component interactions
   - Test database operations
   - Test API endpoints
   - Use test database

3. **End-to-End Testing**
   - Test user flows
   - Test cross-browser compatibility
   - Test mobile responsiveness
   - Use real browser (Cypress, Playwright)

4. **Test Patterns**
   - AAA pattern (Arrange, Act, Assert)
   - Test naming (should...when...)
   - Test data factories
   - Setup/teardown hooks

**Practice Exercise:**
```typescript
// Jest Unit Tests
import { verifySignature, generateToken } from './auth';

describe('Authentication', () => {
  describe('verifySignature', () => {
    it('should verify valid signature', async () => {
      const message = 'test message';
      const publicKey = '...';

      // Mock signature verification
      const result = await verifySignature(message, 'signature', publicKey);

      expect(result).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const message = 'test message';
      const publicKey = '...';

      const result = await verifySignature(message, 'invalid', publicKey);

      expect(result).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT token', async () => {
      const payload = {
        agentId: 'agent-1',
        publicKey: '...',
        capabilities: ['code', 'test'],
      };

      const token = await generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });
  });
});
```

```typescript
// Integration Tests with Supertest
import request from 'supertest';
import app from './app';

describe('API Integration Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();

    // Create test agent and get token
    const response = await request(app)
      .post('/api/agents/enroll')
      .send({
        name: 'Test Agent',
        publicKey: '...',
      });

    authToken = response.body.data.token;
  });

  afterAll(async () => {
    // Cleanup
    await teardownTestDatabase();
  });

  describe('GET /api/agents/:id', () => {
    it('should return agent details', async () => {
      const response = await request(app)
        .get('/api/agents/agent-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('agent-1');
    });

    it('should return 401 without auth', async () => {
      await request(app)
        .get('/api/agents/agent-1')
        .expect(401);
    });
  });
});
```

```typescript
// Cypress E2E Tests
describe('Agent Enrollment Flow', () => {
  it('should enroll new agent successfully', () => {
    cy.visit('/enroll');

    cy.get('[name="name"]').type('Test Agent');
    cy.get('[name="publicKey"]').type('...');

    cy.get('button[type="submit"]').click();

    cy.url().should('include', '/dashboard');
    cy.contains('Welcome, Test Agent');
  });

  it('should show validation errors', () => {
    cy.visit('/enroll');

    cy.get('button[type="submit"]').click();

    cy.contains('Name is required').should('be.visible');
    cy.contains('Public key is required').should('be.visible');
  });
});
```

---

## 🏗️ System Architecture Patterns

### Microservices
- Service isolation
- API Gateway pattern
- Service discovery (Consul, etcd)
- Circuit breakers (resilience)

### Event-Driven
- Message queues (RabbitMQ, Kafka)
- Event sourcing
- CQRS (Command Query Responsibility Segregation)
- Saga pattern (distributed transactions)

### Caching
- Redis (in-memory)
- CDN (static assets)
- Application-level caching
- Database query caching

### Monitoring
- Logging (Winston, Pino)
- Metrics (Prometheus, Grafana)
- Tracing (Jaeger, Zipkin)
- Alerts (PagerDuty, Slack)

---

## 📦 DevOps & Infrastructure

### Containerization
```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

ENV NODE_ENV=production
PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### CI/CD (GitHub Actions)
```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
      - run: npm run lint

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## 📚 Learning Resources

### Books
- "Designing Data-Intensive Applications" by Martin Kleppmann
- "Clean Architecture" by Robert C. Martin
- "The Pragmatic Programmer" by David Thomas
- "Refactoring" by Martin Fowler

### Courses
- "Node.js Design Patterns" - Udemy
- "Microservices with Node.js" - Udemy
- "Docker & Kubernetes" - Coursera
- "Testing JavaScript" - Frontend Masters

### Documentation
- OpenClaw Docs: https://docs.openclaw.ai
- Node.js Docs: https://nodejs.org/docs
- Express Docs: https://expressjs.com
- Prisma Docs: https://www.prisma.io/docs
- PostgreSQL Docs: https://www.postgresql.org/docs

### Tools to Learn
- **Prisma** - Type-safe ORM
- **Jest** - Testing framework
- **Cypress** - E2E testing
- **Docker** - Containerization
- **Redis** - Caching/queues
- **PostgreSQL** - Database
- **Socket.io** - WebSockets
- **GitHub Actions** - CI/CD

---

## 📋 Development Checklist

Before considering code "complete":

**Code Quality:**
- [ ] Code is readable and well-documented
- [ ] Functions are small and single-purpose
- [ ] No code duplication (DRY)
- [ ] Error handling is comprehensive
- [ ] TypeScript types are defined

**Security:**
- [ ] Input validation on all inputs
- [ ] SQL injection prevented
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Secrets never in code
- [ ] HTTPS only in production

**Testing:**
- [ ] Unit tests (80%+ coverage)
- [ ] Integration tests
- [ ] E2E tests for critical flows
- [ ] All tests pass
- [ ] Performance tests if needed

**Performance:**
- [ ] Database queries optimized
- [ ] Caching implemented where needed
- [ ] Response times < 200ms (p95)
- [ ] No N+1 queries
- [ ] Memory usage is reasonable

**Documentation:**
- [ ] API documentation (OpenAPI/Swagger)
- [ ] README with setup instructions
- [ ] Inline comments for complex logic
- [ ] Architecture decisions documented

---

## 🎓 Learning Path

### Week 1: Foundations
- Day 1-2: OpenClaw Gateway & Agent Architecture
- Day 3-4: API Development (Express, REST)
- Day 5-6: Database Development (PostgreSQL, Prisma)
- Day 7: Practice & Portfolio

### Week 2: Advanced
- Day 1-2: Authentication & Security (JWT, OAuth)
- Day 3-4: WebSocket & Real-Time (Socket.io)
- Day 5-6: Testing (Jest, Cypress)
- Day 7: Practice & Portfolio

### Week 3: Systems
- Day 1-3: Microservices Architecture
- Day 4-5: Event-Driven Systems
- Day 6-7: Monitoring & Observability

### Week 4: DevOps
- Day 1-2: Docker & Containerization
- Day 3-4: CI/CD (GitHub Actions)
- Day 5-6: Cloud Deployment (Vercel, AWS)
- Day 7: Final Project

---

## 💡 Pro Tips

1. **Write Tests First** - TDD improves design
2. **Keep Functions Small** - < 20 lines if possible
3. **Use TypeScript** - Catch bugs at compile time
4. **Automate Everything** - Tests, deploys, migrations
5. **Monitor Everything** - Logs, metrics, traces
6. **Learn SQL** - Don't rely only on ORMs
7. **Read Source Code** - Learn from open source
8. **Build Small, Scale Fast** - MVP first, optimize later

---

## 🚀 Next Steps for Dexter

1. **Master the Basics** (Week 1)
   - OpenClaw Gateway architecture
   - API development with Express
   - Database design with Prisma

2. **Build Core Services** (Week 2)
   - Enrollment Service (HIGH priority)
   - Matching Engine (HIGH priority)
   - Communication Layer (MEDIUM priority)

3. **Learn Advanced Patterns** (Week 3)
   - Microservices architecture
   - Event-driven systems
   - WebSocket real-time

4. **Productionize** (Week 4)
   - Testing & monitoring
   - CI/CD pipeline
   - Production deployment

---

**Dexter 💻 - Build Robust Systems**

*Created: 2026-02-19*
*Updated by: Nano (Operations Lead)*
*Status: Ready for Dexter to start learning*

---

**Remember:** Great code isn't just about functionality. It's about maintainability, scalability, security, and performance. Every line matters. Every test matters. Every edge case matters. Build systems that last. 💻🚀
