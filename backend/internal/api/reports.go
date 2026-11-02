package api

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/thinhstudio/kaizensystem/backend/internal/auth"
)

// reportFilter builds a scoped WHERE for report queries with optional ?from&to&workshop_id.
func reportFilter(r *http.Request, c *auth.Claims, dateCol string) (string, []any) {
	args := []any{}
	add := func(v any) string { args = append(args, v); return "$" + strconv.Itoa(len(args)) }
	cond := scopeSQL(c, &args)
	q := r.URL.Query()
	if v, err := time.Parse("2006-01-02", q.Get("from")); err == nil {
		cond += " AND " + dateCol + " >= " + add(v)
	}
	if v, err := time.Parse("2006-01-02", q.Get("to")); err == nil {
		cond += " AND " + dateCol + " < " + add(v.AddDate(0, 0, 1))
	}
	if v, err := strconv.ParseInt(q.Get("workshop_id"), 10, 64); err == nil {
		cond += " AND i.workshop_id = " + add(v)
	}
	return cond, args
}

func (s *Server) reportSummary(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	ctx := r.Context()
	cond, args := reportFilter(r, c, "i.created_at")
	sum, err := queryMap(ctx, s.DB, `SELECT
		count(*) FILTER (WHERE i.status<>'DRAFT')                                  AS total_ideas,
		count(*) FILTER (WHERE i.status='COMPLETED')                               AS completed,
		count(*) FILTER (WHERE i.status='REJECTED')                                AS rejected,
		count(*) FILTER (WHERE i.status IN ('PENDING_LEADER','PENDING_IE','PENDING_FINANCE')) AS pending_approval,
		count(*) FILTER (WHERE i.status IN ('QUICK_WIN','IMPLEMENTING'))           AS in_progress,
		count(*) FILTER (WHERE i.kaizen_type='QUICK_WIN')                          AS quick_wins,
		count(*) FILTER (WHERE i.kaizen_type='MAJOR')                              AS major_projects,
		COALESCE(round(100.0 * count(*) FILTER (WHERE i.status='COMPLETED')
		      / NULLIF(count(*) FILTER (WHERE i.status NOT IN ('DRAFT','REJECTED')),0), 1),0)::float8 AS completion_rate,
		COALESCE(sum(i.estimated_saving) FILTER (WHERE i.status<>'REJECTED'),0)::float8 AS estimated_saving,
		COALESCE(sum(f.annual_saving) FILTER (WHERE f.verified),0)::float8          AS verified_saving,
		COALESCE(sum(f.investment_cost) FILTER (WHERE f.verified),0)::float8        AS verified_investment,
		COALESCE(round(avg(extract(epoch FROM (
		   SELECT min(ap.acted_at) - min(ap.created_at) FROM kaizen_approvals ap
		   WHERE ap.idea_id=i.id AND ap.level='LEADER' AND ap.acted_at IS NOT NULL))/3600)::numeric,1),0)::float8 AS avg_leader_response_hours,
		count(DISTINCT i.submitter_id) FILTER (WHERE i.status<>'DRAFT')            AS participants
		FROM kaizen_ideas i LEFT JOIN kaizen_financials f ON f.idea_id=i.id
		WHERE `+cond, args...)
	if err != nil {
		internalErr(w, err)
		return
	}
	byCat, err := queryMaps(ctx, s.DB, `SELECT c.name AS category, count(*) AS total
		FROM kaizen_ideas i JOIN kaizen_categories c ON c.id=i.category_id
		WHERE i.status<>'DRAFT' AND `+cond+` GROUP BY c.name ORDER BY total DESC`, args...)
	if err != nil {
		internalErr(w, err)
		return
	}
	byStatus, err := queryMaps(ctx, s.DB, `SELECT i.status, count(*) AS total FROM kaizen_ideas i WHERE `+cond+` GROUP BY i.status`, args...)
	if err != nil {
		internalErr(w, err)
		return
	}
	top, err := queryMaps(ctx, s.DB, `SELECT u.full_name, w.name AS workshop, sum(rw.points)::int AS points, count(DISTINCT rw.idea_id) AS ideas
		FROM kaizen_rewards rw JOIN kaizen_ideas i ON i.id=rw.idea_id JOIN users u ON u.id=rw.user_id
		LEFT JOIN workshops w ON w.id=u.workshop_id
		WHERE rw.status<>'CANCELLED' AND `+cond+` GROUP BY u.full_name, w.name ORDER BY points DESC LIMIT 10`, args...)
	if err != nil {
		internalErr(w, err)
		return
	}
	sum["by_category"], sum["by_status"], sum["top_contributors"] = byCat, byStatus, top
	writeJSON(w, http.StatusOK, sum)
}

