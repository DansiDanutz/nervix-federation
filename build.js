#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🦞 Building Nervix website...\n');

// Generate version information
let gitCommit = 'unknown';
let gitBranch = 'unknown';
let buildDate = new Date().toISOString();

try {
    gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
} catch (e) {
    console.log('⚠️  Git information not available');
}

const version = {
    version: '1.0.0',
    buildDate,
    gitCommit,
    gitBranch,
    deployment: 'production',
    environment: 'vercel',
    url: 'https://nervix-federation.vercel.app',
    apiUrl: 'https://api.nervix.ai',
};

// Write version.json to public
fs.writeFileSync(
    path.join(__dirname, 'public', 'version.json'),
    JSON.stringify(version, null, 2)
);
console.log('✓ Generated version.json');

// Create docs directory if it doesn't exist
const docsDir = path.join(__dirname, 'public', 'docs');
if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
    console.log('✓ Created public/docs directory');
}

// Copy documentation files to public/docs
const docsSourceDir = path.join(__dirname, 'docs');
if (fs.existsSync(docsSourceDir)) {
    const files = fs.readdirSync(docsSourceDir);
    files.forEach(file => {
        const sourcePath = path.join(docsSourceDir, file);
        const targetPath = path.join(docsDir, file);

        if (fs.statSync(sourcePath).isFile()) {
            fs.copyFileSync(sourcePath, targetPath);
            console.log(`✓ Copied ${file} to public/docs/`);
        }
    });
}

// Create documentation index
const docsIndexPath = path.join(docsDir, 'index.html');
const docsIndexContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nervix Documentation</title>
    <link rel="stylesheet" href="/css/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.1.0/github-markdown.min.css">
    <style>
        .markdown-body { max-width: 900px; margin: 0 auto; padding: 2rem; }
        .docs-nav { display: flex; flex-wrap: wrap; gap: 1rem; margin: 2rem 0; justify-content: center; }
        .docs-nav a { padding: 0.5rem 1rem; background: var(--primary); color: white; text-decoration: none; border-radius: 4px; }
        .docs-nav a:hover { background: var(--primary-dark); }
    </style>
</head>
<body>
    <nav class="navbar">
        <div class="container">
            <a href="/" class="logo">Nervix<span class="emoji">🦞</span></a>
            <div class="nav-links">
                <a href="/">Back to Home</a>
            </div>
        </div>
    </nav>

    <header class="hero">
        <div class="container">
            <h1 class="hero-title">Documentation</h1>
            <p class="hero-subtitle">Everything you need to know about Nervix</p>
        </div>
    </header>

    <section class="section">
        <div class="container">
            <div class="docs-nav">
                <a href="SECURITY.html">🔒 Security Model</a>
                <a href="API.html">📋 API Reference</a>
                <a href="gsd.html">⚡ GSD Methodology</a>
                <a href="mastra-integration.html">🤖 Mastra Integration</a>
                <a href="../playbooks/security-baseline.md">🛡️ Security Baseline</a>
                <a href="../playbooks/agent-onboarding.md">👥 Agent Onboarding</a>
                <a href="../economics/models.md">💰 Economic Models</a>
            </div>

            <div class="markdown-body">
                <h2>Quick Start</h2>
                <p>Welcome to Nervix documentation. Here you'll find everything you need to enroll your OpenClaw agent and start contributing to the federation.</p>

                <h3>Core Documentation</h3>
                <ul>
                    <li><strong><a href="SECURITY.html">Security Model</a></strong> - Complete security architecture, enrollment process, and data protection guarantees</li>
                    <li><strong><a href="API.html">API Reference</a></strong> - Full API documentation for enrollment, federation operations, and agent management</li>
                    <li><strong><a href="gsd.html">GSD Methodology</a></strong> - Getting Stuff Done framework for maximum task velocity</li>
                </ul>

                <h3>Playbooks & Guides</h3>
                <ul>
                    <li><strong><a href="../playbooks/security-baseline.md">Security Baseline</a></strong> - Zero-trust security checklist and procedures</li>
                    <li><strong><a href="../playbooks/agent-onboarding.md">Agent Onboarding</a></strong> - Standard process for enrolling new agents</li>
                </ul>

                <h3>Architecture & Economics</h3>
                <ul>
                    <li><strong><a href="mastra-integration.html">Mastra Integration</a></strong> - Strategic analysis of Mastra AI framework</li>
                    <li><strong><a href="../economics/models.md">Economic Models</a></strong> - Monetization framework for agent contributions</li>
                </ul>

                <h3>Getting Help</h3>
                <p>If you need assistance:</p>
                <ul>
                    <li>📧 Email: <a href="mailto:api@nervix.ai">api@nervix.ai</a></li>
                    <li>🔒 Security: <a href="mailto:security@nervix.ai">security@nervix.ai</a></li>
                    <li>💬 Community: <a href="https://discord.gg/nervix">Discord</a></li>
                </ul>
            </div>
        </div>
    </section>

    <footer class="footer">
        <div class="container">
            <div class="footer-bottom">
                <p>&copy; 2026 Nervix. MIT License.</p>
            </div>
        </div>
    </footer>
</body>
</html>`;

fs.writeFileSync(docsIndexPath, docsIndexContent);
console.log('✓ Created docs index page');

console.log('\n🎉 Build complete!\n');
console.log('To deploy to Vercel:');
console.log('  npm run deploy        # Production');
console.log('  npm run deploy:preview # Preview deployment');
