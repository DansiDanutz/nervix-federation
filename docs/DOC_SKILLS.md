# 📝 Doc Skills Guide - Creating Clear, Comprehensive Documentation

> **For:** Doc Bot (Memo - Documentation, Research, Memory)
> **Purpose:** Master technical documentation, research methods, and knowledge management
> **Created:** 2026-02-19

---

## 🚀 Documentation Philosophy

**Goal:** Create documentation that is clear, comprehensive, and empowering.

**Core Principles:**
1. **Clarity Over Jargon** - Write for the reader, not for experts
2. **Structure Matters** - Organize information logically
3. **Examples Teach** - Show, don't just tell
4. **Keep It Current** - Documentation must stay in sync with code
5. **Accessibility First** - Documentation should be findable and readable

---

## 🛠️ Essential Documentation Skills

### Skill 1: Technical Documentation

**What It Is:**
Creating clear, accurate documentation for technical systems.

**Key Techniques:**

1. **Document Types**
   - **README** - Project overview, setup, quick start
   - **API Docs** - Endpoints, parameters, examples
   - **Architecture Docs** - System design, components, patterns
   - **Tutorials** - Step-by-step guides
   - **Troubleshooting** - Common issues and solutions
   - **Changelog** - Version history and changes

2. **Documentation Structure**
   - Use consistent sections (Overview, Installation, Usage, API, Contributing)
   - Start with purpose (what is this?)
   - Include prerequisites (what do I need?)
   - Provide quick start (get running in 5 minutes)
   - Deep dive sections for advanced topics

3. **Writing Style**
   - Use active voice ("Create a file" not "A file should be created")
   - Be concise (short paragraphs, bullet points)
   - Use examples (code snippets, screenshots)
   - Avoid jargon (or explain it)
   - Write for the beginner, reference for the expert

4. **Markdown Mastery**
   - Headers (h1-h6) for structure
   - Code blocks with syntax highlighting
   - Lists (ordered, unordered) for steps
   - Tables for reference data
   - Links for navigation
   - Images for diagrams/screenshots

**Practice Exercise:**
```markdown
# Project Name

A brief description of what this project does.

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Run tests
npm test
```

## Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Step 1: Clone the repository

```bash
git clone https://github.com/username/project.git
cd project
```

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Configure environment

Create a `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/db
JWT_SECRET=your-secret-key
```

## Usage

### Basic Example

```javascript
import { Client } from './client';

const client = new Client();

// Do something
client.connect();
```

## API Reference

### GET /api/items

Get all items.

**Response:**

```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Item 1" },
    { "id": 2, "name": "Item 2" }
  ]
}
```

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md).

## License

MIT
```

---

### Skill 2: API Documentation

**What It Is:**
Creating comprehensive, developer-friendly API documentation.

**Key Techniques:**

1. **OpenAPI/Swagger Specification**
   - Define endpoints, parameters, responses
   - Include authentication requirements
   - Provide examples for each endpoint
   - Document error responses

2. **Endpoint Documentation**
   - HTTP method (GET, POST, PUT, DELETE)
   - URL path and parameters
   - Request body format
   - Response format
   - Status codes (200, 400, 401, 404, 500)
   - Rate limits
   - Authentication requirements

3. **Examples**
   - Request examples (curl, JavaScript, Python)
   - Response examples (successful, error)
   - Common use cases
   - Edge cases

4. **Best Practices**
   - Keep it up to date with code
   - Use automated tools (Swagger UI)
   - Include code snippets
   - Test all examples
   - Document all error codes

**Practice Exercise:**
```yaml
# openapi.yaml
openapi: 3.0.0
info:
  title: Nervix API
  version: 1.0.0
  description: API for the Nervix agent federation

servers:
  - url: https://api.nervix.dev
    description: Production server
  - url: https://api.nervix.staging
    description: Staging server

paths:
  /api/agents:
    get:
      summary: List all agents
      tags: [Agents]
      security:
        - bearerAuth: []
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 10
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Agent'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    post:
      summary: Create a new agent
      tags: [Agents]
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateAgentRequest'
      responses:
        '201':
          description: Agent created
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    $ref: '#/components/schemas/Agent'

components:
  schemas:
    Agent:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        publicKey:
          type: string
        capabilities:
          type: array
          items:
            type: string
        createdAt:
          type: string
          format: date-time

    CreateAgentRequest:
      type: object
      required: [name, publicKey]
      properties:
        name:
          type: string
          minLength: 3
          maxLength: 100
        publicKey:
          type: string
        capabilities:
          type: array
          items:
            type: string

    Error:
      type: object
      properties:
        success:
          type: boolean
          enum: [false]
        error:
          type: string

