package api

import (
	"context"
	"fmt"
	"mime/multipart"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/thinhstudio/kaizensystem/backend/internal/auth"
	"github.com/thinhstudio/kaizensystem/backend/internal/notify"
)

type ideaRow struct {
	ID          int64
	Code        string
	Title       string
	Status      string
	Type        *string
	SubmitterID int64
	FactoryID   int64
	WorkshopID  int64
	AssigneeID  *int64
}

func loadIdea(ctx context.Context, q querier, id int64, forUpdate bool) (*ideaRow, error) {
	sql := `SELECT id, code, title, status, kaizen_type, submitter_id, factory_id, workshop_id, assignee_id
		FROM kaizen_ideas WHERE id=$1`
	if forUpdate {
		sql += " FOR UPDATE"
	}
	var i ideaRow
	err := q.QueryRow(ctx, sql, id).Scan(&i.ID, &i.Code, &i.Title, &i.Status, &i.Type, &i.SubmitterID,
		&i.FactoryID, &i.WorkshopID, &i.AssigneeID)
	return &i, err
}

func canView(c *auth.Claims, i *ideaRow) bool {
	if i.SubmitterID == c.UserID || (i.AssigneeID != nil && *i.AssigneeID == c.UserID) {
		return true
	}
	switch c.Role {
	case auth.RoleWorker:
		return false
	case auth.RoleLeader:
		return c.WorkshopID != nil && *c.WorkshopID == i.WorkshopID
	case auth.RoleAdmin:
		return true
	default:
		return c.FactoryID == nil || *c.FactoryID == i.FactoryID
	}
}

type kaizenInput struct {
	ClientUUID      *string  `json:"client_uuid"`
	Title           string   `json:"title"`
	Problem         string   `json:"problem"`
	Proposal        string   `json:"proposal"`
	ExpectedBenefit string   `json:"expected_benefit"`
	CategoryID      int64    `json:"category_id"`
	LineID          *int64   `json:"line_id"`
	LineQR          string   `json:"line_qr"`
	EstimatedSaving float64  `json:"estimated_saving"`
	WasteTypes      []string `json:"waste_types"`
	LeanTool        string   `json:"lean_tool"`
	Submit          bool     `json:"submit"`
}

var validWastes = map[string]bool{"DEFECTS": true, "OVERPRODUCTION": true, "WAITING": true, "SKILLS": true,
	"TRANSPORT": true, "INVENTORY": true, "MOTION": true, "OVERPROCESSING": true}
var validTools = map[string]bool{"KAIZEN": true, "5S": true, "POKA_YOKE": true, "KANBAN": true, "JIDOKA": true,
	"SMED": true, "STANDARD_WORK": true, "VISUAL": true, "TPM": true, "OTHER": true}

func (in *kaizenInput) validate() error {
	in.Title, in.Problem, in.Proposal = strings.TrimSpace(in.Title), strings.TrimSpace(in.Problem), strings.TrimSpace(in.Proposal)
	switch {
	case in.Title == "" || len(in.Title) > 255:
		return fmt.Errorf("title required (max 255)")
	case in.Problem == "":
		return fmt.Errorf("problem required")
	case in.Proposal == "":
		return fmt.Errorf("proposal required")
	case in.CategoryID <= 0:
		return fmt.Errorf("category_id required")
	case in.EstimatedSaving < 0:
		return fmt.Errorf("estimated_saving must be >= 0")
	case in.LeanTool != "" && !validTools[in.LeanTool]:
		return fmt.Errorf("invalid lean_tool")
	}
	seen := map[string]bool{}
	clean := []string{}
	for _, w := range in.WasteTypes {
		w = strings.ToUpper(strings.TrimSpace(w))
		if w == "" || seen[w] {
			continue
		}
		if !validWastes[w] {
			return fmt.Errorf("invalid waste type %q", w)
		}
		seen[w] = true
		clean = append(clean, w)
	}
	in.WasteTypes = clean
	return nil
}

