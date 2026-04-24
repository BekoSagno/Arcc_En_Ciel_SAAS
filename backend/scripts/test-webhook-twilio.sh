#!/bin/bash

# Script de test pour simuler un webhook Twilio WhatsApp
# Usage: ./test-webhook-twilio.sh

BACKEND_URL="${BACKEND_URL:-http://localhost:4000}"
TO_NUMBER="${TO_NUMBER:-whatsapp:+14155238886}"
FROM_NUMBER="${FROM_NUMBER:-whatsapp:+1234567890}"
MESSAGE="${MESSAGE:-Bonjour, combien coûte un bureau Open Space isolé ?}"

echo "🧪 Test webhook Twilio WhatsApp"
echo "Backend: $BACKEND_URL"
echo "To: $TO_NUMBER"
echo "From: $FROM_NUMBER"
echo "Message: $MESSAGE"
echo ""

# Note: En développement, la signature sera invalide
# Vous pouvez temporairement désactiver la vérification dans webhooks.js

curl -X POST "$BACKEND_URL/api/webhooks/whatsapp" \
  -H "Content-Type: application/json" \
  -H "X-Twilio-Signature: test-signature" \
  -d "{
    \"MessageSid\": \"SM$(date +%s)\",
    \"AccountSid\": \"AC1234567890\",
    \"From\": \"$FROM_NUMBER\",
    \"To\": \"$TO_NUMBER\",
    \"Body\": \"$MESSAGE\",
    \"MessageStatus\": \"received\"
  }"

echo ""
echo "✅ Requête envoyée. Vérifiez les logs du backend et du worker."
