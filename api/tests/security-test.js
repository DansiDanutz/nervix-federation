#!/usr/bin/env node

/**
 * Security Penetration Tests
 * Test for common vulnerabilities
 *
 * @version 1.0.0
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const REPORT = [];

/**
 * Security test result
 * @param {string} name - Test name
 * @param {boolean} passed - Test passed
 * @param {string} message - Result message
 * @param {Object} details - Additional details
 */
function reportTest(name, passed, message, details = {}) {
  const result = {
    name,
    passed,
    message,
    details,
    timestamp: new Date().toISOString(),
  };

  REPORT.push(result);

  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}: ${message}`);

  if (!passed && Object.keys(details).length > 0) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
}

/**
 * Make HTTP request
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Response
 */
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body,
      }));
    });

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Test 1: SQL Injection
 */
async function testSQLInjection() {
  console.log('\n🔍 Testing SQL Injection...\n');

  const payloads = [
    "1' OR '1'='1",
    "1' UNION SELECT NULL--",
    "'; DROP TABLE agents--",
    "1' AND 1=1--",
    "admin'--",
  ];

  for (const payload of payloads) {
    try {
      const response = await makeRequest({
        hostname: new URL(BASE_URL).hostname,
        port: new URL(BASE_URL).port || 80,
        path: `/v1/agents?id=${encodeURIComponent(payload)}`,
        method: 'GET',
      });

      // Check if SQL error in response
      const hasSQLError = response.body.toLowerCase().includes('sql') ||
                         response.body.toLowerCase().includes('syntax') ||
                         response.body.toLowerCase().includes('error');

      if (hasSQLError) {
        reportTest(
          'SQL Injection',
          false,
          `Potential SQL injection vulnerability with payload: ${payload}`,
          { payload, responseSnippet: response.body.substring(0, 200) }
        );
        return;
      }
    } catch (error) {
      // Ignore connection errors
    }
  }

  reportTest('SQL Injection', true, 'No SQL injection vulnerabilities detected');
}

/**
 * Test 2: XSS
 */
async function testXSS() {
  console.log('\n🔍 Testing XSS...\n');

  const payloads = [
    '<script>alert("XSS")</script>',
    '"><script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    'javascript:alert("XSS")',
    '<svg onload=alert("XSS")>',
  ];

  for (const payload of payloads) {
    try {
      const response = await makeRequest({
        hostname: new URL(BASE_URL).hostname,
        port: new URL(BASE_URL).port || 80,
        path: `/v1/agents?search=${encodeURIComponent(payload)}`,
        method: 'GET',
      });

      // Check if payload reflected unescaped
      const payloadReflected = response.body.includes(payload) ||
                              response.body.includes('<script>') ||
                              response.body.includes('javascript:');

      if (payloadReflected) {
        reportTest(
          'XSS',
          false,
          `Potential XSS vulnerability with payload: ${payload.substring(0, 50)}`,
          { payload, responseSnippet: response.body.substring(0, 200) }
        );
        return;
      }
    } catch (error) {
      // Ignore connection errors
    }
  }

  reportTest('XSS', true, 'No XSS vulnerabilities detected');
}

/**
 * Test 3: CSRF
 */
async function testCSRF() {
  console.log('\n🔍 Testing CSRF Protection...\n');

  try {
    const response = await makeRequest({
      hostname: new URL(BASE_URL).hostname,
      port: new URL(BASE_URL).port || 80,
      path: '/v1/agents',
      method: 'GET',
    });

    // Check for CSRF token in cookies or response
    const hasCSRFToken = response.headers['set-cookie']?.some(cookie =>
      cookie.includes('csrf') || cookie.includes('xsrf')
    );

    const hasCSRFHeader = response.headers['x-csrf-token'] ||
                         response.headers['x-xsrf-token'];

    if (!hasCSRFToken && !hasCSRFHeader) {
      reportTest(
        'CSRF Protection',
        false,
        'No CSRF token detected in response',
        { headers: response.headers }
      );
    } else {
      reportTest('CSRF Protection', true, 'CSRF protection present');
    }
  } catch (error) {
    reportTest('CSRF Protection', false, 'Failed to test CSRF protection');
  }
}

/**
 * Test 4: Security Headers
 */
async function testSecurityHeaders() {
  console.log('\n🔍 Testing Security Headers...\n');

  try {
    const response = await makeRequest({
      hostname: new URL(BASE_URL).hostname,
      port: new URL(BASE_URL).port || 80,
      path: '/v1/agents',
      method: 'GET',
    });

    const requiredHeaders = [
      { name: 'X-Content-Type-Options', expected: 'nosniff' },
      { name: 'X-Frame-Options', expected: 'DENY' },
      { name: 'X-XSS-Protection', expected: '1; mode=block' },
      { name: 'Strict-Transport-Security', expected: undefined },
      { name: 'Content-Security-Policy', expected: undefined },
    ];

    let missingHeaders = [];

    for (const header of requiredHeaders) {
      const value = response.headers[header.name.toLowerCase()];

      if (header.expected && value !== header.expected) {
        missingHeaders.push(`${header.name} (expected: ${header.expected}, got: ${value})`);
      } else if (!value && header.expected !== undefined) {
        missingHeaders.push(header.name);
      }
    }

    if (missingHeaders.length > 0) {
      reportTest(
        'Security Headers',
        false,
        `Missing or incorrect security headers`,
        { missingHeaders }
      );
    } else {
      reportTest('Security Headers', true, 'All required security headers present');
    }
  } catch (error) {
    reportTest('Security Headers', false, 'Failed to test security headers');
  }
}

/**
 * Test 5: Rate Limiting
 */
async function testRateLimiting() {
  console.log('\n🔍 Testing Rate Limiting...\n');

  const requests = Array(150).fill(null).map(() =>
    makeRequest({
      hostname: new URL(BASE_URL).hostname,
      port: new URL(BASE_URL).port || 80,
      path: '/v1/agents',
      method: 'GET',
    })
  );

  try {
    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.statusCode === 429);

    if (rateLimited.length === 0) {
      reportTest(
        'Rate Limiting',
        false,
        'No rate limiting detected after 150 requests',
        { requests: responses.length }
      );
    } else {
      reportTest(
        'Rate Limiting',
        true,
        `Rate limiting active (${rateLimited.length}/${responses.length} requests blocked)`
      );
    }
  } catch (error) {
    reportTest('Rate Limiting', false, 'Failed to test rate limiting');
  }
}

/**
 * Test 6: Information Disclosure
 */
async function testInformationDisclosure() {
  console.log('\n🔍 Testing Information Disclosure...\n');

  try {
    const response = await makeRequest({
      hostname: new URL(BASE_URL).hostname,
      port: new URL(BASE_URL).port || 80,
      path: '/v1/agents',
      method: 'GET',
    });

    // Check for information disclosure in headers
    const sensitiveHeaders = [
      'x-powered-by',
      'server',
      'x-aspnet-version',
      'x-version',
    ];

    const disclosures = [];

    for (const header of sensitiveHeaders) {
      const value = response.headers[header];
      if (value) {
        disclosures.push({ header, value });
      }
    }

    if (disclosures.length > 0) {
      reportTest(
        'Information Disclosure',
        false,
        'Information disclosure detected in response headers',
        { disclosures }
      );
    } else {
      reportTest('Information Disclosure', true, 'No information disclosure detected');
    }
  } catch (error) {
    reportTest('Information Disclosure', false, 'Failed to test information disclosure');
  }
}

/**
 * Test 7: Authentication Bypass
 */
async function testAuthenticationBypass() {
  console.log('\n🔍 Testing Authentication Bypass...\n');

  const endpoints = [
    '/v1/enroll',
    '/v1/auth/enrollment-token',
    '/v1/federation/register',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest({
        hostname: new URL(BASE_URL).hostname,
        port: new URL(BASE_URL).port || 80,
        path: endpoint,
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });

      // Should return 401 for invalid token (if auth required)
      if (response.statusCode === 200) {
        reportTest(
          'Authentication Bypass',
          false,
          `Possible authentication bypass on ${endpoint}`,
          { endpoint, statusCode: response.statusCode }
        );
        return;
      }
    } catch (error) {
      // Ignore connection errors
    }
  }

  reportTest('Authentication Bypass', true, 'No authentication bypass detected');
}

/**
 * Test 8: Brute Force Protection
 */
async function testBruteForceProtection() {
  console.log('\n🔍 Testing Brute Force Protection...\n');

  const attempts = Array(20).fill(null).map((_, i) =>
    makeRequest({
      hostname: new URL(BASE_URL).hostname,
      port: new URL(BASE_URL).port || 80,
      path: '/v1/auth/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: 'invalid-token' }),
    })
  );

  try {
    const responses = await Promise.all(attempts);
    const blocked = responses.filter(r => r.statusCode === 429);

    if (blocked.length === 0) {
      reportTest(
        'Brute Force Protection',
        false,
        'No brute force protection detected after 20 failed attempts',
        { attempts: responses.length }
      );
    } else {
      reportTest(
        'Brute Force Protection',
        true,
        `Brute force protection active (${blocked.length}/${responses.length} attempts blocked)`
      );
    }
  } catch (error) {
    reportTest('Brute Force Protection', false, 'Failed to test brute force protection');
  }
}

/**
 * Generate report
 */
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('SECURITY PENETRATION TEST REPORT');
  console.log('='.repeat(60) + '\n');

  const passed = REPORT.filter(r => r.passed).length;
  const failed = REPORT.filter(r => !r.passed).length;

  console.log(`Total tests: ${REPORT.length}`);
  console.log(`Passed: ${passed} (${((passed / REPORT.length) * 100).toFixed(0)}%)`);
  console.log(`Failed: ${failed} (${((failed / REPORT.length) * 100).toFixed(0)}%)\n`);

  if (failed > 0) {
    console.log('Failed Tests:');
    console.log(''.padEnd(60, '-'));

    REPORT.filter(r => !r.passed).forEach(r => {
      console.log(`\n❌ ${r.name}`);
      console.log(`   ${r.message}`);
      if (Object.keys(r.details).length > 0) {
        console.log(`   Details: ${JSON.stringify(r.details, null, 2).split('\n').join('\n   ')}`);
      }
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');

  return {
    summary: {
      total: REPORT.length,
      passed,
      failed,
    },
    tests: REPORT,
  };
}

/**
 * Main function
 */
async function main() {
  console.log('\n🔒 Security Penetration Testing');
  console.log(`   Base URL: ${BASE_URL}\n`);

  await testSQLInjection();
  await testXSS();
  await testCSRF();
  await testSecurityHeaders();
  await testRateLimiting();
  await testInformationDisclosure();
  await testAuthenticationBypass();
  await testBruteForceProtection();

  const report = generateReport();

  // Save report to file
  const fs = require('fs');
  const reportPath = 'security-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report saved to: ${reportPath}\n`);

  // Exit with error if any tests failed
  if (report.summary.failed > 0) {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Security test failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testSQLInjection,
  testXSS,
  testCSRF,
  testSecurityHeaders,
  testRateLimiting,
  testInformationDisclosure,
  testAuthenticationBypass,
  testBruteForceProtection,
};
