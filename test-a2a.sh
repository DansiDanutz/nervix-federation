#!/bin/bash

# Test script for A2A Protocol Endpoint
# Tests both discovery and method calls

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
AGENT_ID="${AGENT_ID:-test_agent_001}"

echo "🔬 Testing Nervix A2A Protocol Endpoint"
echo "========================================"
echo ""

# Test 1: Discovery Endpoint
echo "📡 Test 1: GET /a2a (Discovery)"
echo "-----------------------------------"
curl -s -X GET "${BASE_URL}/a2a" | jq '.'

echo ""
echo "========================================"
echo ""

# Test 2: tasks/get (should fail without valid task)
echo "📦 Test 2: POST /a2a - tasks/get (invalid task)"
echo "-----------------------------------"
curl -s -X POST "${BASE_URL}/a2a" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "method": "tasks/get",
    "params": {
      "taskId": "invalid_task_id"
    },
    "id": "test_001"
  }' | jq '.'

echo ""
echo "========================================"
echo ""

# Test 3: tasks/pushNotification
echo "🔔 Test 3: POST /a2a - tasks/pushNotification"
echo "-----------------------------------"
curl -s -X POST "${BASE_URL}/a2a" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "method": "tasks/pushNotification",
    "params": {
      "toAgentId": "'${AGENT_ID}'",
      "notification": {
        "title": "Test Notification",
        "message": "This is a test notification from A2A endpoint",
        "priority": "info"
      }
    },
    "id": "test_002"
  }' | jq '.'

echo ""
echo "========================================"
echo ""

# Test 4: Invalid method
echo "❌ Test 4: POST /a2a - Invalid method"
echo "-----------------------------------"
curl -s -X POST "${BASE_URL}/a2a" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0",
    "method": "invalid_method",
    "params": {},
    "id": "test_003"
  }' | jq '.'

echo ""
echo "========================================"
echo "✅ All A2A tests completed!"
