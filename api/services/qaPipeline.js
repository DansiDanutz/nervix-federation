#!/usr/bin/env node

/**
 * Quality Assurance Pipeline
 * Validates agent outputs before accepting results
 *
 * @version 1.0.0
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Configuration
const CONFIG = {
  TEMP_DIR: '/tmp/nervix-qa',
  TIMEOUT_MS: 30000,
  MIN_CODE_QUALITY_SCORE: 70,
  MIN_TEST_COVERAGE: 50,
};

// Quality checks
const QUALITY_CHECKS = {
  syntax: 'Syntax Validation',
  security: 'Security Scan',
  tests: 'Test Execution',
  coverage: 'Coverage Analysis',
  performance: 'Performance Check',
  documentation: 'Documentation Review',
};

// Create temp directory
async function createTempDir() {
  const dir = path.join(CONFIG.TEMP_DIR, crypto.randomBytes(8).toString('hex'));
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

// Clean up temp directory
async function cleanupTempDir(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Failed to cleanup temp dir: ${error.message}`);
  }
}

// Run command with timeout
async function runCommand(command, args, cwd, timeout = CONFIG.TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      process.kill(child.pid, 'SIGKILL');
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    const child = spawn(command, args, {
      cwd,
      stdio: 'pipe',
      env: { ...process.env },
    });

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return;

      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
      }
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

// Check syntax
async function checkSyntax(code, language) {
  console.log('  🔍 Checking syntax...');

  const tempDir = await createTempDir();

  try {
    let extension, checker;

    switch (language) {
      case 'javascript':
      case 'typescript':
        extension = language === 'javascript' ? 'js' : 'ts';
        // Use Node.js to check syntax
        checker = 'node';
        break;
      case 'python':
        extension = 'py';
        checker = 'python';
        break;
      default:
        return {
          passed: true,
          score: 100,
          message: 'Syntax check not supported for this language',
        };
    }

    const filename = `code.${extension}`;
    const filepath = path.join(tempDir, filename);
    await fs.writeFile(filepath, code);

    const args = language === 'javascript' || language === 'typescript'
      ? ['--check', filepath]
      : ['-m', 'py_compile', filepath];

    await runCommand(checker, args, tempDir, 10000);

    return {
      passed: true,
      score: 100,
      message: 'Syntax is valid',
    };
  } catch (error) {
    return {
      passed: false,
      score: 0,
      message: `Syntax error: ${error.message}`,
    };
  } finally {
    await cleanupTempDir(tempDir);
  }
}

// Security scan (basic)
async function checkSecurity(code, language) {
  console.log('  🔒 Running security scan...');

  const securityIssues = [];
  const patterns = [
    { pattern: /eval\s*\(/, severity: 'high', message: 'Use of eval() is dangerous' },
    { pattern: /new\s+Function\s*\(/, severity: 'high', message: 'Dynamic function creation is dangerous' },
    { pattern: /document\.write\s*\(/, severity: 'medium', message: 'document.write() is deprecated and unsafe' },
    { pattern: /innerHTML\s*=/, severity: 'medium', message: 'innerHTML assignment can lead to XSS' },
    { pattern: /process\.env\./, severity: 'low', message: 'Environment variable usage detected' },
    { pattern: /API_KEY|SECRET|PASSWORD/i, severity: 'high', message: 'Potential hardcoded secret detected' },
  ];

  let lineNum = 1;
  for (const line of code.split('\n')) {
    for (const { pattern, severity, message } of patterns) {
      const match = line.match(pattern);
      if (match) {
        securityIssues.push({
          line: lineNum,
          severity,
          message,
          code: line.trim(),
        });
      }
    }
    lineNum++;
  }

  const criticalIssues = securityIssues.filter(i => i.severity === 'high').length;
  const highIssues = securityIssues.filter(i => i.severity === 'high').length;
  const mediumIssues = securityIssues.filter(i => i.severity === 'medium').length;
  const lowIssues = securityIssues.filter(i => i.severity === 'low').length;

  const score = Math.max(0, 100 - (criticalIssues * 30) - (highIssues * 15) - (mediumIssues * 5) - (lowIssues * 1));

  return {
    passed: criticalIssues === 0 && score >= CONFIG.MIN_CODE_QUALITY_SCORE,
    score,
    message: `${securityIssues.length} security issues found`,
    issues: securityIssues,
    breakdown: {
      critical: criticalIssues,
      high: highIssues,
      medium: mediumIssues,
      low: lowIssues,
    },
  };
}

// Check code quality (basic metrics)
async function checkCodeQuality(code, language) {
  console.log('  📊 Analyzing code quality...');

  const lines = code.split('\n');
  const totalLines = lines.length;
  const blankLines = lines.filter(l => l.trim() === '').length;
  const commentLines = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('#') || l.trim().startsWith('*')).length;
  const codeLines = totalLines - blankLines - commentLines;

  // Basic metrics
  const avgLineLength = lines.reduce((sum, line) => sum + line.length, 0) / totalLines;
  const maxLineLength = Math.max(...lines.map(l => l.length));

  // Functions (simple regex)
  const functionPattern = language === 'python'
    ? /def\s+\w+/
    : /function\s+\w+/;
  const functions = code.match(new RegExp(functionPattern, 'g')) || [];
  const functionCount = functions.length;

  // Classes
  const classPattern = language === 'python'
    ? /class\s+\w+/
    : /class\s+\w+/;
  const classes = code.match(new RegExp(classPattern, 'g')) || [];
  const classCount = classes.length;

  // Score calculation
  let score = 100;

  // Penalty for very long lines
  if (maxLineLength > 120) score -= 10;
  if (maxLineLength > 200) score -= 10;

  // Penalty for too many blank lines
  if (blankLines / totalLines > 0.3) score -= 5;

  // Bonus for comments
  const commentRatio = commentLines / codeLines;
  if (commentRatio > 0.1) score += 5;
  if (commentRatio > 0.2) score += 5;

  // Bonus for functions
  if (functionCount > 0) score += 5;

  return {
    passed: score >= CONFIG.MIN_CODE_QUALITY_SCORE,
    score: Math.min(100, score),
    message: `Code quality score: ${Math.min(100, score)}`,
    metrics: {
      total_lines: totalLines,
      code_lines: codeLines,
      comment_lines: commentLines,
      blank_lines: blankLines,
      avg_line_length: Math.round(avgLineLength),
      max_line_length: maxLineLength,
      function_count: functionCount,
      class_count: classCount,
      comment_ratio: commentRatio.toFixed(2),
    },
  };
}

// Run tests
async function checkTests(code, language, testFramework = 'jest') {
  console.log('  🧪 Running tests...');

  const tempDir = await createTempDir();

  try {
    const extension = language === 'javascript' || language === 'typescript'
      ? (language === 'javascript' ? 'js' : 'ts')
      : (language === 'python' ? 'py' : language);

    // Write code file
    const codeFilename = `code.${extension}`;
    const codeFilepath = path.join(tempDir, codeFilename);
    await fs.writeFile(codeFilepath, code);

    // Try to run tests
    let results = {
      passed: false,
      score: 0,
      message: 'Tests not found or not executable',
      total: 0,
      passed_count: 0,
      failed_count: 0,
      coverage: 0,
    };

    // Check for test files
    const testFilePatterns = [
      '*.test.js',
      '*.spec.js',
      'test_*.py',
      '*_test.py',
    ];

    for (const pattern of testFilePatterns) {
      try {
        const testFiles = await fs.readdir(tempDir);
        const testFile = testFiles.find(f => f.endsWith('.test.js') || f.endsWith('.spec.js') || f.startsWith('test_') || f.endsWith('_test.py'));

        if (testFile) {
          // Run tests
          let command, args;
          if (language === 'python') {
            command = 'python';
            args = ['-m', 'pytest', testFile, '--tb=short'];
          } else {
            command = 'npm';
            args = ['test'];
          }

          try {
            const { stdout } = await runCommand(command, args, tempDir, 20000);

            // Parse results (basic parsing)
            if (language === 'python') {
              const match = stdout.match(/(\d+) passed/);
              if (match) {
                results.total = parseInt(match[1]);
                results.passed_count = results.total;
                results.passed = true;
                results.score = 100;
                results.message = `All ${results.total} tests passed`;
              }
            } else {
              const match = stdout.match(/Tests:\s+(\d+)\s+passed/);
              if (match) {
                results.total = parseInt(match[1]);
                results.passed_count = results.total;
                results.passed = true;
                results.score = 100;
                results.message = `All ${results.total} tests passed`;
              }
            }
          } catch (testError) {
            results.message = `Tests failed: ${testError.message}`;
            results.passed = false;
          }

          break;
        }
      } catch (error) {
        // Continue to next pattern
      }
    }

    return results;
  } finally {
    await cleanupTempDir(tempDir);
  }
}

// Check documentation
async function checkDocumentation(code, language) {
  console.log('  📚 Checking documentation...');

  let score = 0;
  let issues = [];

  // Check for comments
  const lines = code.split('\n');
  const commentLines = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('#') || l.trim().startsWith('*')).length;

  if (commentLines > 0) {
    score += 40;
  } else {
    issues.push('No comments found');
  }

  // Check for function documentation
  const functionPattern = language === 'python'
    ? /def\s+\w+.*?:\s*\n\s*"""/g
    : /\/\*\*[\s\S]*?\*\//g;

  const docComments = code.match(functionPattern) || [];
  if (docComments.length > 0) {
    score += 40;
  } else {
    issues.push('No function documentation found');
  }

  // Check for module documentation
  const hasModuleDoc = lines.some(l => l.trim().startsWith('///') || l.trim().startsWith('#') || l.trim().startsWith('/**'));

  if (hasModuleDoc) {
    score += 20;
  } else {
    issues.push('No module documentation found');
  }

  return {
    passed: score >= 50,
    score,
    message: `Documentation score: ${score}`,
    issues,
  };
}

// Main QA function
async function runQualityCheck(task, result) {
  console.log(`\n🔍 Running quality check for task ${task.id}...`);
  console.log('='.repeat(60));

  const checks = [];
  const startTime = Date.now();

  try {
    const code = result.code || result.result?.code;

    if (!code) {
      console.log('❌ No code to check');
      return {
        passed: false,
        score: 0,
        message: 'No code provided',
        checks: [],
        duration: Date.now() - startTime,
      };
    }

    const language = result.language || result.result?.language || 'javascript';

    // Run checks
    const syntaxCheck = await checkSyntax(code, language);
    checks.push({ name: QUALITY_CHECKS.syntax, ...syntaxCheck });

    const securityCheck = await checkSecurity(code, language);
    checks.push({ name: QUALITY_CHECKS.security, ...securityCheck });

    const qualityCheck = await checkCodeQuality(code, language);
    checks.push({ name: QUALITY_CHECKS.performance, ...qualityCheck }); // Using 'performance' label

    const docsCheck = await checkDocumentation(code, language);
    checks.push({ name: QUALITY_CHECKS.documentation, ...docsCheck });

    // Run tests only if available
    if (task.requirements?.tests || result.test_results) {
      const testCheck = await checkTests(code, language);
      checks.push({ name: QUALITY_CHECKS.tests, ...testCheck });
    }

    // Calculate overall score
    const totalScore = checks.reduce((sum, check) => sum + check.score, 0);
    const avgScore = Math.round(totalScore / checks.length);
    const allPassed = checks.every(check => check.passed);

    // Summary
    console.log('\n📊 Quality Check Summary');
    console.log('='.repeat(60));

    checks.forEach(check => {
      const status = check.passed ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${check.score}/100 - ${check.message}`);
    });

    console.log(`\n🎯 Overall Score: ${avgScore}/100`);
    console.log(`Status: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);

    return {
      passed: allPassed,
      score: avgScore,
      message: allPassed ? 'Quality check passed' : 'Quality check failed',
      checks,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error(`❌ Quality check failed: ${error.message}`);
    return {
      passed: false,
      score: 0,
      message: `Quality check error: ${error.message}`,
      checks,
      duration: Date.now() - startTime,
    };
  }
}

// Main function
async function main() {
  console.log('🔍 Nervix Quality Assurance Pipeline');
  console.log('====================================\n');

  // Example: Check a task result
  if (process.argv.length < 4) {
    console.log('Usage: node qa-pipeline.js <task-json> <result-json>');
    console.log('\nExample:');
    console.log('  node qa-pipeline.js task.json result.json');
    process.exit(1);
  }

  const taskFile = process.argv[2];
  const resultFile = process.argv[3];

  try {
    const task = JSON.parse(await fs.readFile(taskFile, 'utf8'));
    const result = JSON.parse(await fs.readFile(resultFile, 'utf8'));

    const qaResult = await runQualityCheck(task, result);

    // Save QA result
    const outputFile = path.join(path.dirname(resultFile), 'qa-result.json');
    await fs.writeFile(outputFile, JSON.stringify(qaResult, null, 2));
    console.log(`\n💾 QA result saved to: ${outputFile}`);

    process.exit(qaResult.passed ? 0 : 1);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = {
  runQualityCheck,
  checkSyntax,
  checkSecurity,
  checkCodeQuality,
  checkTests,
  checkDocumentation,
};