func formInput(r *http.Request) kaizenInput {
	f := r.FormValue
	in := kaizenInput{Title: f("title"), Problem: f("problem"), Proposal: f("proposal"),
		ExpectedBenefit: f("expected_benefit"), LineQR: f("line_qr"), Submit: f("submit") == "true"}
	if v := f("client_uuid"); v != "" {
		in.ClientUUID = &v
	}
	in.CategoryID, _ = strconv.ParseInt(f("category_id"), 10, 64)
	if v, err := strconv.ParseInt(f("line_id"), 10, 64); err == nil {
		in.LineID = &v
	}
	in.EstimatedSaving, _ = strconv.ParseFloat(f("estimated_saving"), 64)
	for _, v := range r.Form["waste_types"] {
		in.WasteTypes = append(in.WasteTypes, strings.Split(v, ",")...)
	}
	in.LeanTool = f("lean_tool")
	return in
}

func (s *Server) createKaizen(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	ctx := r.Context()
	var in kaizenInput
	var files []*multipart.FileHeader
	if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/") {
		r.Body = http.MaxBytesReader(w, r.Body, s.Cfg.MaxUploadMB<<20)
		if err := r.ParseMultipartForm(8 << 20); err != nil {
			writeErr(w, http.StatusBadRequest, "invalid multipart: "+err.Error())
			return
		}
		in = formInput(r)
		files = r.MultipartForm.File["before"]
		files = append(files, r.MultipartForm.File["files"]...)
	} else if err := decode(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	if err := in.validate(); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}

	// Offline sync idempotency: same client_uuid -> return existing record.
	if in.ClientUUID != nil {
		var id int64
		if err := s.DB.QueryRow(ctx, `SELECT id FROM kaizen_ideas WHERE client_uuid=$1 AND submitter_id=$2`,
			*in.ClientUUID, c.UserID).Scan(&id); err == nil {
			writeJSON(w, http.StatusOK, map[string]any{"id": id, "duplicate": true})
			return
		}
	}

	// Resolve organisational location: line (by id or QR) -> workshop -> factory; fallback user profile.
	var factoryID, workshopID *int64
	lineID := in.LineID
	if in.LineQR != "" || lineID != nil {
		var lid, wid, fid int64
		err := s.DB.QueryRow(ctx, `SELECT l.id, l.workshop_id, w.factory_id FROM production_lines l
			JOIN workshops w ON w.id=l.workshop_id WHERE l.qr_token::text=$1 OR l.id=$2`, in.LineQR, lineID).Scan(&lid, &wid, &fid)
		if err != nil {
			writeErr(w, http.StatusBadRequest, "unknown production line")
			return
		}
		lineID, workshopID, factoryID = &lid, &wid, &fid
	} else {
		if err := s.DB.QueryRow(ctx, `SELECT u.workshop_id, w.factory_id, u.line_id FROM users u
			LEFT JOIN workshops w ON w.id=u.workshop_id WHERE u.id=$1`, c.UserID).Scan(&workshopID, &factoryID, &lineID); err != nil {
			internalErr(w, err)
			return
		}
	}
	if workshopID == nil || factoryID == nil {
		writeErr(w, http.StatusBadRequest, "line_id/line_qr required (user has no workshop)")
		return
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		internalErr(w, err)
		return
	}
	defer tx.Rollback(ctx)

	var id int64
	var code string
	err = tx.QueryRow(ctx, `INSERT INTO kaizen_ideas (code, client_uuid, title, problem, proposal, expected_benefit,
		category_id, submitter_id, factory_id, workshop_id, line_id, estimated_saving, waste_types, lean_tool)
		VALUES ('KZ-' || to_char(now(),'YYYY') || '-' || lpad(nextval('kaizen_code_seq')::text, 6, '0'),
		        $1,$2,$3,$4,NULLIF($5,''),$6,$7,$8,$9,$10,$11,$12,NULLIF($13,''))
		RETURNING id, code`,
		in.ClientUUID, in.Title, in.Problem, in.Proposal, in.ExpectedBenefit, in.CategoryID, c.UserID,
		*factoryID, *workshopID, lineID, in.EstimatedSaving, in.WasteTypes, in.LeanTool).Scan(&id, &code)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "cannot create kaizen: "+err.Error())
		return
	}
	if err := s.saveFiles(ctx, tx, id, c.UserID, "BEFORE", files); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := audit(ctx, tx, c.UserID, "kaizen", id, "CREATE", map[string]any{"title": in.Title}); err != nil {
		internalErr(w, err)
		return
	}
	status := "DRAFT"
	if in.Submit {
		if err := submitTx(ctx, tx, c.UserID, id, *workshopID); err != nil {
			internalErr(w, err)
			return
		}
		status = "PENDING_LEADER"
	}
	if err := tx.Commit(ctx); err != nil {
		internalErr(w, err)
		return
	}
	if in.Submit {
		s.Notify.Send(notify.Event{Type: "kaizen.submitted", IdeaID: id, Code: code, Title: in.Title,
			Status: status, Message: "Sáng kiến mới chờ Tổ trưởng sơ duyệt"})
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "code": code, "status": status})
}

