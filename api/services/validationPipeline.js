/**
 * Code Validation Pipeline
 * Automated code quality and security checks for agent submissions
 *
 * @version 1.0.0
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Validation Types
const ValidationType = {
  LINTING: 'linting',
  TESTING: 'testing',
  SECURITY: 'security',
  PERFORMANCE: 'performance',
  DOCUMENTATION: 'documentation',
};

// Validation Status
const ValidationStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

/**
 * Validation Result
 * @typedef {Object} ValidationResult
 * @property {string} type - Validation type
 * @property {string} status - Validation status
 * @property {number} score - Score (0-100)
 * @property {Array} errors - List of errors
 * @property {Array} warnings - List of warnings
 * @property {string} duration - Duration in ms
 * @property {Object} metadata - Additional metadata
 */

/**
 * Code Validator Base Class
 */
class CodeValidator {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Run validation
   * @param {Object} context - Validation context
   * @returns {Promise<ValidationResult>}
   */
  async validate(context) {
    throw new Error('validate() must be implemented');
  }
}

/**
 * ESLint Validator
 */
class ESLintValidator extends CodeValidator {
  async validate(context) {
    const { projectPath, files } = context;

    const startTime = Date.now();

    try {
      const eslintCmd = `npx eslint ${files.join(' ')} --format json`;
      const output = execSync(eslintCmd, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      const results = JSON.parse(output);
      const errors = [];
      const warnings = [];

      for (const result of results) {
        for (const msg of result.messages) {
          if (msg.severity === 2) {
            errors.push({
              file: result.filePath,
              line: msg.line,
              column: msg.column,
              message: msg.message,
              rule: msg.ruleId,
            });
          } else {
            warnings.push({
              file: result.filePath,
              line: msg.line,
              column: msg.column,
              message: msg.message,
              rule: msg.ruleId,
            });
          }
        }
      }

      const score = Math.max(0, 100 - (errors.length * 5) - (warnings.length));

      return {
        type: ValidationType.LINTING,
        status: errors.length === 0 ? ValidationStatus.PASSED : ValidationStatus.FAILED,
        score,
        errors,
        warnings,
        duration: Date.now() - startTime,
        metadata: {
          filesChecked: results.length,
        },
      };
    } catch (error) {
      return {
        type: ValidationType.LINTING,
        status: ValidationStatus.FAILED,
        score: 0,
        errors: [{ message: error.message }],
        warnings: [],
        duration: Date.now() - startTime,
        metadata: {},
      };
    }
  }
}

/**
 * Jest Testing Validator
 */
class JestValidator extends CodeValidator {
  async validate(context) {
    const { projectPath } = context;

    const startTime = Date.now();

    try {
      const testCmd = 'npx jest --json --coverage --passWithNoTests';
      const output = execSync(testCmd, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      const results = JSON.parse(output);
      const errors = [];

      if (!results.success) {
        for (const [testFile, testResult] of Object.entries(results.testResults)) {
          for (const assertion of testResult.assertionResults) {
            if (assertion.status === 'failed') {
              errors.push({
                test: assertion.fullName,
                file: testFile,
                message: assertion.failureMessages?.[0] || 'Test failed',
              });
            }
          }
        }
      }

      const coverage = results.coverageSummary;
      const coverageScore = coverage ? Math.round(
        (coverage.total.lines.pct + coverage.total.branches.pct + coverage.total.functions.pct + coverage.total.statements.pct) / 4
      ) : 0;

      const score = Math.round((coverageScore + (errors.length === 0 ? 30 : 0)));

      return {
        type: ValidationType.TESTING,
        status: errors.length === 0 ? ValidationStatus.PASSED : ValidationStatus.FAILED,
        score,
        errors,
        warnings: [],
        duration: Date.now() - startTime,
        metadata: {
          testsTotal: results.numTotalTests,
          testsPassed: results.numPassedTests,
          testsFailed: results.numFailedTests,
          coverage: coverage?.total,
        },
      };
    } catch (error) {
      return {
        type: ValidationType.TESTING,
        status: ValidationStatus.FAILED,
        score: 0,
        errors: [{ message: error.message }],
        warnings: [],
        duration: Date.now() - startTime,
        metadata: {},
      };
    }
  }
}

/**
 * Security Validator (using npm audit and semgrep)
 */
class SecurityValidator extends CodeValidator {
  async validate(context) {
    const { projectPath } = context;

    const startTime = Date.now();
    const errors = [];
    const warnings = [];

    // Run npm audit
    try {
      const auditCmd = 'npm audit --json';
      const auditOutput = execSync(auditCmd, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      const audit = JSON.parse(auditOutput);

      if (audit.vulnerabilities) {
        for (const [pkg, vuln] of Object.entries(audit.vulnerabilities)) {
          if (vuln.severity === 'high' || vuln.severity === 'critical') {
            errors.push({
              package: pkg,
              severity: vuln.severity,
              vulnerability: vuln.title,
              patch: vuln.patch?.[0],
            });
          } else {
            warnings.push({
              package: pkg,
              severity: vuln.severity,
              vulnerability: vuln.title,
            });
          }
        }
      }
    } catch (error) {
      // npm audit returns non-zero on vulnerabilities
      try {
        const audit = JSON.parse(error.stdout);
        if (audit.vulnerabilities) {
          for (const [pkg, vuln] of Object.entries(audit.vulnerabilities)) {
            if (vuln.severity === 'high' || vuln.severity === 'critical') {
              errors.push({
                package: pkg,
                severity: vuln.severity,
                vulnerability: vuln.title,
              });
            }
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Run semgrep if available
    try {
      const semgrepCmd = 'semgrep --config auto --json --quiet .';
      const semgrepOutput = execSync(semgrepCmd, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 60000,
      });

      const semgrep = JSON.parse(semgrepOutput);
      if (semgrep.results && semgrep.results.length > 0) {
        for (const result of semgrep.results) {
          if (result.extra?.severity === 'ERROR') {
            errors.push({
              file: result.path,
              line: result.start?.line,
              message: result.message,
              rule: result.check_id,
            });
          } else {
            warnings.push({
              file: result.path,
              line: result.start?.line,
              message: result.message,
              rule: result.check_id,
            });
          }
        }
      }
    } catch (error) {
      // semgrep not installed or failed
    }

    const score = Math.max(0, 100 - (errors.length * 15) - (warnings.length * 5));

    return {
      type: ValidationType.SECURITY,
      status: errors.length === 0 ? ValidationStatus.PASSED : ValidationStatus.FAILED,
      score,
      errors,
      warnings,
      duration: Date.now() - startTime,
      metadata: {
        vulnerabilities: errors.length + warnings.length,
      },
    };
  }
}

/**
 * Validation Pipeline
 */
class ValidationPipeline {
  constructor() {
    this.validators = [
      new ESLintValidator(),
      new JestValidator(),
      new SecurityValidator(),
    ];
  }

  /**
   * Run all validators
   * @param {Object} context - Validation context
   * @returns {Promise<Array<ValidationResult>>}
   */
  async runAll(context) {
    const results = [];

    for (const validator of this.validators) {
      try {
        const result = await validator.validate(context);
        results.push(result);
      } catch (error) {
        results.push({
          type: validator.config?.type || 'unknown',
          status: ValidationStatus.FAILED,
          score: 0,
          errors: [{ message: error.message }],
          warnings: [],
          duration: 0,
          metadata: {},
        });
      }
    }

    return results;
  }

  /**
   * Calculate overall score
   * @param {Array<ValidationResult>} results
   * @returns {Object} Overall metrics
   */
  calculateMetrics(results) {
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const avgScore = Math.round(totalScore / results.length);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
    const passedCount = results.filter(r => r.status === ValidationStatus.PASSED).length;

    return {
      score: avgScore,
      passed: passedCount,
      failed: results.length - passedCount,
      totalErrors,
      totalWarnings,
      status: totalErrors === 0 ? ValidationStatus.PASSED : ValidationStatus.FAILED,
    };
  }

  /**
   * Generate validation report
   * @param {Array<ValidationResult>} results
   * @returns {string} Markdown report
   */
  generateReport(results) {
    const metrics = this.calculateMetrics(results);

    let report = `# Code Validation Report\n\n`;
    report += `**Overall Score:** ${metrics.score}/100\n`;
    report += `**Status:** ${metrics.status === ValidationStatus.PASSED ? '✅ PASSED' : '❌ FAILED'}\n`;
    report += `**Passed:** ${metrics.passed}/${results.length}\n\n`;

    report += `## Summary\n\n`;
    report += `- Total Errors: ${metrics.totalErrors}\n`;
    report += `- Total Warnings: ${metrics.totalWarnings}\n\n`;

    report += `## Details\n\n`;

    for (const result of results) {
      report += `### ${result.type}\n`;
      report += `- **Score:** ${result.score}/100\n`;
      report += `- **Status:** ${result.status}\n`;
      report += `- **Duration:** ${result.duration}ms\n\n`;

      if (result.errors.length > 0) {
        report += `**Errors:**\n`;
        for (const err of result.errors) {
          report += `- ${err.message}\n`;
        }
        report += `\n`;
      }

      if (result.warnings.length > 0) {
        report += `**Warnings:**\n`;
        for (const warn of result.warnings.slice(0, 10)) {
          report += `- ${warn.message}\n`;
        }
        report += `\n`;
      }
    }

    return report;
  }
}

// Singleton instance
const validationPipeline = new ValidationPipeline();

module.exports = {
  ValidationType,
  ValidationStatus,
  CodeValidator,
  ESLintValidator,
  JestValidator,
  SecurityValidator,
  ValidationPipeline,
  validationPipeline,
};
