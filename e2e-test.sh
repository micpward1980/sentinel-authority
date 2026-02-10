#!/bin/bash
P='\033[35m'; G='\033[92m'; Y='\033[93m'; R='\033[91m'; C='\033[96m'; B='\033[1m'; D='\033[2m'; X='\033[0m'
API="https://sentinel-authority-production.up.railway.app"
FRONTEND="https://app.sentinelauthority.org"
PASS=0; FAIL=0; WARN=0
check() {
    local l="$1" s="$2" d="$3"
    if [ "$s" = "PASS" ]; then echo -e "  ${G}✓${X} ${l}${D} — ${d}${X}"; PASS=$((PASS+1))
    elif [ "$s" = "WARN" ]; then echo -e "  ${Y}⚠${X} ${l}${D} — ${d}${X}"; WARN=$((WARN+1))
    else echo -e "  ${R}✗${X} ${l}${D} — ${d}${X}"; FAIL=$((FAIL+1)); fi
}
header() { echo ""; echo -e "${P}${B}  ═══ $1 ═══${X}"; echo ""; }

header "PHASE 0: INFRASTRUCTURE"
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/health" 2>/dev/null)
if [ "$HEALTH_CODE" = "200" ]; then check "Backend health" "PASS" "→ $HEALTH_CODE"; else check "Backend health" "FAIL" "→ $HEALTH_CODE"; exit 1; fi
FRONT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND" 2>/dev/null)
if [ "$FRONT_CODE" = "200" ]; then check "Frontend" "PASS" "→ $FRONT_CODE"; else check "Frontend" "FAIL" "→ $FRONT_CODE"; fi

header "PHASE 1: AUTHENTICATION"
echo -e "  ${C}Enter admin credentials:${X}"; echo -n "  Email: "; read ADMIN_EMAIL; echo -n "  Password: "; read -s ADMIN_PASS; echo ""

# Use python to safely build JSON and login
LOGIN=$(python3 -c "
import json, urllib.request, sys
data = json.dumps({'email': '$ADMIN_EMAIL', 'password': sys.stdin.read().strip()}).encode()
req = urllib.request.Request('$API/api/auth/login', data=data, headers={'Content-Type': 'application/json'})
try:
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read())
    print('OK|' + result.get('access_token',''))
except urllib.error.HTTPError as e:
    print('ERR|' + str(e.code) + '|' + e.read().decode()[:200])
except Exception as e:
    print('ERR|0|' + str(e))
" <<< "$ADMIN_PASS" 2>/dev/null)

if echo "$LOGIN" | grep -q "^OK|"; then
    ADMIN_TOKEN=$(echo "$LOGIN" | cut -d'|' -f2)
    check "Admin login" "PASS" "Token acquired"
else
    ERR_CODE=$(echo "$LOGIN" | cut -d'|' -f2)
    ERR_MSG=$(echo "$LOGIN" | cut -d'|' -f3)
    check "Admin login" "FAIL" "HTTP $ERR_CODE: $ERR_MSG"; exit 1
fi

