package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/thinhstudio/kaizensystem/backend/internal/auth"
)

func canManageTasks(c *auth.Claims, i *ideaRow) bool {
	if i.AssigneeID != nil && *i.AssigneeID == c.UserID {
		return true
	}
	return auth.HasRole(c, auth.RoleIE, auth.RoleAdmin, auth.RoleLeader) && canView(c, i)
}

func (s *Server) listTasks(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	id, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	idea, err := loadIdea(r.Context(), s.DB, id, false)
	if err != nil || !canView(c, idea) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	rows, err := queryMaps(r.Context(), s.DB, `SELECT t.id, t.title, t.description, t.status, t.due_date, t.position,
		t.assignee_id, u.full_name AS assignee, t.updated_at
		FROM kaizen_tasks t LEFT JOIN users u ON u.id=t.assignee_id WHERE t.idea_id=$1 ORDER BY t.position, t.id`, id)
	if err != nil {
		internalErr(w, err)
		return
	}
	board := map[string][]map[string]any{"TODO": {}, "IN_PROGRESS": {}, "DONE": {}}
	for _, t := range rows {
		st := t["status"].(string)
		board[st] = append(board[st], t)
	}
	writeJSON(w, http.StatusOK, board)
}

func (s *Server) createTask(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	ctx := r.Context()
	id, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	var in struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		AssigneeID  *int64 `json:"assignee_id"`
		DueDate     string `json:"due_date"`
	}
	if err := decode(r, &in); err != nil || strings.TrimSpace(in.Title) == "" {
		writeErr(w, http.StatusBadRequest, "title required")
		return
	}
	var due *time.Time
	if in.DueDate != "" {
		d, err := time.Parse("2006-01-02", in.DueDate)
		if err != nil {
			writeErr(w, http.StatusBadRequest, "due_date must be YYYY-MM-DD")
			return
		}
		due = &d
	}
	idea, err := loadIdea(ctx, s.DB, id, false)
	if err != nil {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if !canManageTasks(c, idea) {
		writeErr(w, http.StatusForbidden, "forbidden")
		return
	}
	if idea.Status != "IMPLEMENTING" && idea.Status != "QUICK_WIN" && idea.Status != "PENDING_IE" {
		writeErr(w, http.StatusConflict, "tasks can only be added while the kaizen is being implemented")
		return
	}
	var tid int64
	err = s.DB.QueryRow(ctx, `INSERT INTO kaizen_tasks(idea_id, title, description, assignee_id, due_date, position)
		VALUES ($1,$2,NULLIF($3,''),$4,$5,(SELECT COALESCE(MAX(position),0)+1 FROM kaizen_tasks WHERE idea_id=$1))
		RETURNING id`, id, strings.TrimSpace(in.Title), in.Description, in.AssigneeID, due).Scan(&tid)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]int64{"id": tid})
}

var taskTransitions = map[string][]string{
	"TODO":        {"IN_PROGRESS", "DONE"},
	"IN_PROGRESS": {"TODO", "DONE"},
	"DONE":        {"IN_PROGRESS"},
}

func (s *Server) updateTaskStatus(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	ctx := r.Context()
	tid, err := pathID(r, "task_id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	var in struct {
		Status string `json:"status"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	in.Status = strings.ToUpper(in.Status)
	var ideaID int64
	var cur string
	var assignee *int64
	if err := s.DB.QueryRow(ctx, `SELECT idea_id, status, assignee_id FROM kaizen_tasks WHERE id=$1`, tid).Scan(&ideaID, &cur, &assignee); err != nil {
		writeErr(w, http.StatusNotFound, "task not found")
		return
	}
	idea, err := loadIdea(ctx, s.DB, ideaID, false)
	if err != nil {
		internalErr(w, err)
		return
	}
	if !(assignee != nil && *assignee == c.UserID) && !canManageTasks(c, idea) {
		writeErr(w, http.StatusForbidden, "forbidden")
		return
	}
	if idea.Status == "COMPLETED" || idea.Status == "REJECTED" || idea.Status == "PENDING_FINANCE" {
		writeErr(w, http.StatusConflict, "kaizen is closed for task changes")
		return
	}
	valid := false
	for _, s := range taskTransitions[cur] {
		valid = valid || s == in.Status
	}
	if !valid {
		writeErr(w, http.StatusUnprocessableEntity, "invalid transition "+cur+" -> "+in.Status)
		return
	}
	if _, err := s.DB.Exec(ctx, `UPDATE kaizen_tasks SET status=$2, updated_at=now() WHERE id=$1`, tid, in.Status); err != nil {
		internalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": in.Status})
}
