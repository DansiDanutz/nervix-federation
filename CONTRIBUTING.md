# Contributing to Nervix

Thank you for your interest in contributing to Nervix! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Submitting Changes](#submitting-changes)
- [Project Structure](#project-structure)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. We expect all contributors to:

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment or discriminatory language
- Personal attacks or trolling
- Public or private harassment
- Publishing others' private information
- Other unethical or unprofessional conduct

If you experience or witness unacceptable behavior, please contact: conduct@nervix.ai

---

## Getting Started

### Prerequisites

- Node.js 22+ installed
- Git installed
- Docker (optional, for local testing)
- A GitHub account

### Setup Development Environment

```bash
# 1. Fork the repository
# Click "Fork" on https://github.com/DansiDanutz/nervix-federation

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/nervix-federation.git
cd nervix-federation

# 3. Add upstream remote
git remote add upstream https://github.com/DansiDanutz/nervix-federation.git

# 4. Install dependencies
cd api
npm install

# 5. Create a branch
git checkout -b feature/your-feature-name

# 6. Start development server
npm run dev
```

### Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit with your values
nano .env
```

Required environment variables:
- `JWT_SECRET`: JWT signing secret
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key

---

## Development Workflow

### Branch Naming

- `feature/feature-name`: New features
- `bugfix/bug-description`: Bug fixes
- `docs/documentation-change`: Documentation changes
- `refactor/code-change`: Code refactoring
- `test/test-addition`: Test additions

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Maintenance tasks

**Examples:**

```bash
feat(api): add agent search endpoint

- Add search parameter to /v1/agents
- Implement fuzzy search
- Add pagination support

Closes #123
```

```bash
fix(auth): resolve JWT token validation issue

Fix token expiration check to use correct time comparison.

Fixes #456
```

### Pull Request Process

1. **Update your branch**

```bash
git fetch upstream
git rebase upstream/main
```

2. **Test your changes**

```bash
npm run lint
npm test
npm run build  # if applicable
```

3. **Push to your fork**

```bash
git push origin feature/your-feature-name
```

4. **Create Pull Request**

- Go to your fork on GitHub
- Click "New Pull Request"
- Choose your branch
- Fill in the PR template
- Link related issues

5. **Address feedback**

- Respond to reviewer comments
- Make requested changes
- Push updates to your branch

---

## Coding Standards

### JavaScript/Node.js

- Use **ESLint** for linting
- Follow **Airbnb Style Guide**
- Use **async/await** for async operations
- Prefer **const** over **let** when possible

**Example:**

```javascript
// Good
const agent = await getAgent(agentId);
const tasks = await getTasks(agentId);

// Avoid
let agent = getAgent(agentId); // missing await
let tasks = getTasks(agentId); // missing await
```

### Error Handling

Always handle errors properly:

```javascript
// Good
try {
  const agent = await getAgent(agentId);
  return agent;
} catch (error) {
  logger.error('Failed to get agent', { error, agentId });
  throw new Error('Agent not found');
}

// Avoid
const agent = await getAgent(agentId); // no error handling
```

### API Endpoints

Follow RESTful conventions:

```javascript
// Good
GET /v1/agents
GET /v1/agents/:id
POST /v1/agents
PUT /v1/agents/:id
DELETE /v1/agents/:id

// Avoid
GET /v1/getAgents
GET /v1/agentById?id=123
POST /v1/createAgent
```

### Documentation

Add JSDoc comments for functions:

```javascript
/**
 * Get agent by ID
 * @param {string} agentId - Agent ID
 * @returns {Promise<Object>} Agent object
 * @throws {Error} If agent not found
 */
async function getAgent(agentId) {
  // Implementation
}
```

---

## Testing

### Unit Tests

Test individual functions and services:

```javascript
describe('MetricsService', () => {
  test('should record metric', () => {
    metricsService.record('test.metric', 42);
    const metric = metricsService.collector.get('test.metric');
    expect(metric).not.toBeNull();
  });
});
```

### Integration Tests

Test complete workflows:

```javascript
describe('Agent Enrollment Integration', () => {
  test('Complete enrollment flow', async () => {
    const response = await request(app)
      .post('/v1/enroll')
      .send({
        agent_id: uuidv4(),
        agent_name: 'Test Agent',
        // ...
      });

    expect(response.status).toBe(200);
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- api/tests/services.test.js

# Run in watch mode
npm test -- --watch
```

### Test Coverage

We require minimum 80% code coverage:

```bash
npm test -- --coverage --collectCoverageFrom='api/**/*.js'
```

---

## Documentation

### API Documentation

Document all API endpoints in `docs/API.md`:

```markdown
### GET /v1/agents

List all agents with search, filters, and pagination.

**Query Parameters:**
- `search` (string): Search term
- `page` (number): Page number
- `limit` (number): Items per page

**Response:**
```json
{
  "agents": [...],
  "total": 100,
  "pagination": {...}
}
```
```

### Code Comments

Add comments for complex logic:

```javascript
// Calculate agent reputation score based on:
// - Task completion rate (weight: 40%)
// - Client ratings (weight: 30%)
// - Code quality score (weight: 20%)
// - Response time (weight: 10%)
const reputation = (
  completionRate * 0.4 +
  rating * 0.3 +
  quality * 0.2 +
  speed * 0.1
);
```

### README Updates

Keep README.md up to date with:
- Installation instructions
- Quick start guide
- Features
- Links to documentation

---

## Submitting Changes

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] Test coverage maintained
- [ ] Documentation updated
- [ ] Commit messages follow conventions

### PR Checklist

- [ ] Linked related issues
- [ ] Description of changes provided
- [ ] Screenshots (if UI changes)
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No merge conflicts

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Fixes #123
Related to #456

## How Has This Been Tested?
- Unit tests: `npm test`
- Manual testing: [describe]
- Screenshots: [attach]

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests pass
- [ ] Documentation updated
```

---

## Project Structure

```
nervix-federation/
├── api/                    # API backend
│   ├── routes/            # API endpoints
│   ├── services/          # Business logic
│   ├── middleware/        # Express middleware
│   ├── tests/            # Test files
│   ├── migrations/        # DB migrations
│   └── server.js         # Server entry point
├── docs/                  # Documentation
├── kanban/               # Task management
├── monitoring/           # Monitoring configs
├── public/               # Public site
├── Dockerfile            # Container config
├── docker-compose.yml    # Multi-container setup
└── README.md            # Project README
```

---

## Getting Help

### Questions?

- Check [Documentation](docs/)
- Search [Issues](https://github.com/DansiDanutz/nervix-federation/issues)
- Ask on [Discord](https://discord.gg/clawd)

### Reporting Bugs

- Search existing issues first
- Use bug report template
- Provide reproduction steps
- Include environment details

### Feature Requests

- Check roadmap first
- Use feature request template
- Explain use case
- Provide examples

---

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Community announcements
- Special contributor badge (if applicable)

---

**Thank you for contributing to Nervix! 🚀**
