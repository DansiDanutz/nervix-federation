#!/bin/bash
RESPONSE=$(curl -sf https://nervix.ai/api/trpc/federation.health 2>&1)
if echo "$RESPONSE" | grep -q "healthy"; then
  echo "✅ nervix.ai is healthy"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 0
else
  echo "❌ Health check FAILED"
  echo "$RESPONSE"
  exit 1
fi
