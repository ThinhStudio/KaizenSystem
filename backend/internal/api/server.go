package api

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/thinhstudio/kaizensystem/backend/internal/auth"
	"github.com/thinhstudio/kaizensystem/backend/internal/config"
	"github.com/thinhstudio/kaizensystem/backend/internal/notify"
	"github.com/thinhstudio/kaizensystem/backend/internal/storage"
)

type Server struct {
	DB     *pgxpool.Pool
	Auth   *auth.Manager
	Store  storage.Store
	Notify *notify.Notifier
	Cfg    config.Config
}

func (s *Server) Routes() http.Handler {
	pub := http.NewServeMux()
	pub.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		if err := s.DB.Ping(r.Context()); err != nil {
			writeErr(w, http.StatusServiceUnavailable, "db down")
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	pub.HandleFunc("POST /api/v1/auth/login", s.login)

	p := http.NewServeMux() // authenticated
	p.HandleFunc("GET /api/v1/auth/me", s.me)
	p.HandleFunc("GET /api/v1/me/rewards", s.myRewards)

	// master data
	p.HandleFunc("GET /api/v1/categories", s.listCategories)
	p.HandleFunc("GET /api/v1/master", s.masterData)
	p.HandleFunc("GET /api/v1/lines/qr/{token}", s.lineByQR)

	// A. kaizens
	p.HandleFunc("POST /api/v1/kaizens", s.createKaizen)
	p.HandleFunc("GET /api/v1/kaizens", s.listKaizens)
	p.HandleFunc("GET /api/v1/kaizens/{id}", s.getKaizen)
	p.HandleFunc("PUT /api/v1/kaizens/{id}", s.updateKaizen)
	p.HandleFunc("POST /api/v1/kaizens/{id}/submit", s.submitKaizen)
	p.HandleFunc("POST /api/v1/kaizens/{id}/complete", s.completeKaizen)
	p.HandleFunc("POST /api/v1/kaizens/{id}/attachments", s.uploadAttachments)
	p.HandleFunc("PUT /api/v1/kaizens/{id}/financials", s.upsertFinancials)
	p.HandleFunc("GET /api/v1/attachments/{id}/file", s.downloadAttachment)

	// B. approvals
	p.HandleFunc("GET /api/v1/approvals/pending", s.pendingApprovals)
	p.HandleFunc("POST /api/v1/approvals/{approval_id}/action", s.approvalAction)

	// C. kanban tasks
	p.HandleFunc("GET /api/v1/kaizens/{id}/tasks", s.listTasks)
	p.HandleFunc("POST /api/v1/kaizens/{id}/tasks", s.createTask)
	p.HandleFunc("PATCH /api/v1/kaizens/tasks/{task_id}/status", s.updateTaskStatus)

	// D. reports
	p.HandleFunc("GET /api/v1/reports/summary", s.reportSummary)
	p.HandleFunc("GET /api/v1/reports/roi", s.reportROI)
	p.HandleFunc("GET /api/v1/reports/trend", s.reportTrend)
	p.HandleFunc("GET /api/v1/reports/wastes", s.reportWastes)
	p.HandleFunc("GET /api/v1/reports/leaderboard", s.leaderboard)
	p.HandleFunc("GET /api/v1/reports/export.csv", s.exportCSV)
	p.HandleFunc("GET /api/v1/activity", s.activity)
	p.HandleFunc("POST /api/v1/kaizens/{id}/comments", s.addComment)
	p.HandleFunc("POST /api/v1/kaizens/{id}/like", s.toggleLike)

	// admin
	p.HandleFunc("GET /api/v1/admin/users", s.adminListUsers)
	p.HandleFunc("POST /api/v1/admin/users", s.adminCreateUser)
	p.HandleFunc("POST /api/v1/admin/factories", s.adminCreateFactory)
	p.HandleFunc("POST /api/v1/admin/workshops", s.adminCreateWorkshop)
	p.HandleFunc("POST /api/v1/admin/lines", s.adminCreateLine)
	p.HandleFunc("POST /api/v1/admin/categories", s.adminCreateCategory)

	root := http.NewServeMux()
	root.Handle("/healthz", pub)
	root.Handle("/api/v1/auth/login", pub)
	root.Handle("/api/", s.Auth.Middleware(p))
	root.Handle("/", staticHandler(s.Cfg.WebDir))
	return logging(root)
}

func staticHandler(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/sw.js" {
			w.Header().Set("Cache-Control", "no-cache")
		}
		fs.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	code int
}

func (s *statusRecorder) WriteHeader(c int) { s.code = c; s.ResponseWriter.WriteHeader(c) }

func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, code: 200}
		next.ServeHTTP(rec, r)
		slog.Info("http", "method", r.Method, "path", r.URL.Path, "status", rec.code, "dur_ms", time.Since(start).Milliseconds())
	})
}
