package api

import (
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
