package api

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/thinhstudio/kaizensystem/backend/internal/auth"
	"github.com/thinhstudio/kaizensystem/backend/internal/notify"
)

/*
Kaizen lifecycle (state machine)

  DRAFT / REVISION_REQUESTED --submit--> PENDING_LEADER            [approval LEADER]
  PENDING_LEADER --REJECT--> REJECTED
  PENDING_LEADER --REVISION--> REVISION_REQUESTED
  PENDING_LEADER --APPROVE(QUICK_WIN)--> QUICK_WIN  --complete(After photo)--> COMPLETED (+points)
  PENDING_LEADER --APPROVE(MAJOR)--> PENDING_IE                    [approval IE]
  PENDING_IE --APPROVE--> IMPLEMENTING (Kanban tasks)  --complete--> PENDING_FINANCE [approval FINANCE]
  PENDING_FINANCE --APPROVE(verified ROI)--> COMPLETED (+points, +bonus)
  PENDING_IE / PENDING_FINANCE --REVISION--> previous working state, REJECT --> REJECTED
*/

func submitTx(ctx context.Context, tx pgx.Tx, uid, ideaID, workshopID int64) error {
	var status string
	if err := tx.QueryRow(ctx, `SELECT status FROM kaizen_ideas WHERE id=$1 FOR UPDATE`, ideaID).Scan(&status); err != nil {
		return err
	}
	if status != "DRAFT" && status != "REVISION_REQUESTED" {
		return fmt.Errorf("cannot submit from status %s", status)
	}
	if _, err := tx.Exec(ctx, `UPDATE kaizen_ideas SET status='PENDING_LEADER', submitted_at=COALESCE(submitted_at, now()), updated_at=now() WHERE id=$1`, ideaID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO kaizen_approvals(idea_id, level, approver_role, workshop_id) VALUES ($1,'LEADER','LEADER',$2)`, ideaID, workshopID); err != nil {
		return err
	}
	return audit(ctx, tx, uid, "kaizen", ideaID, "SUBMIT", nil)
}

func (s *Server) submitKaizen(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	ctx := r.Context()
	id, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		internalErr(w, err)
		return
	}
	defer tx.Rollback(ctx)
	idea, err := loadIdea(ctx, tx, id, true)
	if err != nil {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if idea.SubmitterID != c.UserID {
		writeErr(w, http.StatusForbidden, "only the submitter can submit")
		return
	}
	if err := submitTx(ctx, tx, c.UserID, id, idea.WorkshopID); err != nil {
		writeErr(w, http.StatusConflict, err.Error())
		return
	}
	if err := tx.Commit(ctx); err != nil {
		internalErr(w, err)
		return
	}
	s.Notify.Send(notify.Event{Type: "kaizen.submitted", IdeaID: id, Code: idea.Code, Title: idea.Title,
		Status: "PENDING_LEADER", Message: "Sáng kiến chờ Tổ trưởng sơ duyệt"})
	writeJSON(w, http.StatusOK, map[string]string{"status": "PENDING_LEADER"})
}

func (s *Server) pendingApprovals(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	args := []any{}
	cond := "ap.status='PENDING'"
	switch c.Role {
	case auth.RoleAdmin:
	case auth.RoleLeader:
		if c.WorkshopID == nil {
			writeJSON(w, http.StatusOK, []any{})
			return
		}
		args = append(args, *c.WorkshopID)
		cond += " AND ap.level='LEADER' AND ap.workshop_id=$1"
	case auth.RoleIE, auth.RoleFinance:
		args = append(args, c.Role)
		cond += " AND ap.approver_role=$1"
		if c.FactoryID != nil {
			args = append(args, *c.FactoryID)
			cond += " AND i.factory_id=$2"
		}
	default:
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	rows, err := queryMaps(r.Context(), s.DB, `SELECT ap.id AS approval_id, ap.level, ap.created_at AS pending_since,
		i.id AS idea_id, i.code, i.title, i.status, i.kaizen_type, i.estimated_saving::float8 AS estimated_saving,
		w.name AS workshop, u.full_name AS submitter, c.name AS category, i.problem, i.proposal, i.waste_types, i.lean_tool,
		(SELECT a.id FROM kaizen_attachments a WHERE a.idea_id=i.id AND a.content_type LIKE 'image/%' ORDER BY a.id LIMIT 1) AS thumb_id,
		round(extract(epoch FROM now()-ap.created_at)/3600)::int AS waiting_hours
		FROM kaizen_approvals ap JOIN kaizen_ideas i ON i.id=ap.idea_id
		JOIN workshops w ON w.id=i.workshop_id JOIN users u ON u.id=i.submitter_id
		JOIN kaizen_categories c ON c.id=i.category_id
		WHERE `+cond+` ORDER BY ap.created_at`, args...)
	if err != nil {
		internalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

type actionInput struct {
	Action         string   `json:"action"` // APPROVE | REJECT | REVISION
	Comment        string   `json:"comment"`
	KaizenType     string   `json:"kaizen_type"` // LEADER level: QUICK_WIN | MAJOR
	AssigneeID     *int64   `json:"assignee_id"` // IE level / quick win owner
	InvestmentCost *float64 `json:"investment_cost"`
	AnnualSaving   *float64 `json:"annual_saving"` // FINANCE level (verified)
}

func (s *Server) approvalAction(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	ctx := r.Context()
	apID, err := pathID(r, "approval_id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	var in actionInput
	if err := decode(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	in.Action = strings.ToUpper(in.Action)
	in.KaizenType = strings.ToUpper(in.KaizenType)
	if in.Action != "APPROVE" && in.Action != "REJECT" && in.Action != "REVISION" {
		writeErr(w, http.StatusBadRequest, "action must be APPROVE, REJECT or REVISION")
		return
	}
	if in.Action != "APPROVE" && strings.TrimSpace(in.Comment) == "" {
		writeErr(w, http.StatusBadRequest, "comment (reason) is required when rejecting or requesting revision")
		return
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		internalErr(w, err)
		return
	}
	defer tx.Rollback(ctx)

	var level, apStatus string
	var ideaID int64
	var apWorkshop *int64
	if err := tx.QueryRow(ctx, `SELECT idea_id, level, status, workshop_id FROM kaizen_approvals WHERE id=$1 FOR UPDATE`, apID).
		Scan(&ideaID, &level, &apStatus, &apWorkshop); err != nil {
		writeErr(w, http.StatusNotFound, "approval not found")
		return
	}
	if apStatus != "PENDING" {
		writeErr(w, http.StatusConflict, "approval already processed")
		return
	}
	idea, err := loadIdea(ctx, tx, ideaID, true)
	if err != nil {
		internalErr(w, err)
		return
	}
	// authorisation per level
	allowed := c.Role == auth.RoleAdmin
	switch level {
	case "LEADER":
		allowed = allowed || (c.Role == auth.RoleLeader && c.WorkshopID != nil && apWorkshop != nil && *c.WorkshopID == *apWorkshop)
	case "IE":
		allowed = allowed || (c.Role == auth.RoleIE && canView(c, idea))
	case "FINANCE":
		allowed = allowed || (c.Role == auth.RoleFinance && canView(c, idea))
	}
	if !allowed {
		writeErr(w, http.StatusForbidden, "not allowed to act on this approval")
		return
	}

	apNew := map[string]string{"APPROVE": "APPROVED", "REJECT": "REJECTED", "REVISION": "REVISION"}[in.Action]
	if _, err := tx.Exec(ctx, `UPDATE kaizen_approvals SET status=$2, acted_by=$3, comment=NULLIF($4,''), acted_at=now() WHERE id=$1`,
		apID, apNew, c.UserID, in.Comment); err != nil {
		internalErr(w, err)
		return
	}

	var next string
	switch in.Action {
	case "REJECT":
		next = "REJECTED"
	case "REVISION":
		switch level {
		case "LEADER":
			next = "REVISION_REQUESTED"
		case "IE":
			next = "REVISION_REQUESTED"
		case "FINANCE":
			next = "IMPLEMENTING" // back to the project team to fix numbers / evidence
		}
	case "APPROVE":
		switch level {
		case "LEADER":
			switch in.KaizenType {
			case "QUICK_WIN":
				next = "QUICK_WIN"
				owner := idea.SubmitterID
				if in.AssigneeID != nil {
					owner = *in.AssigneeID
				}
				if _, err := tx.Exec(ctx, `UPDATE kaizen_ideas SET kaizen_type='QUICK_WIN', assignee_id=$2 WHERE id=$1`, ideaID, owner); err != nil {
					internalErr(w, err)
					return
				}
			case "MAJOR":
				next = "PENDING_IE"
				if _, err := tx.Exec(ctx, `UPDATE kaizen_ideas SET kaizen_type='MAJOR' WHERE id=$1`, ideaID); err != nil {
					internalErr(w, err)
					return
				}
				if _, err := tx.Exec(ctx, `INSERT INTO kaizen_approvals(idea_id, level, approver_role) VALUES ($1,'IE','IE')`, ideaID); err != nil {
					internalErr(w, err)
					return
				}
			default:
				writeErr(w, http.StatusBadRequest, "kaizen_type (QUICK_WIN | MAJOR) is required for leader approval")
				return
			}
		case "IE":
			next = "IMPLEMENTING"
			if in.AssigneeID != nil {
				if _, err := tx.Exec(ctx, `UPDATE kaizen_ideas SET assignee_id=$2 WHERE id=$1`, ideaID, *in.AssigneeID); err != nil {
					writeErr(w, http.StatusBadRequest, "invalid assignee")
					return
				}
			}
			if in.InvestmentCost != nil || in.AnnualSaving != nil {
				if err := upsertFin(ctx, tx, ideaID, in.InvestmentCost, in.AnnualSaving, "", false, 0); err != nil {
					writeErr(w, http.StatusBadRequest, err.Error())
					return
				}
			}
		case "FINANCE":
			if err := upsertFin(ctx, tx, ideaID, in.InvestmentCost, in.AnnualSaving, in.Comment, true, c.UserID); err != nil {
				writeErr(w, http.StatusBadRequest, err.Error())
				return
			}
			next = "COMPLETED"
		}
	}

	if _, err := tx.Exec(ctx, `UPDATE kaizen_ideas SET status=$2::varchar, updated_at=now(),
		completed_at = CASE WHEN $2::varchar='COMPLETED' THEN now() ELSE completed_at END WHERE id=$1`, ideaID, next); err != nil {
		internalErr(w, err)
		return
	}
	if next == "COMPLETED" {
		if err := s.grantRewards(ctx, tx, ideaID, c.UserID); err != nil {
			internalErr(w, err)
			return
		}
	}
	if err := audit(ctx, tx, c.UserID, "approval", apID, in.Action, map[string]any{"level": level, "next": next, "comment": in.Comment}); err != nil {
		internalErr(w, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		internalErr(w, err)
		return
	}
	s.Notify.Send(notify.Event{Type: "kaizen.status_changed", IdeaID: ideaID, Code: idea.Code, Title: idea.Title,
		Status: next, Message: fmt.Sprintf("%s %s: %s", level, in.Action, in.Comment)})
	writeJSON(w, http.StatusOK, map[string]string{"status": next})
}

// completeKaizen: QUICK_WIN -> COMPLETED, IMPLEMENTING -> PENDING_FINANCE.
func (s *Server) completeKaizen(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	ctx := r.Context()
	id, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		internalErr(w, err)
		return
	}
	defer tx.Rollback(ctx)
	idea, err := loadIdea(ctx, tx, id, true)
	if err != nil {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	isOwner := idea.AssigneeID != nil && *idea.AssigneeID == c.UserID
	var afterCount int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM kaizen_attachments WHERE idea_id=$1 AND phase='AFTER'`, id).Scan(&afterCount); err != nil {
		internalErr(w, err)
		return
	}

	var next string
	switch idea.Status {
	case "QUICK_WIN":
		ok := isOwner || c.Role == auth.RoleAdmin || (c.Role == auth.RoleLeader && canView(c, idea))
		if !ok {
			writeErr(w, http.StatusForbidden, "forbidden")
			return
		}
		if afterCount == 0 {
			writeErr(w, http.StatusUnprocessableEntity, "upload at least one AFTER photo before completing")
			return
		}
		next = "COMPLETED"
	case "IMPLEMENTING":
		ok := isOwner || c.Role == auth.RoleAdmin || (c.Role == auth.RoleIE && canView(c, idea))
		if !ok {
			writeErr(w, http.StatusForbidden, "forbidden")
			return
		}
		var open int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM kaizen_tasks WHERE idea_id=$1 AND status<>'DONE'`, id).Scan(&open); err != nil {
			internalErr(w, err)
			return
		}
		if open > 0 {
			writeErr(w, http.StatusUnprocessableEntity, fmt.Sprintf("%d task(s) not DONE yet", open))
			return
		}
		if afterCount == 0 {
			writeErr(w, http.StatusUnprocessableEntity, "upload at least one AFTER photo before completing")
			return
		}
		next = "PENDING_FINANCE"
		if _, err := tx.Exec(ctx, `INSERT INTO kaizen_approvals(idea_id, level, approver_role) VALUES ($1,'FINANCE','FINANCE')`, id); err != nil {
			internalErr(w, err)
			return
		}
	default:
		writeErr(w, http.StatusConflict, "cannot complete from status "+idea.Status)
		return
	}
	if _, err := tx.Exec(ctx, `UPDATE kaizen_ideas SET status=$2::varchar, updated_at=now(),
		completed_at = CASE WHEN $2::varchar='COMPLETED' THEN now() ELSE completed_at END WHERE id=$1`, id, next); err != nil {
		internalErr(w, err)
		return
	}
	if next == "COMPLETED" {
		if err := s.grantRewards(ctx, tx, id, c.UserID); err != nil {
			internalErr(w, err)
			return
		}
	}
	if err := audit(ctx, tx, c.UserID, "kaizen", id, "COMPLETE", map[string]string{"next": next}); err != nil {
		internalErr(w, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		internalErr(w, err)
		return
	}
	s.Notify.Send(notify.Event{Type: "kaizen.status_changed", IdeaID: id, Code: idea.Code, Title: idea.Title, Status: next, Message: "Hoàn thành triển khai"})
	writeJSON(w, http.StatusOK, map[string]string{"status": next})
}

func upsertFin(ctx context.Context, tx pgx.Tx, ideaID int64, inv, saving *float64, note string, verify bool, by int64) error {
	if (inv != nil && *inv < 0) || (saving != nil && *saving < 0) {
		return fmt.Errorf("amounts must be >= 0")
	}
	var verifiedBy *int64
	if verify {
		verifiedBy = &by
	}
	_, err := tx.Exec(ctx, `INSERT INTO kaizen_financials(idea_id, investment_cost, annual_saving, note, verified, verified_by, verified_at)
		VALUES ($1, COALESCE($2,0), COALESCE($3,0), NULLIF($4,''), $5::bool, $6, CASE WHEN $5::bool THEN now() END)
		ON CONFLICT (idea_id) DO UPDATE SET
		  investment_cost = COALESCE($2, kaizen_financials.investment_cost),
		  annual_saving   = COALESCE($3, kaizen_financials.annual_saving),
		  note            = COALESCE(NULLIF($4,''), kaizen_financials.note),
		  verified        = kaizen_financials.verified OR $5,
		  verified_by     = COALESCE($6, kaizen_financials.verified_by),
		  verified_at     = CASE WHEN $5 THEN now() ELSE kaizen_financials.verified_at END,
		  updated_at      = now()`, ideaID, inv, saving, note, verify, verifiedBy)
	return err
}

func (s *Server) upsertFinancials(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	ctx := r.Context()
	if !requireRole(w, c, auth.RoleIE, auth.RoleFinance, auth.RoleAdmin) {
		return
	}
	id, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	var in struct {
		InvestmentCost *float64 `json:"investment_cost"`
		AnnualSaving   *float64 `json:"annual_saving"`
		Note           string   `json:"note"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		internalErr(w, err)
		return
	}
	defer tx.Rollback(ctx)
	idea, err := loadIdea(ctx, tx, id, true)
	if err != nil || !canView(c, idea) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if idea.Status == "COMPLETED" || idea.Status == "REJECTED" {
		writeErr(w, http.StatusConflict, "financials are locked")
		return
	}
	if err := upsertFin(ctx, tx, id, in.InvestmentCost, in.AnnualSaving, in.Note, false, 0); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := audit(ctx, tx, c.UserID, "financials", id, "UPSERT", in); err != nil {
		internalErr(w, err)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		internalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// grantRewards: submitter gets points (+ % of verified annual saving for MAJOR projects).
func (s *Server) grantRewards(ctx context.Context, tx pgx.Tx, ideaID, by int64) error {
	var submitter int64
	var kType *string
	var saving float64
	if err := tx.QueryRow(ctx, `SELECT i.submitter_id, i.kaizen_type,
		COALESCE((SELECT annual_saving FROM kaizen_financials f WHERE f.idea_id=i.id AND f.verified),0)::float8
		FROM kaizen_ideas i WHERE i.id=$1`, ideaID).Scan(&submitter, &kType, &saving); err != nil {
		return err
	}
	points, amount, reason := s.Cfg.QuickWinPoints, 0.0, "QUICK_WIN_COMPLETED"
	if kType != nil && *kType == "MAJOR" {
		points, reason = s.Cfg.MajorPoints, "MAJOR_PROJECT_COMPLETED"
		amount = math.Round(saving*s.Cfg.RewardRatePct) / 100
	}
	_, err := tx.Exec(ctx, `INSERT INTO kaizen_rewards(idea_id, user_id, points, amount, reason, granted_by)
		VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`, ideaID, submitter, points, amount, reason, by)
	return err
}
