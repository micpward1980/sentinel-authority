#!/bin/bash
# Sentinel Authority — Full Flow Smoke Test
set -e
BASE="https://sentinel-authority-production.up.railway.app"
PASS=0; FAIL=0

green() { echo "  ✅ $1"; PASS=$((PASS+1)); }
red()   { echo "  ❌ $1"; FAIL=$((FAIL+1)); }
section() { echo ""; echo "=== $1 ==="; }

auth() {
  TOKEN=$(curl -s -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"micpward@gmail.com","password":"Swsales1980!"}' | \
    python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
  [ -n "$TOKEN" ] && green "Auth" || { red "Auth failed"; exit 1; }
}

section "1. Authentication"
auth

section "2. Create Application"
TS=$(date +%s)
APP=$(curl -s -X POST "$BASE/api/applications/" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"organization_name\": \"Smoke Test Corp $TS\", \"contact_name\": \"Test User\", \"contact_email\": \"micpward@gmail.com\", \"system_name\": \"Smoke System $TS\", \"system_description\": \"Automated smoke test\", \"system_type\": \"autonomous_vehicle\", \"system_version\": \"1.0.0\", \"manufacturer\": \"Smoke Test Corp\", \"odd_specification\": {\"environment_type\": \"Urban\"}}")
APP_ID=$(echo $APP | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
[ -n "$APP_ID" ] && green "Application created: ID $APP_ID" || { red "Create application failed: $APP"; exit 1; }

section "3. Approve Application"
auth
APPROVE=$(curl -s -X PATCH "$BASE/api/applications/$APP_ID/state?new_state=approved" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
STATE=$(echo $APPROVE | python3 -c "import sys,json; print(json.load(sys.stdin).get('state',''))" 2>/dev/null)
APIKEY=$(echo $APPROVE | python3 -c "import sys,json; print(json.load(sys.stdin).get('api_key',''))" 2>/dev/null)
[ "$STATE" = "approved" ] && green "Application approved" || { red "Approve failed: $APPROVE"; exit 1; }
if [ -z "$APIKEY" ]; then
  auth
  APIKEY=$(curl -s "$BASE/api/applications/$APP_ID"     -H "Authorization: Bearer $TOKEN" |     python3 -c "import sys,json; d=json.load(sys.stdin); keys=d.get('api_keys',[]); print(keys[0].get('key','') if keys else '')" 2>/dev/null)
fi
[ -n "$APIKEY" ] && green "API key: ${APIKEY:0:20}..." || red "No API key"

section "4. CAT-72 Test"
auth
TEST=$(curl -s -X POST "$BASE/api/cat72/tests" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"application_id\": $APP_ID, \"envelope_definition\": {}}")
TEST_ID=$(echo $TEST | python3 -c "import sys,json; print(json.load(sys.stdin).get('test_id',''))" 2>/dev/null)
[ -n "$TEST_ID" ] && green "Test created: $TEST_ID" || { red "Create test failed: $TEST"; exit 1; }

auth
LRN=$(curl -s -X POST "$BASE/api/cat72/tests/$TEST_ID/start-learning" -H "Authorization: Bearer $TOKEN")
LRN_STATE=$(echo $LRN | python3 -c "import sys,json; print(json.load(sys.stdin).get('state',''))" 2>/dev/null)
[ "$LRN_STATE" = "learning" ] && green "Learning started" || { red "Start learning failed: $LRN"; exit 1; }

echo "  Sending 15 learning samples..."
for i in $(seq 1 15); do
  SPEED=$(python3 -c "import random; print(round(random.uniform(30,40),1))")
  curl -s -X POST "$BASE/api/cat72/tests/$TEST_ID/telemetry" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"state_vector\": {\"speed_mph\": $SPEED, \"visibility_m\": 300, \"precipitation_mm_hr\": 3}}" > /dev/null
  if [ $((i % 5)) -eq 0 ]; then auth; fi
done
green "15 learning samples sent"

auth
LC=$(curl -s -X POST "$BASE/api/cat72/tests/$TEST_ID/learn-complete" -H "Authorization: Bearer $TOKEN")
LC_STATE=$(echo $LC | python3 -c "import sys,json; print(json.load(sys.stdin).get('state',''))" 2>/dev/null)
LC_BOUNDS=$(echo $LC | python3 -c "import sys,json; print(json.load(sys.stdin).get('boundaries_generated',0))" 2>/dev/null)
[ "$LC_STATE" = "running" ] && green "Learning complete — $LC_BOUNDS boundaries" || { red "Learn-complete failed: $LC"; exit 1; }

echo "  Sending 100 conformant samples..."
for i in $(seq 1 100); do
  SPEED=$(python3 -c "import random; print(round(random.uniform(32,38),1))")
  curl -s -X POST "$BASE/api/cat72/tests/$TEST_ID/telemetry" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"state_vector\": {\"speed_mph\": $SPEED, \"visibility_m\": 300, \"precipitation_mm_hr\": 3}}" > /dev/null
  if [ $((i % 25)) -eq 0 ]; then auth; fi
done
green "100 conformant samples sent"

auth
STOP=$(curl -s -X POST "$BASE/api/cat72/tests/$TEST_ID/stop" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"reason": "Smoke test complete"}')
RESULT=$(echo $STOP | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',''))" 2>/dev/null)
CONV=$(echo $STOP | python3 -c "import sys,json; print(json.load(sys.stdin).get('convergence_score',''))" 2>/dev/null)
[ "$RESULT" = "PASS" ] && green "Test PASSED — convergence $CONV" || { red "Test FAILED: $STOP"; exit 1; }

section "5. Certificate (auto-issued)"
auth
CERT=$STOP
CERT_NUM=$(echo $CERT | python3 -c "import sys,json; print(json.load(sys.stdin).get('certificate_number',''))" 2>/dev/null)
CERT_NUM=$(echo $STOP | python3 -c "import sys,json; print(json.load(sys.stdin).get('certificate_number','') or '')" 2>/dev/null)
if [ -z "$CERT_NUM" ] || [ "$CERT_NUM" = "None" ]; then
  auth
  CERT_NUM=$(curl -s "$BASE/api/certificates/"     -H "Authorization: Bearer $TOKEN" |     python3 -c "
import sys,json
certs=json.load(sys.stdin)
match=[c for c in certs if c.get('application_id')==$APP_ID]
print(match[0]['certificate_number'] if match else '')
" 2>/dev/null)
fi
[ -n "$CERT_NUM" ] && [ "$CERT_NUM" != "None" ] && green "Certificate: $CERT_NUM" || { red "No certificate found for app $APP_ID"; exit 1; }

section "6. Public Verify"
VERIFY=$(curl -s "$BASE/api/verify/$CERT_NUM")
VALID=$(echo $VERIFY | python3 -c "import sys,json; print(json.load(sys.stdin).get('valid',''))" 2>/dev/null)
CERT_STATE=$(echo $VERIFY | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
if [ "$VALID" = "True" ] || [ "$CERT_STATE" = "CONFORMANT" ] || [ "$CERT_STATE" = "PENDING" ]; then
  green "Certificate state: $CERT_STATE"
else
  red "Verify failed: $VERIFY"
fi

section "7. ENVELO Session + Heartbeats"
SESSION=$(curl -s -X POST "$BASE/api/envelo/sessions" \
  -H "Authorization: Bearer $APIKEY" -H "Content-Type: application/json" \
  -d "{\"session_id\": \"smoke-$TS\", \"certificate_id\": \"$CERT_NUM\", \"agent_version\": \"1.0.0\", \"session_type\": \"production\", \"started_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}")
SESS_STATUS=$(echo $SESSION | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
[ "$SESS_STATUS" = "registered" ] && green "ENVELO session registered" || red "Session failed: $SESSION"

HB_OK=0
for i in 1 2 3; do
  SPEED=$(python3 -c "import random; print(round(random.uniform(32,38),1))")
  HB=$(curl -s -X POST "$BASE/api/envelo/heartbeat" \
    -H "Authorization: Bearer $APIKEY" -H "Content-Type: application/json" \
    -d "{\"session_id\": \"smoke-$TS\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"state_vector\": {\"speed_mph\": $SPEED, \"visibility_m\": 300, \"precipitation_mm_hr\": 3}, \"decision\": \"proceed\", \"decision_token\": \"tok-$i\"}")
  HB_STATUS=$(echo $HB | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
  [ "$HB_STATUS" = "ok" ] && HB_OK=$((HB_OK+1))
  sleep 1
done
[ $HB_OK -eq 3 ] && green "3/3 heartbeats ok" || red "$HB_OK/3 heartbeats ok"

echo ""
echo "=================================="
echo "  SMOKE TEST COMPLETE"
echo "  ✅ Passed: $PASS  ❌ Failed: $FAIL"
echo "  Certificate: $CERT_NUM"
echo "  Verify: https://app.sentinelauthority.org/verify?cert=$CERT_NUM"
echo "=================================="
[ $FAIL -eq 0 ] && exit 0 || exit 1