ME=$(curl -s "$API/api/auth/me" -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
MY_ROLE=$(echo "$ME" | python3 -c "import sys,json; print(json.load(sys.stdin).get('role','unknown'))" 2>/dev/null)
if [ "$MY_ROLE" = "admin" ]; then check "Admin role" "PASS" "$MY_ROLE"; else check "Admin role" "WARN" "$MY_ROLE"; fi
AUTH_HEADER="Authorization: Bearer $ADMIN_TOKEN"

header "PHASE 2: CREATE TEST APPLICANT"
TEST_EMAIL="e2e-test-$(date +%s)@sentinelauthority.org"; TEST_PASS_SIMPLE="E2eTest99xyz"
CREATE_USER=$(curl -s -w "\n%{http_code}" -X POST "$API/api/users/" -H "$AUTH_HEADER" -H "Content-Type: application/json" -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS_SIMPLE\",\"role\":\"applicant\",\"full_name\":\"E2E Test Applicant\"}" 2>/dev/null)
CU_CODE=$(echo "$CREATE_USER" | tail -1); CU_BODY=$(echo "$CREATE_USER" | sed '$d')
if [ "$CU_CODE" = "200" ] || [ "$CU_CODE" = "201" ]; then
    TEST_USER_ID=$(echo "$CU_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
    check "Create applicant" "PASS" "User ID: $TEST_USER_ID"
else check "Create applicant" "WARN" "HTTP $CU_CODE: ${CU_BODY:0:150}"; fi
APP_LOGIN=$(curl -s -w "\n%{http_code}" -X POST "$API/api/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS_SIMPLE\"}" 2>/dev/null)
AL_CODE=$(echo "$APP_LOGIN" | tail -1); AL_BODY=$(echo "$APP_LOGIN" | sed '$d')
if [ "$AL_CODE" = "200" ]; then
    APP_TOKEN=$(echo "$AL_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
    check "Applicant login" "PASS" "Token acquired"; APP_HEADER="Authorization: Bearer $APP_TOKEN"
else check "Applicant login" "WARN" "HTTP $AL_CODE — using admin"; APP_HEADER="$AUTH_HEADER"; fi

header "PHASE 3: APPLICATION SUBMISSION"
APP_PAYLOAD='{"organization_name":"E2E Test Corp","contact_name":"Test Engineer","contact_email":"'"$TEST_EMAIL"'","contact_phone":"512-555-0199","system_name":"AutoNav L4 Urban Test","system_description":"Level 4 autonomous urban nav for e2e testing","system_version":"v3.2.1-test","manufacturer":"E2E Test Corp","system_type":"autonomous_ground_vehicle","odd_specification":{"speed":{"min":0,"max":25,"unit":"m/s","tolerance":1.5},"geofence_radius":{"min":50,"max":5000,"unit":"m","tolerance":10}},"envelope_definition":{"boundaries":[{"name":"speed","type":"numeric","min":0,"max":25,"unit":"m/s"},{"name":"geofence","type":"numeric","min":50,"max":5000,"unit":"m"}]},"facility_location":"Austin, TX","notes":"E2E test — safe to delete"}'
SUBMIT=$(curl -s -w "\n%{http_code}" -X POST "$API/api/applications/" -H "$APP_HEADER" -H "Content-Type: application/json" -d "$APP_PAYLOAD" 2>/dev/null)
SUB_CODE=$(echo "$SUBMIT" | tail -1); SUB_BODY=$(echo "$SUBMIT" | sed '$d')
if [ "$SUB_CODE" = "200" ] || [ "$SUB_CODE" = "201" ]; then
    APP_ID=$(echo "$SUB_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
    APP_NUM=$(echo "$SUB_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('application_number',''))" 2>/dev/null)
    check "Submit application" "PASS" "ID: $APP_ID, Number: $APP_NUM"
else check "Submit application" "FAIL" "HTTP $SUB_CODE: ${SUB_BODY:0:200}"; fi
if [ -n "$APP_ID" ]; then
    DETAIL=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/applications/$APP_ID" -H "$AUTH_HEADER" 2>/dev/null)
    if [ "$DETAIL" = "200" ]; then check "Application detail" "PASS" "→ 200"; else check "Application detail" "FAIL" "→ $DETAIL"; fi
fi

header "PHASE 4: STATE TRANSITIONS"
if [ -n "$APP_ID" ]; then
    REV_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$API/api/applications/$APP_ID/state?new_state=under_review" -H "$AUTH_HEADER" 2>/dev/null)
    if [ "$REV_CODE" = "200" ]; then check "→ under_review" "PASS" "OK"; else check "→ under_review" "FAIL" "HTTP $REV_CODE"; fi
    APR=$(curl -s -w "\n%{http_code}" -X PATCH "$API/api/applications/$APP_ID/state?new_state=approved" -H "$AUTH_HEADER" 2>/dev/null); APR_CODE=$(echo "$APR" | tail -1); APR_BODY=$(echo "$APR" | sed '$d')
    if [ "$APR_CODE" = "200" ]; then
        check "→ approved" "PASS" "OK"
        ENVELO_KEY=$(echo "$APR_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); k=d.get('api_key',d.get('envelo_key','')); print(k if k else '')" 2>/dev/null)
        if [ -n "$ENVELO_KEY" ] && [ "$ENVELO_KEY" != "None" ]; then check "API key provisioned" "PASS" "${ENVELO_KEY:0:20}..."; else check "API key provisioned" "WARN" "Not in response"; fi
    else check "→ approved" "FAIL" "HTTP $APR_CODE"; fi
fi

header "PHASE 5: DEPLOY ENDPOINT"
if [ -n "$APP_NUM" ]; then
    DNK=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/deploy/$APP_NUM" 2>/dev/null)
    if [ "$DNK" = "422" ] || [ "$DNK" = "401" ]; then check "Deploy auth guard" "PASS" "Requires key ($DNK)"
    elif [ "$DNK" = "404" ]; then check "Deploy endpoint" "FAIL" "404 — route missing"
    else check "Deploy auth guard" "WARN" "Response: $DNK"; fi
fi

header "PHASE 6: ENVELO TELEMETRY"
SESS=$(curl -s -w "\n%{http_code}" -X POST "$API/api/envelo/sessions" -H "$AUTH_HEADER" -H "Content-Type: application/json" -d "{\"certificate_id\":\"E2E-TEST\",\"agent_version\":\"2.0.0-test\"}" 2>/dev/null); SESS_CODE=$(echo "$SESS" | tail -1); SESS_BODY=$(echo "$SESS" | sed '$d')
if [ "$SESS_CODE" = "200" ] || [ "$SESS_CODE" = "201" ]; then
    SESSION_ID=$(echo "$SESS_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_id',d.get('id','')))" 2>/dev/null)
    check "Register session" "PASS" "Session: $SESSION_ID"
else check "Register session" "FAIL" "HTTP $SESS_CODE: ${SESS_BODY:0:200}"; fi
if [ -n "$SESSION_ID" ]; then
    TEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/envelo/telemetry" -H "$AUTH_HEADER" -H "Content-Type: application/json" -d "{\"session_id\":\"$SESSION_ID\",\"certificate_id\":\"E2E-TEST\",\"records\":[{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"action\":\"speed_check\",\"decision\":\"pass\",\"value\":12.5,\"boundary\":25.0}],\"stats\":{\"pass_count\":1,\"block_count\":0}}" 2>/dev/null)
    if [ "$TEL_CODE" = "200" ] || [ "$TEL_CODE" = "201" ]; then check "Send telemetry" "PASS" "Ingested"; else check "Send telemetry" "FAIL" "HTTP $TEL_CODE"; fi
fi
STAT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/envelo/stats" 2>/dev/null)
if [ "$STAT_CODE" = "200" ]; then check "ENVELO stats" "PASS" "Public"; else check "ENVELO stats" "WARN" "HTTP $STAT_CODE"; fi

header "PHASE 7: CAT-72"
CAT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/cat72/" -H "$AUTH_HEADER" 2>/dev/null)
if [ "$CAT_CODE" = "200" ]; then check "CAT-72 list" "PASS" "→ 200"; else check "CAT-72 list" "FAIL" "HTTP $CAT_CODE"; fi

header "PHASE 8: CERTIFICATES & REGISTRY"
CERT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/certificates/" -H "$AUTH_HEADER" 2>/dev/null)
if [ "$CERT_CODE" = "200" ]; then check "Certificates" "PASS" "OK"; else check "Certificates" "FAIL" "HTTP $CERT_CODE"; fi
REG_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/registry/search" 2>/dev/null)
if [ "$REG_CODE" = "200" ]; then check "Public registry" "PASS" "No auth"; else check "Public registry" "WARN" "HTTP $REG_CODE"; fi
RS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/registry/stats" 2>/dev/null)
if [ "$RS_CODE" = "200" ]; then check "Registry stats" "PASS" "Public"; else check "Registry stats" "WARN" "HTTP $RS_CODE"; fi
VER_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/verify/ODDC-TEST-0001" 2>/dev/null)
if [ "$VER_CODE" = "200" ] || [ "$VER_CODE" = "404" ]; then check "Verification" "PASS" "($VER_CODE)"; else check "Verification" "WARN" "HTTP $VER_CODE"; fi

header "PHASE 9: DASHBOARD & ADMIN"
DASH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/dashboard/" -H "$AUTH_HEADER" 2>/dev/null)
if [ "$DASH_CODE" = "200" ]; then check "Dashboard" "PASS" "OK"; else check "Dashboard" "FAIL" "HTTP $DASH_CODE"; fi
AUD_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/audit/" -H "$AUTH_HEADER" 2>/dev/null)
if [ "$AUD_CODE" = "200" ]; then check "Audit log" "PASS" "OK"; else check "Audit log" "WARN" "HTTP $AUD_CODE"; fi
NOT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/notifications" -H "$AUTH_HEADER" 2>/dev/null)
if [ "$NOT_CODE" = "200" ]; then check "Notifications" "PASS" "OK"; else check "Notifications" "WARN" "HTTP $NOT_CODE"; fi

header "PHASE 10: CLEANUP"
if [ -n "$APP_ID" ]; then
    DEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API/api/applications/$APP_ID" -H "$AUTH_HEADER" 2>/dev/null)
    if [ "$DEL_CODE" = "200" ] || [ "$DEL_CODE" = "204" ]; then check "Delete test app" "PASS" "Cleaned"; else check "Delete test app" "WARN" "HTTP $DEL_CODE"; fi
fi
if [ -n "$TEST_USER_ID" ]; then
    UDEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API/api/users/$TEST_USER_ID" -H "$AUTH_HEADER" 2>/dev/null)
    if [ "$UDEL_CODE" = "200" ] || [ "$UDEL_CODE" = "204" ]; then check "Delete test user" "PASS" "Cleaned"; else check "Delete test user" "WARN" "HTTP $UDEL_CODE"; fi
fi

echo ""; echo -e "${P}${B}  ═══════════════════════════════════════════════════════${X}"
echo -e "  ${G}✓ PASS: $PASS${X}  ${Y}⚠ WARN: $WARN${X}  ${R}✗ FAIL: $FAIL${X}"
echo -e "  ${D}Total: $((PASS + WARN + FAIL)) checks${X}"
if [ "$FAIL" -eq 0 ]; then echo -e "  ${G}${B}PIPELINE: OPERATIONAL${X}"; else echo -e "  ${R}${B}PIPELINE: $FAIL FAILURES${X}"; fi
echo ""