func (s *Server) reportROI(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	if !requireRole(w, c, auth.RoleIE, auth.RoleFinance, auth.RoleDirector, auth.RoleAdmin, auth.RoleLeader) {
		return
	}
	cond, args := reportFilter(r, c, "i.completed_at")
	rows, err := queryMaps(r.Context(), s.DB, `SELECT w.id AS workshop_id, w.name AS workshop,
		to_char(date_trunc('month', i.completed_at), 'YYYY-MM') AS month,
		count(*) AS projects,
		sum(f.investment_cost)::float8 AS investment,
		sum(f.annual_saving)::float8 AS annual_saving,
		(sum(f.annual_saving) - sum(f.investment_cost))::float8 AS net_benefit,
		CASE WHEN sum(f.investment_cost) > 0
		     THEN round((sum(f.annual_saving)-sum(f.investment_cost))/sum(f.investment_cost)*100,2) END::float8 AS roi_percent,
		CASE WHEN sum(f.annual_saving) > 0
		     THEN round(sum(f.investment_cost)/sum(f.annual_saving)*12,2) END::float8 AS payback_months
		FROM kaizen_ideas i JOIN kaizen_financials f ON f.idea_id=i.id AND f.verified
		JOIN workshops w ON w.id=i.workshop_id
		WHERE i.status='COMPLETED' AND `+cond+`
		GROUP BY w.id, w.name, month ORDER BY month DESC, w.name`, args...)
	if err != nil {
		internalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

// reportTrend: submitted vs completed per month for the last 12 months.
func (s *Server) reportTrend(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	args := []any{}
	cond := scopeSQL(c, &args)
	rows, err := queryMaps(r.Context(), s.DB, `WITH m AS (
		SELECT to_char(d, 'YYYY-MM') AS month FROM generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') d)
		SELECT m.month,
		  (SELECT count(*) FROM kaizen_ideas i WHERE to_char(i.submitted_at,'YYYY-MM')=m.month AND `+cond+`) AS submitted,
		  (SELECT count(*) FROM kaizen_ideas i WHERE to_char(i.completed_at,'YYYY-MM')=m.month AND `+cond+`) AS completed
		FROM m ORDER BY m.month`, args...)
	if err != nil {
		internalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

// reportWastes: number of submitted ideas tackling each of the 8 wastes.
func (s *Server) reportWastes(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	cond, args := reportFilter(r, c, "i.created_at")
	rows, err := queryMaps(r.Context(), s.DB, `SELECT w AS waste, count(*) AS total,
		count(*) FILTER (WHERE i.status='COMPLETED') AS completed
		FROM kaizen_ideas i, unnest(i.waste_types) w WHERE i.status<>'DRAFT' AND `+cond+` GROUP BY w ORDER BY total DESC`, args...)
	if err != nil {
		internalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

// leaderboard: points per employee across the caller's factory (belt ranking is derived client-side).
func (s *Server) leaderboard(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	args := []any{}
	cond := "TRUE"
	if c.FactoryID != nil {
		args = append(args, *c.FactoryID)
		cond = "u.factory_id = $1"
	}
	rows, err := queryMaps(r.Context(), s.DB, `SELECT u.id AS user_id, u.full_name, u.role, w.name AS workshop,
		COALESCE(sum(rw.points),0)::int AS points, COALESCE(sum(rw.amount),0)::float8 AS amount,
		(SELECT count(*) FROM kaizen_ideas i WHERE i.submitter_id=u.id AND i.status<>'DRAFT') AS ideas,
		(SELECT count(*) FROM kaizen_ideas i WHERE i.submitter_id=u.id AND i.status='COMPLETED') AS completed
		FROM users u LEFT JOIN workshops w ON w.id=u.workshop_id
		LEFT JOIN kaizen_rewards rw ON rw.user_id=u.id AND rw.status<>'CANCELLED'
		WHERE u.is_active AND u.role<>'ADMIN' AND `+cond+`
		GROUP BY u.id, u.full_name, u.role, w.name ORDER BY points DESC, ideas DESC LIMIT 50`, args...)
	if err != nil {
		internalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

// exportCSV: Excel-friendly CSV (UTF-8 BOM) of ideas in scope.
func (s *Server) exportCSV(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	cond, args := reportFilter(r, c, "i.created_at")
	rows, err := s.DB.Query(r.Context(), `SELECT i.code, i.title, i.status, COALESCE(i.kaizen_type,''), c.name, w.name,
		u.full_name, array_to_string(i.waste_types, '|'), COALESCE(i.lean_tool,''), i.estimated_saving::float8,
		COALESCE(f.investment_cost,0)::float8, COALESCE(f.annual_saving,0)::float8, COALESCE(f.verified,false),
		to_char(i.created_at,'YYYY-MM-DD'), COALESCE(to_char(i.completed_at,'YYYY-MM-DD'),'')
		FROM kaizen_ideas i JOIN kaizen_categories c ON c.id=i.category_id JOIN workshops w ON w.id=i.workshop_id
		JOIN users u ON u.id=i.submitter_id LEFT JOIN kaizen_financials f ON f.idea_id=i.id
		WHERE `+cond+` ORDER BY i.created_at DESC`, args...)
	if err != nil {
		internalErr(w, err)
		return
	}
	defer rows.Close()
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="kaizen-export.csv"`)
	cw := csv.NewWriter(w)
	_, _ = w.Write([]byte("\xEF\xBB\xBF"))
	_ = cw.Write([]string{"Mã", "Tiêu đề", "Trạng thái", "Loại", "Lĩnh vực", "Xưởng", "Người đề xuất", "Lãng phí", "Công cụ Lean",
		"Ước tính tiết kiệm", "Chi phí đầu tư", "Tiết kiệm xác thực", "Đã xác thực", "Ngày tạo", "Ngày hoàn thành"})
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return
		}
		rec := make([]string, len(vals))
		for i, v := range vals {
			rec[i] = fmt.Sprint(v)
		}
		_ = cw.Write(rec)
	}
	cw.Flush()
}
