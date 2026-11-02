#!/usr/bin/env bash
# End-to-end smoke test of the full Kaizen lifecycle against a running API with SEED_DEMO=true.
set -euo pipefail
B=${BASE_URL:-http://localhost:8080}/api/v1
j() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1"; }
login() { curl -sf -XPOST $B/auth/login -d "{\"employee_code\":\"$1\",\"password\":\"123456\"}" | j 'd["token"]'; }
call() { local t=$1; shift; curl -sS -H "Authorization: Bearer $t" "$@"; }
IMG=$(mktemp --suffix=.png); printf '\x89PNG\r\n\x1a\n' > "$IMG"

W=$(login CN001); L=$(login TT001); IE=$(login IE001); F=$(login KT001); D=$(login GD001)
LINE=$(call $W $B/master | j 'd["lines"][0]["qr_token"]')

echo "== Quick Win flow"
ID=$(call $W -F title="Gắn nam châm giữ kéo" -F category_id=5 -F problem="Kéo rơi" -F proposal="Nam châm" \
     -F line_qr=$LINE -F waste_types=MOTION -F lean_tool=5S -F submit=true -F "before=@$IMG;type=image/png" $B/kaizens | j 'd["id"]')
AP=$(call $L $B/approvals/pending | j 'd[0]["approval_id"]')
call $L -XPOST $B/approvals/$AP/action -d '{"action":"APPROVE","kaizen_type":"QUICK_WIN"}'; echo
call $W -XPOST $B/kaizens/$ID/complete; echo "  (expected: AFTER photo required)"
call $W -F phase=AFTER -F "files=@$IMG;type=image/png" $B/kaizens/$ID/attachments; echo
call $W -XPOST $B/kaizens/$ID/complete; echo

echo "== Major project flow"
ID2=$(call $W -XPOST $B/kaizens -d '{"title":"Tự động hóa cấp liệu","category_id":3,"problem":"Cấp tay","proposal":"Băng tải","estimated_saving":120000000,"waste_types":["TRANSPORT","WAITING"],"lean_tool":"KANBAN","submit":true}' | j 'd["id"]')
AP=$(call $L $B/approvals/pending | j 'd[0]["approval_id"]')
call $L -XPOST $B/approvals/$AP/action -d '{"action":"APPROVE","kaizen_type":"MAJOR"}'; echo
AP=$(call $IE $B/approvals/pending | j 'd[0]["approval_id"]')
call $IE -XPOST $B/approvals/$AP/action -d '{"action":"APPROVE","investment_cost":30000000,"annual_saving":100000000}'; echo
T=$(call $IE -XPOST $B/kaizens/$ID2/tasks -d '{"title":"Lắp băng tải","due_date":"2026-12-01"}' | j 'd["id"]')
call $IE -XPATCH $B/kaizens/tasks/$T/status -d '{"status":"IN_PROGRESS"}'; echo
call $IE -F phase=AFTER -F "files=@$IMG;type=image/png" $B/kaizens/$ID2/attachments >/dev/null
call $IE -XPOST $B/kaizens/$ID2/complete; echo "  (expected: task not DONE)"
call $IE -XPATCH $B/kaizens/tasks/$T/status -d '{"status":"DONE"}'; echo
call $IE -XPOST $B/kaizens/$ID2/complete; echo
AP=$(call $F $B/approvals/pending | j 'd[0]["approval_id"]')
call $F -XPOST $B/approvals/$AP/action -d '{"action":"APPROVE","annual_saving":90000000,"comment":"Đã đối chiếu"}'; echo

echo "== Reject flow + RBAC"
ID3=$(call $W -XPOST $B/kaizens -d '{"title":"Ý tưởng X","category_id":6,"problem":"a","proposal":"b","submit":true}' | j 'd["id"]')
AP=$(call $L $B/approvals/pending | j 'd[0]["approval_id"]')
call $L -XPOST $B/approvals/$AP/action -d '{"action":"REJECT"}'; echo "  (expected: comment required)"
call $L -XPOST $B/approvals/$AP/action -d '{"action":"REJECT","comment":"Trùng ý tưởng"}'; echo
call $W -XPOST $B/approvals/$AP/action -d '{"action":"APPROVE"}'; echo "  (expected: processed/forbidden)"

echo "== Social"
call $L -XPOST $B/kaizens/$ID2/comments -d '{"body":"Rất hay, nhân rộng sang chuyền 02"}'; echo
call $D -XPOST $B/kaizens/$ID2/like; echo
call $W $B/kaizens/$ID2 | j '(d["waste_types"], d["lean_tool"], d["like_count"], len(d["comments"]))'

echo "== Reports"
call $D $B/reports/wastes; echo
call $D $B/reports/leaderboard | j '[(r["full_name"],r["points"]) for r in d[:3]]'
call $D $B/reports/trend | j 'd[-1]'
call $D $B/activity | j 'len(d)'
call $D "$B/kaizens?waste=TRANSPORT" | j 'd["total"]'
call $D $B/reports/export.csv | head -2
call $D $B/reports/summary | j '{k:d[k] for k in ("total_ideas","completed","completion_rate","verified_saving")}'
call $D $B/reports/roi; echo
call $W $B/me/rewards | j '[(r["code"],r["points"],r["amount"]) for r in d]'
call $W "$B/kaizens?page_size=5" | j 'd["total"]'
