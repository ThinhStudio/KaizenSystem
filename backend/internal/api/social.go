package api

import (
	"net/http"
	"strings"

	"github.com/thinhstudio/kaizensystem/backend/internal/auth"
	"github.com/thinhstudio/kaizensystem/backend/internal/notify"
)

func (s *Server) visibleIdea(w http.ResponseWriter, r *http.Request) (*ideaRow, bool) {
	id, err := pathID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return nil, false
	}
	idea, err := loadIdea(r.Context(), s.DB, id, false)
	if err != nil || !canView(auth.FromContext(r.Context()), idea) {
		writeErr(w, http.StatusNotFound, "not found")
		return nil, false
	}
	return idea, true
}

func (s *Server) addComment(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	idea, ok := s.visibleIdea(w, r)
	if !ok {
		return
	}
	var in struct {
		Body string `json:"body"`
	}
	if err := decode(r, &in); err != nil || strings.TrimSpace(in.Body) == "" || len(in.Body) > 2000 {
		writeErr(w, http.StatusBadRequest, "body required (max 2000)")
		return
	}
	var id int64
	if err := s.DB.QueryRow(r.Context(), `INSERT INTO kaizen_comments(idea_id, user_id, body) VALUES ($1,$2,$3) RETURNING id`,
		idea.ID, c.UserID, strings.TrimSpace(in.Body)).Scan(&id); err != nil {
		internalErr(w, err)
		return
	}
	s.Notify.Send(notify.Event{Type: "kaizen.commented", IdeaID: idea.ID, Code: idea.Code, Title: idea.Title, Status: idea.Status,
		Message: c.Name + ": " + in.Body})
	writeJSON(w, http.StatusCreated, map[string]int64{"id": id})
}

func (s *Server) toggleLike(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	idea, ok := s.visibleIdea(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	tag, err := s.DB.Exec(ctx, `DELETE FROM kaizen_likes WHERE idea_id=$1 AND user_id=$2`, idea.ID, c.UserID)
	if err != nil {
		internalErr(w, err)
		return
	}
	liked := false
	if tag.RowsAffected() == 0 {
		if _, err := s.DB.Exec(ctx, `INSERT INTO kaizen_likes(idea_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, idea.ID, c.UserID); err != nil {
			internalErr(w, err)
			return
		}
		liked = true
	}
	var n int64
	_ = s.DB.QueryRow(ctx, `SELECT count(*) FROM kaizen_likes WHERE idea_id=$1`, idea.ID).Scan(&n)
	writeJSON(w, http.StatusOK, map[string]any{"liked": liked, "like_count": n})
}

// activity: recent lifecycle events visible to the caller.
func (s *Server) activity(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	args := []any{}
	cond := scopeSQL(c, &args)
	rows, err := queryMaps(r.Context(), s.DB, `SELECT * FROM (
		SELECT i.submitted_at AS at, 'SUBMITTED' AS kind, i.id AS idea_id, i.code, i.title, u.full_name AS actor, NULL::text AS detail
		  FROM kaizen_ideas i JOIN users u ON u.id=i.submitter_id WHERE i.submitted_at IS NOT NULL AND `+cond+`
		UNION ALL
		SELECT ap.acted_at, ap.level || '_' || ap.status, i.id, i.code, i.title, u.full_name, ap.comment
		  FROM kaizen_approvals ap JOIN kaizen_ideas i ON i.id=ap.idea_id JOIN users u ON u.id=ap.acted_by
		  WHERE ap.acted_at IS NOT NULL AND `+cond+`
		UNION ALL
		SELECT cm.created_at, 'COMMENT', i.id, i.code, i.title, u.full_name, left(cm.body, 140)
		  FROM kaizen_comments cm JOIN kaizen_ideas i ON i.id=cm.idea_id JOIN users u ON u.id=cm.user_id WHERE `+cond+`
		UNION ALL
		SELECT i.completed_at, 'COMPLETED', i.id, i.code, i.title, u.full_name, NULL
		  FROM kaizen_ideas i JOIN users u ON u.id=i.submitter_id WHERE i.completed_at IS NOT NULL AND `+cond+`
	) a ORDER BY at DESC LIMIT 30`, args...)
	if err != nil {
		internalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, rows)
}