var allowedMime = map[string]bool{"image/jpeg": true, "image/png": true, "image/webp": true, "image/heic": true,
	"video/mp4": true, "video/quicktime": true, "video/webm": true, "application/pdf": true}

func (s *Server) saveFiles(ctx context.Context, tx pgx.Tx, ideaID, uid int64, phase string, files []*multipart.FileHeader) error {
	for _, fh := range files {
		ct := fh.Header.Get("Content-Type")
		if !allowedMime[ct] {
			return fmt.Errorf("file type not allowed: %s", ct)
		}
		f, err := fh.Open()
		if err != nil {
			return err
		}
		key := fmt.Sprintf("kaizen/%d/%s/%d%s", ideaID, strings.ToLower(phase), time.Now().UnixNano(), strings.ToLower(path.Ext(fh.Filename)))
		n, err := s.Store.Put(key, f)
		f.Close()
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO kaizen_attachments(idea_id, phase, object_key, file_name, content_type, size_bytes, uploaded_by)
			VALUES ($1,$2,$3,$4,$5,$6,$7)`, ideaID, phase, key, path.Base(fh.Filename), ct, n, uid); err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) listKaizens(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	q := r.URL.Query()
	args := []any{}
	add := func(v any) string { args = append(args, v); return "$" + strconv.Itoa(len(args)) }
	where := []string{scopeSQL(c, &args)}
	if v := q.Get("status"); v != "" {
		where = append(where, "i.status = ANY(string_to_array("+add(v)+", ','))")
	}
	if v, err := strconv.ParseInt(q.Get("workshop_id"), 10, 64); err == nil {
		where = append(where, "i.workshop_id = "+add(v))
	}
	if v, err := strconv.ParseInt(q.Get("category_id"), 10, 64); err == nil {
		where = append(where, "i.category_id = "+add(v))
	}
	if v, err := time.Parse("2006-01-02", q.Get("from")); err == nil {
		where = append(where, "i.created_at >= "+add(v))
	}
	if v, err := time.Parse("2006-01-02", q.Get("to")); err == nil {
		where = append(where, "i.created_at < "+add(v.AddDate(0, 0, 1)))
	}
	if q.Get("mine") == "true" {
		where = append(where, "i.submitter_id = "+add(c.UserID))
	}
	if v := strings.ToUpper(q.Get("waste")); validWastes[v] {
		where = append(where, add(v)+" = ANY(i.waste_types)")
	}
	if v := q.Get("type"); v == "QUICK_WIN" || v == "MAJOR" {
		where = append(where, "i.kaizen_type = "+add(v))
	}
	if v := strings.TrimSpace(q.Get("q")); v != "" {
		p := add("%" + v + "%")
		where = append(where, "(i.title ILIKE "+p+" OR i.code ILIKE "+p+")")
	}
	page, _ := strconv.Atoi(q.Get("page"))
	size, _ := strconv.Atoi(q.Get("page_size"))
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 100 {
		size = 20
	}
	cond := strings.Join(where, " AND ")

	var total int64
	if err := s.DB.QueryRow(r.Context(), "SELECT count(*) FROM kaizen_ideas i WHERE "+cond, args...).Scan(&total); err != nil {
		internalErr(w, err)
		return
	}
	lim, off := add(size), add((page-1)*size)
	items, err := queryMaps(r.Context(), s.DB, `SELECT i.id, i.code, i.title, i.status, i.kaizen_type,
		i.estimated_saving::float8 AS estimated_saving, i.created_at, i.submitted_at, i.completed_at,
		i.waste_types, i.lean_tool, i.category_id, i.submitter_id, i.assignee_id,
		(SELECT count(*) FROM kaizen_likes k WHERE k.idea_id=i.id) AS like_count,
		(SELECT count(*) FROM kaizen_comments k WHERE k.idea_id=i.id) AS comment_count,
		c.name AS category, w.name AS workshop, l.name AS line, u.full_name AS submitter,
		(SELECT a.id FROM kaizen_attachments a WHERE a.idea_id=i.id AND a.content_type LIKE 'image/%' ORDER BY a.id LIMIT 1) AS thumb_id
		FROM kaizen_ideas i
		JOIN kaizen_categories c ON c.id=i.category_id
		JOIN workshops w ON w.id=i.workshop_id
		LEFT JOIN production_lines l ON l.id=i.line_id
		JOIN users u ON u.id=i.submitter_id
		WHERE `+cond+` ORDER BY i.created_at DESC LIMIT `+lim+` OFFSET `+off, args...)
	if err != nil {
		internalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "page": page, "page_size": size, "total": total})
}

func (s *Server) getKaizen(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	ctx := r.Context()
	id, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	idea, err := loadIdea(ctx, s.DB, id, false)
	if isNoRows(err) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	} else if err != nil {
		internalErr(w, err)
		return
	}
	if !canView(c, idea) {
		writeErr(w, http.StatusForbidden, "forbidden")
		return
	}
	detail, err := queryMap(ctx, s.DB, `SELECT i.id, i.code, i.title, i.problem, i.proposal, i.expected_benefit,
		i.status, i.kaizen_type, i.estimated_saving::float8 AS estimated_saving, i.category_id, c.name AS category,
		i.factory_id, i.workshop_id, w.name AS workshop, i.line_id, l.name AS line,
		i.submitter_id, u.full_name AS submitter, i.assignee_id, a.full_name AS assignee,
		i.submitted_at, i.completed_at, i.created_at, i.updated_at, i.waste_types, i.lean_tool,
		(SELECT count(*) FROM kaizen_likes k WHERE k.idea_id=i.id) AS like_count,
		EXISTS(SELECT 1 FROM kaizen_likes k WHERE k.idea_id=i.id AND k.user_id=$2) AS liked
		FROM kaizen_ideas i JOIN kaizen_categories c ON c.id=i.category_id JOIN workshops w ON w.id=i.workshop_id
		LEFT JOIN production_lines l ON l.id=i.line_id JOIN users u ON u.id=i.submitter_id
		LEFT JOIN users a ON a.id=i.assignee_id WHERE i.id=$1`, id, c.UserID)
	if err != nil {
		internalErr(w, err)
		return
	}
	parts := []struct {
		key, sql string
	}{
		{"attachments", `SELECT id, phase, file_name, content_type, size_bytes, created_at FROM kaizen_attachments WHERE idea_id=$1 ORDER BY id`},
		{"approvals", `SELECT ap.id, ap.level, ap.status, ap.comment, ap.acted_at, ap.created_at, u.full_name AS acted_by
			FROM kaizen_approvals ap LEFT JOIN users u ON u.id=ap.acted_by WHERE ap.idea_id=$1 ORDER BY ap.id`},
		{"tasks", `SELECT t.id, t.title, t.description, t.status, t.due_date, t.position, t.assignee_id, u.full_name AS assignee
			FROM kaizen_tasks t LEFT JOIN users u ON u.id=t.assignee_id WHERE t.idea_id=$1 ORDER BY t.position, t.id`},
		{"comments", `SELECT cm.id, cm.body, cm.created_at, cm.user_id, u.full_name, u.role
			FROM kaizen_comments cm JOIN users u ON u.id=cm.user_id WHERE cm.idea_id=$1 ORDER BY cm.id`},
		{"rewards", `SELECT r.id, r.user_id, u.full_name, r.points, r.amount::float8 AS amount, r.reason, r.status, r.created_at
			FROM kaizen_rewards r JOIN users u ON u.id=r.user_id WHERE r.idea_id=$1 ORDER BY r.id`},
	}
	for _, p := range parts {
		rows, err := queryMaps(ctx, s.DB, p.sql, id)
		if err != nil {
			internalErr(w, err)
			return
		}
		detail[p.key] = rows
	}
	fin, err := queryMap(ctx, s.DB, `SELECT investment_cost::float8 AS investment_cost, annual_saving::float8 AS annual_saving,
		currency, roi_percent::float8 AS roi_percent, payback_months::float8 AS payback_months, verified, verified_at, note
		FROM kaizen_financials WHERE idea_id=$1`, id)
	if err != nil && !isNoRows(err) {
		internalErr(w, err)
		return
	}
	detail["financials"] = fin
	writeJSON(w, http.StatusOK, detail)
}

func (s *Server) updateKaizen(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	ctx := r.Context()
	id, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	var in kaizenInput
	if err := decode(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	if err := in.validate(); err != nil {
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
	if isNoRows(err) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	} else if err != nil {
		internalErr(w, err)
		return
	}
	if idea.SubmitterID != c.UserID {
		writeErr(w, http.StatusForbidden, "only the submitter can edit")
		return
	}
	if idea.Status != "DRAFT" && idea.Status != "REVISION_REQUESTED" {
		writeErr(w, http.StatusConflict, "kaizen can only be edited in DRAFT or REVISION_REQUESTED")
		return
	}
	if _, err := tx.Exec(ctx, `UPDATE kaizen_ideas SET title=$2, problem=$3, proposal=$4, expected_benefit=NULLIF($5,''),
		category_id=$6, estimated_saving=$7, waste_types=$8, lean_tool=NULLIF($9,''), updated_at=now() WHERE id=$1`,
		id, in.Title, in.Problem, in.Proposal, in.ExpectedBenefit, in.CategoryID, in.EstimatedSaving, in.WasteTypes, in.LeanTool); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := audit(ctx, tx, c.UserID, "kaizen", id, "UPDATE", in); err != nil {
		internalErr(w, err)
		return
	}
	if in.Submit {
		if err := submitTx(ctx, tx, c.UserID, id, idea.WorkshopID); err != nil {
			internalErr(w, err)
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		internalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": id})
}

func (s *Server) uploadAttachments(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	ctx := r.Context()
	id, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, s.Cfg.MaxUploadMB<<20)
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid multipart")
		return
	}
	phase := strings.ToUpper(r.FormValue("phase"))
	if phase != "BEFORE" && phase != "AFTER" && phase != "OTHER" {
		writeErr(w, http.StatusBadRequest, "phase must be BEFORE, AFTER or OTHER")
		return
	}
	idea, err := loadIdea(ctx, s.DB, id, false)
	if isNoRows(err) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	} else if err != nil {
		internalErr(w, err)
		return
	}
	if !canView(c, idea) || idea.Status == "COMPLETED" || idea.Status == "REJECTED" {
		writeErr(w, http.StatusForbidden, "cannot attach files to this kaizen")
		return
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		internalErr(w, err)
		return
	}
	defer tx.Rollback(ctx)
	if err := s.saveFiles(ctx, tx, id, c.UserID, phase, r.MultipartForm.File["files"]); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := tx.Commit(ctx); err != nil {
		internalErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"uploaded": len(r.MultipartForm.File["files"])})
}

func (s *Server) downloadAttachment(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	ctx := r.Context()
	id, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	var ideaID int64
	var key, name, ct string
	if err := s.DB.QueryRow(ctx, `SELECT idea_id, object_key, file_name, content_type FROM kaizen_attachments WHERE id=$1`, id).
		Scan(&ideaID, &key, &name, &ct); err != nil {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	idea, err := loadIdea(ctx, s.DB, ideaID, false)
	if err != nil || !canView(c, idea) {
		writeErr(w, http.StatusForbidden, "forbidden")
		return
	}
	f, err := s.Store.Open(key)
	if err != nil {
		writeErr(w, http.StatusNotFound, "file missing")
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Cache-Control", "private, max-age=86400")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, name, time.Time{}, f)
}