securitySchemes:
  bearerAuth:
    type: http
    scheme: bearer
    bearerFormat: JWT
```

---

### Skill 3: Research Methods

**What It Is:**
Finding, verifying, and synthesizing information from multiple sources.

**Key Techniques:**

1. **Source Evaluation**
   - Check author credibility (qualifications, affiliations)
   - Verify publication date (is it current?)
   - Cross-reference multiple sources
   - Identify bias (is there an agenda?)
   - Check for peer review (academic sources)

2. **Search Strategies**
   - Use specific keywords (not too broad, not too narrow)
   - Use boolean operators (AND, OR, NOT)
   - Use quotes for exact phrases
   - Use site: for specific websites
   - Use filetype: for specific file types

3. **Information Synthesis**
   - Organize by theme/topic
   - Identify patterns and connections
   - Note contradictions and disputes
   - Distinguish fact from opinion
   - Credit sources properly

4. **Note-Taking Systems**
   - Zettelkasten (slipbox method)
   - PARA method (Projects, Areas, Resources, Archives)
   - Atomic notes (one idea per note)
   - Link notes together
   - Add context and tags

**Practice Exercise:**
```markdown
# Research: Ed25519 Cryptography

## Sources

1. [Ed25519: High-speed high-security signatures](https://ed25519.cr.yp.to/)
   - Author: Daniel J. Bernstein, et al.
   - Date: 2011
   - Type: Academic paper
   - Credibility: High (peer-reviewed)

2. [Noble - Ed25519 Implementation](https://github.com/paulmillr/noble-ed25519)
   - Author: Paul Miller
   - Date: 2023
   - Type: Code library
   - Credibility: High (widely used)

3. [Wikipedia: EdDSA](https://en.wikipedia.org/wiki/EdDSA)
   - Date: 2024
   - Type: Encyclopedia
   - Credibility: Medium (general overview)

## Key Findings

### What is Ed25519?
- Elliptic curve signature scheme
- Based on twisted Edwards curves
- Faster than ECDSA
- Smaller signatures (64 bytes)
- Smaller public keys (32 bytes)

### Advantages
- Performance: ~10x faster than ECDSA
- Security: Proven under standard assumptions
- Deterministic: No randomness required
- Simplicity: Easy to implement correctly

### Use Cases
- SSH keys
- JWT signing
- Agent identity (Nervix use case)
- Cryptocurrency signatures

## Notes for Nervix

Ed25519 is perfect for agent identity:
- Fast signature generation/verification
- Small keys/ signatures (bandwidth-efficient)
- No side-channel attacks (deterministic)
- Widely supported libraries

## References

- Bernstein, D. J., et al. (2011). Ed25519: High-speed high-security signatures.
- Paul Miller. (2023). noble-ed25519: Fastest JS Ed25519 implementation.
```

---

### Skill 4: Memory Curation

**What It Is:**
Organizing, tagging, and retrieving knowledge effectively.

**Key Techniques:**

1. **Knowledge Organization**
   - **Taxonomy** - Hierarchical structure (categories → subcategories)
   - **Folksonomy** - Tagging system (user-defined tags)
   - **Chronological** - Time-based (daily notes, weekly reviews)
   - **Network** - Linked notes (wiki-style)

2. **Tagging Strategy**
   - Use consistent tags (#design, #dev, #doc)
   - Tag by topic, not by format
   - Limit tag count (3-5 tags per item)
   - Create tag hierarchies (#dev/backend, #dev/frontend)
   - Review tags periodically

3. **Note-Taking Formats**
   - **Daily Notes** - Raw logs, scratchpad
   - **Project Notes** - Project-specific knowledge
   - **Reference Notes** - Evergreen knowledge
   - **Decision Records** - Architecture decisions with rationale
   - **Meeting Notes** - Action items, decisions

4. **Retrieval Systems**
   - Full-text search (grep, ripgrep)
   - Tag filtering
   - Linked notes (backlinks)
   - Date-based search
   - AI-assisted retrieval (RAG)

**Practice Exercise:**
```markdown
# Memory System Structure

## /daily
/daily/2026-02-19.md
/daily/2026-02-20.md

## /projects
/projects/nervix/architecture.md
/projects/nervix/api-design.md
/projects/nervix/security.md

## /knowledge
/knowledge/cryptography/ed25519.md
/knowledge/cryptography/jwt.md
/knowledge/design/typography.md
/knowledge/design/color-theory.md

## /decisions
/decisions/001-use-ed25519.md
/decisions/002-choose-prisma.md
/decisions/003-vercel-deployment.md

## /team
/team/dexter/skills.md
/team/sienna/skills.md
/team/memo/skills.md

## /reference
/reference/api/openapi.yaml
/reference/api/endpoints.md
/reference/database/schema.prisma
```

```markdown
# Note Template

# [Topic]

## Context
Why this exists, what problem it solves.

## Content
Main information, code, examples.

## Related
- [[Related Note 1]]
- [[Related Note 2]]

## Tags
#tag1 #tag2 #tag3

## Date
2026-02-19

## Sources
- [Source 1](url)
- [Source 2](url)
```

---

### Skill 5: Tutorials & Guides

**What It Is:**
Creating step-by-step learning materials.

**Key Techniques:**

1. **Tutorial Structure**
   - **What You'll Learn** - Learning objectives
   - **Prerequisites** - What you need before starting
   - **Time Estimate** - How long it will take
   - **Step-by-Step Instructions** - Clear, numbered steps
   - **Troubleshooting** - Common issues and solutions
   - **Next Steps** - Where to go from here

2. **Writing Style**
   - Assume the reader is smart but new to the topic
   - Explain why, not just how
   - Provide complete examples (no "..."
   - Test all steps before publishing
   - Include screenshots/diagrams

3. **Code Examples**
   - Complete, runnable code
   - Comments explaining what's happening
   - Multiple examples (simple, intermediate, advanced)
   - Common mistakes to avoid

4. **Interactive Elements**
   - Quizzes to test understanding
   - Exercises to practice
   - Challenges to extend learning
   - Discussion questions

**Practice Exercise:**
```markdown
# Tutorial: Build Your First REST API with Express

## What You'll Learn

In this tutorial, you'll build a simple REST API using Express.js. You'll learn:

- Setting up an Express server
- Creating RESTful endpoints
- Handling JSON data
- Error handling

**Time Estimate:** 30 minutes

**Prerequisites:**
- Node.js 18+ installed
- Basic JavaScript knowledge

## Step 1: Initialize Your Project

Create a new directory and initialize your project:

```bash
mkdir my-api
cd my-api
npm init -y
```

This creates a `package.json` file with default settings.

## Step 2: Install Express

Install Express as a dependency:

```bash
npm install express
```

## Step 3: Create the Server

Create a file named `server.js`:

```javascript
const express = require('express');
const app = express();

// Middleware to parse JSON
app.use(express.json());

// Routes
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello, World!' });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

## Step 4: Run Your Server

```bash
node server.js
```

You should see: `Server running on http://localhost:3000`

## Step 5: Test Your API

Open a new terminal and test with curl:

```bash
curl http://localhost:3000/api/hello
```

Expected output:

```json
{"message":"Hello, World!"}
```

## Troubleshooting

**Port already in use?**
Change the PORT variable to 3001 or another available port.

**Module not found?**
Make sure you ran `npm install express` in the project directory.

## Next Steps

- Add more endpoints (POST, PUT, DELETE)
- Add a database (PostgreSQL, MongoDB)
- Add authentication (JWT)

## Challenge

Try creating an endpoint that accepts JSON data and returns it:

```javascript
app.post('/api/echo', (req, res) => {
  res.json(req.body);
});
```

Test it:

```bash
curl -X POST http://localhost:3000/api/echo \
  -H "Content-Type: application/json" \
  -d '{"name": "Dexter"}'
```
```

---

### Skill 6: Quality Assurance

**What It Is:**
Ensuring documentation is accurate, complete, and up to date.

**Key Techniques:**

1. **Accuracy Checks**
   - Test all code examples
   - Verify all links work
   - Check version numbers
   - Cross-reference with source code
   - Verify with subject matter experts

2. **Completeness Review**
   - Does it cover all features?
   - Are prerequisites listed?
   - Are edge cases addressed?
   - Is troubleshooting included?
   - Are examples comprehensive?

3. **Usability Testing**
   - Can a beginner follow it?
   - Is it easy to navigate?
   - Is the information findable?
   - Are examples clear?
   - Is the language accessible?

4. **Maintenance**
   - Review documentation monthly
   - Update when code changes
   - Track outdated sections
   - Remove deprecated information
   - Schedule periodic audits

**Practice Exercise:**
```markdown
# Documentation Review Checklist

## Before Publishing

### Content
- [ ] All code examples tested
- [ ] All links verified
- [ ] Version numbers checked
- [ ] Prerequisites listed
- [ ] Troubleshooting included

### Structure
- [ ] Logical organization
- [ ] Consistent formatting
- [ ] Clear headings
- [ ] Tables of contents
- [ ] Cross-references

### Clarity
- [ ] Jargon explained
- [ ] Active voice used
- [ ] Concise paragraphs
- [ ] Examples provided
- [ ] Steps are numbered

### Accessibility
- [ ] Alt text for images
- [ ] Descriptive link text
- [ ] Clear contrast
- [ ] Readable fonts
- [ ] Mobile-friendly

## Maintenance

### Weekly
- [ ] Check for broken links
- [ ] Review recent changes
- [ ] Update as needed

### Monthly
- [ ] Full content review
- [ ] Test all examples
- [ ] Update outdated sections
- [ ] Archive deprecated info

### Quarterly
- [ ] Complete documentation audit
- [ ] Update style guide
- [ ] Gather user feedback
- [ ] Plan improvements
```

---

## 📚 Documentation Tools

### Writing Tools
- **Markdown** - Lightweight markup language
- **Obsidian** - Knowledge base with linking
- **Notion** - Collaborative documentation
- **Docusaurus** - Static site generator
- **GitBook** - Documentation hosting

### API Documentation
- **Swagger/OpenAPI** - API specification
- **Redoc** - Beautiful API docs
- **Postman** - API testing & documentation
- **Insomnia** - API client

### Diagrams
- **Mermaid** - Text-to-diagram
- **Draw.io** - Free diagramming tool
- **Excalidraw** - Hand-drawn style
- **Figma** - Professional design tool

### Quality Tools
- **Markdownlint** - Linter for Markdown
- **Alex.js** - Inclusive language checker
- **LinkChecker** - Find broken links
- **Vale** - Prose linting

---

## 📋 Documentation Checklist

Before considering documentation "complete":

**Content:**
- [ ] Purpose clearly stated
- [ ] Prerequisites listed
- [ ] Steps are complete
- [ ] Examples are provided
- [ ] Troubleshooting included

**Accuracy:**
- [ ] All code tested
- [ ] All links work
- [ ] Version numbers verified
- [ ] No outdated information
- [ ] Facts are correct

**Structure:**
- [ ] Logical organization
- [ ] Consistent formatting
- [ ] Clear headings
- [ ] Table of contents
- [ ] Cross-references

**Clarity:**
- [ ] Jargon explained
- [ ] Active voice
- [ ] Concise paragraphs
- [ ] Examples illustrate concepts
- [ ] Language is accessible

**Accessibility:**
- [ ] Alt text for images
- [ ] Descriptive link text
- [ ] Clear contrast
- [ ] Readable fonts
- [ ] Mobile-friendly

---

## 🎓 Learning Path

### Week 1: Foundations
- Day 1-2: Technical Documentation
- Day 3-4: API Documentation
- Day 5-6: Research Methods
- Day 7: Practice & Portfolio

### Week 2: Advanced
- Day 1-2: Memory Curation
- Day 3-4: Tutorials & Guides
- Day 5-6: Quality Assurance
- Day 7: Practice & Portfolio

### Week 3: Systems
- Day 1-3: Knowledge Management Systems
- Day 4-5: Documentation Automation
- Day 6-7: Content Strategy

### Week 4: Specialization
- Day 1-2: Open Source Documentation
- Day 3-4: API Documentation Strategy
- Day 5-6: Developer Experience
- Day 7: Final Project

---

## 💡 Pro Tips

1. **Write for the Reader** - Not for yourself
2. **Show, Don't Tell** - Examples beat explanations
3. **Keep It Short** - Less is more
4. **Update Regularly** - Outdated docs are worse than no docs
5. **Get Feedback** - Ask users if docs helped
6. **Use Tools** - Automate where possible
7. **Be Consistent** - Follow a style guide
8. **Test Everything** - Verify all examples

---

## 🚀 Next Steps for Memo

1. **Master the Basics** (Week 1)
   - Technical documentation
   - API documentation
   - Research methods

2. **Build Systems** (Week 2)
   - Reputation System documentation
   - Quality Engine documentation
   - Knowledge base structure

3. **Learn Advanced** (Week 3)
   - Knowledge management systems
   - Documentation automation
   - Content strategy

4. **Specialize** (Week 4)
   - Open source documentation
   - API documentation strategy
   - Developer experience

---

**Memo 📝 - Documentation Extraordinaire**

*Created: 2026-02-19*
*Updated by: Nano (Operations Lead)*
*Status: Ready for Memo to start learning*

---

**Remember:** Great documentation is not just words. It's empowerment. It's making complex things simple. It's saving people time. It's building trust. Every word matters. Every example matters. Every reader matters. Write to help. 📝✨
