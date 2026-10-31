package api

import (
	"net/http"
	"strings"

	"github.com/thinhstudio/kaizensystem/backend/internal/auth"
)

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var in struct {
		EmployeeCode string `json:"employee_code"`
		Password     string `json:"password"`
	}
	if err := decode(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	var (
		c    auth.Claims
		hash string
	)
	err := s.DB.QueryRow(r.Context(), `SELECT id, role, factory_id, workshop_id, full_name, password_hash
		FROM users WHERE employee_code=$1 AND is_active`, strings.TrimSpace(in.EmployeeCode)).
		Scan(&c.UserID, &c.Role, &c.FactoryID, &c.WorkshopID, &c.Name, &hash)
	if err != nil || !auth.CheckPassword(hash, in.Password) {
		writeErr(w, http.StatusUnauthorized, "sai mã nhân viên hoặc mật khẩu")
		return
	}
	tok, err := s.Auth.Issue(c)
	if err != nil {
		internalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": tok, "user": c})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	u, err := queryMap(r.Context(), s.DB, `SELECT u.id, u.employee_code, u.full_name, u.email, u.role,
		u.factory_id, u.workshop_id, u.line_id, w.name AS workshop_name,
		COALESCE((SELECT SUM(points) FROM kaizen_rewards WHERE user_id=u.id AND status<>'CANCELLED'),0)::int AS total_points
		FROM users u LEFT JOIN workshops w ON w.id=u.workshop_id WHERE u.id=$1`, c.UserID)
	if err != nil {
		internalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (s *Server) myRewards(w http.ResponseWriter, r *http.Request) {
	c := auth.FromContext(r.Context())
	rows, err := queryMaps(r.Context(), s.DB, `SELECT rw.id, rw.idea_id, i.code, i.title, rw.points, rw.amount::float8 AS amount,
		rw.reason, rw.status, rw.created_at FROM kaizen_rewards rw JOIN kaizen_ideas i ON i.id=rw.idea_id
		WHERE rw.user_id=$1 ORDER BY rw.created_at DESC`, c.UserID)
	if err != nil {
		internalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

func (s *Server) listCategories(w http.ResponseWriter, r *http.Request) {
	rows, err := queryMaps(r.Context(), s.DB, `SELECT id, code, name, description FROM kaizen_categories WHERE is_active ORDER BY id`)
	if err != nil {
		internalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

func (s *Server) masterData(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	f, err1 := queryMaps(ctx, s.DB, `SELECT id, code, name FROM factories ORDER BY code`)
	ws, err2 := queryMaps(ctx, s.DB, `SELECT id, factory_id, code, name FROM workshops ORDER BY code`)
	ls, err3 := queryMaps(ctx, s.DB, `SELECT id, workshop_id, code, name, qr_token::text AS qr_token FROM production_lines ORDER BY code`)
	for _, e := range []error{err1, err2, err3} {
		if e != nil {
			internalErr(w, e)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"factories": f, "workshops": ws, "lines": ls})
}

func (s *Server) lineByQR(w http.ResponseWriter, r *http.Request) {
	l, err := queryMap(r.Context(), s.DB, `SELECT l.id, l.code, l.name, l.workshop_id, w.name AS workshop_name, w.factory_id
		FROM production_lines l JOIN workshops w ON w.id=l.workshop_id WHERE l.qr_token::text=$1`, r.PathValue("token"))
	if isNoRows(err) {
		writeErr(w, http.StatusNotFound, "line not found")
		return
	} else if err != nil {
		internalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, l)
}

// ---------------- admin ----------------

func (s *Server) adminListUsers(w http.ResponseWriter, r *http.Request) {
	if !requireRole(w, auth.FromContext(r.Context()), auth.RoleAdmin) {
		return
	}
	rows, err := queryMaps(r.Context(), s.DB, `SELECT id, employee_code, full_name, email, role, factory_id, workshop_id, line_id, is_active, created_at
		FROM users ORDER BY id`)
	if err != nil {
		internalErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

func (s *Server) adminCreateUser(w http.ResponseWriter, r *http.Request) {
	if !requireRole(w, auth.FromContext(r.Context()), auth.RoleAdmin) {
		return
	}
	var in struct {
		EmployeeCode string `json:"employee_code"`
		FullName     string `json:"full_name"`
		Email        string `json:"email"`
		Password     string `json:"password"`
		Role         string `json:"role"`
		FactoryID    *int64 `json:"factory_id"`
		WorkshopID   *int64 `json:"workshop_id"`
		LineID       *int64 `json:"line_id"`
	}
	if err := decode(r, &in); err != nil || in.EmployeeCode == "" || in.FullName == "" || len(in.Password) < 6 {
		writeErr(w, http.StatusBadRequest, "employee_code, full_name, password (>=6) required")
		return
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		internalErr(w, err)
		return
	}
	var id int64
	err = s.DB.QueryRow(r.Context(), `INSERT INTO users(employee_code, full_name, email, password_hash, role, factory_id, workshop_id, line_id)
		VALUES ($1,$2,NULLIF($3,''),$4,$5,$6,$7,$8) RETURNING id`,
		in.EmployeeCode, in.FullName, in.Email, hash, strings.ToUpper(in.Role), in.FactoryID, in.WorkshopID, in.LineID).Scan(&id)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]int64{"id": id})
}

type codeName struct {
	ParentID int64  `json:"parent_id"`
	Code     string `json:"code"`
	Name     string `json:"name"`
}

func (s *Server) adminCreate(w http.ResponseWriter, r *http.Request, sql string, needParent bool) {
	if !requireRole(w, auth.FromContext(r.Context()), auth.RoleAdmin) {
		return
	}
	var in codeName
	if err := decode(r, &in); err != nil || in.Code == "" || in.Name == "" || (needParent && in.ParentID == 0) {
		writeErr(w, http.StatusBadRequest, "code, name (and parent_id) required")
		return
	}
	args := []any{in.Code, in.Name}
	if needParent {
		args = append(args, in.ParentID)
	}
	var id int64
	if err := s.DB.QueryRow(r.Context(), sql, args...).Scan(&id); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]int64{"id": id})
}

func (s *Server) adminCreateFactory(w http.ResponseWriter, r *http.Request) {
	s.adminCreate(w, r, `INSERT INTO factories(code,name) VALUES ($1,$2) RETURNING id`, false)
}
func (s *Server) adminCreateWorkshop(w http.ResponseWriter, r *http.Request) {
	s.adminCreate(w, r, `INSERT INTO workshops(code,name,factory_id) VALUES ($1,$2,$3) RETURNING id`, true)
}
func (s *Server) adminCreateLine(w http.ResponseWriter, r *http.Request) {
	s.adminCreate(w, r, `INSERT INTO production_lines(code,name,workshop_id) VALUES ($1,$2,$3) RETURNING id`, true)
}
func (s *Server) adminCreateCategory(w http.ResponseWriter, r *http.Request) {
	s.adminCreate(w, r, `INSERT INTO kaizen_categories(code,name) VALUES ($1,$2) RETURNING id`, false)
}
