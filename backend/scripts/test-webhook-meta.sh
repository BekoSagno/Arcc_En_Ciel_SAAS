#!/bin/bash

# Script de test pour simuler un webhook Meta Messenger
# Usage: ./test-webhook-meta.sh

BACKEND_URL="${BACKEND_URL:-http://localhost:4000}"
PAGE_ID="${PAGE_ID:-123456789012345}"
SENDER_ID="${SENDER_ID:-987654321098765}"
MESSAGE="${MESSAGE:-Bonjour, combien coûte un bureau Open Space isolé ?}"

echo "🧪 Test webhook Meta Messenger"
echo "Backend: $BACKEND_URL"
echo "Page ID: $PAGE_ID"
echo "Sender ID: $SENDER_ID"
echo "Message: $MESSAGE"
echo ""

# Note: En développement, la signature sera invalide
# Vous pouvez temporairement désactiver la vérification dans webhooks.js

curl -X POST "$BACKEND_URL/api/webhooks/facebook" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: test-signature" \
  -d "{
    \"object\": \"page\",
    \"entry\": [
      {
        \"id\": \"$PAGE_ID\",
        \"time\": $(date +%s)000,
        \"messaging\": [
          {
            \"sender\": {
              \"id\": \"$SENDER_ID\"
            },
            \"recipient\": {
              \"id\": \"$PAGE_ID\"
            },
            \"timestamp\": $(date +%s)000,
            \"message\": {
              \"mid\": \"m_$(date +%s)\",
              \"text\": \"$MESSAGE\"
            }
          }
        ]
      }
    ]
  }"

echo ""
echo "✅ Requête envoyée. Vérifiez les logs du backend et du worker."
