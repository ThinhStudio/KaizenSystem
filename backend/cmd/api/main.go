package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/thinhstudio/kaizensystem/backend/internal/api"
	"github.com/thinhstudio/kaizensystem/backend/internal/auth"
	"github.com/thinhstudio/kaizensystem/backend/internal/config"
	"github.com/thinhstudio/kaizensystem/backend/internal/db"
	"github.com/thinhstudio/kaizensystem/backend/internal/notify"
	"github.com/thinhstudio/kaizensystem/backend/internal/storage"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	cfg := config.Load()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	var pool *pgxpool.Pool
	var err error
	for i := 0; i < 30; i++ { // wait for DB container
		if pool, err = db.Connect(ctx, cfg.DatabaseURL); err == nil {
			break
		}
		slog.Warn("waiting for database", "err", err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		slog.Error("db connect", "err", err)
		os.Exit(1)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		slog.Error("migrate", "err", err)
		os.Exit(1)
	}
	if err := seed(ctx, pool, cfg); err != nil {
		slog.Error("seed", "err", err)
		os.Exit(1)
	}

	store, err := storage.NewLocal(cfg.StorageDir)
	if err != nil {
		slog.Error("storage", "err", err)
		os.Exit(1)
	}
	srv := &api.Server{
		DB:     pool,
		Auth:   auth.NewManager(cfg.JWTSecret, time.Duration(cfg.JWTTTLHours)*time.Hour),
		Store:  store,
		Notify: notify.New(cfg.TelegramToken, cfg.TelegramChatID, cfg.WebhookURL),
		Cfg:    cfg,
	}
	httpSrv := &http.Server{Addr: cfg.Addr, Handler: srv.Routes(), ReadHeaderTimeout: 10 * time.Second}
	go func() {
		slog.Info("listening", "addr", cfg.Addr)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("http", "err", err)
			stop()
		}
	}()
	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutdown)
}

// seed ensures an admin account exists, and optionally loads demo org data + users.
func seed(ctx context.Context, pool *pgxpool.Pool, cfg config.Config) error {
	hash, err := auth.HashPassword(cfg.AdminPassword)
	if err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, `INSERT INTO users(employee_code, full_name, password_hash, role)
		VALUES ($1,'System Admin',$2,'ADMIN') ON CONFLICT (employee_code) DO NOTHING`, cfg.AdminCode, hash); err != nil {
		return err
	}
	if !cfg.SeedDemo {
		return nil
	}
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM factories`).Scan(&n); err != nil || n > 0 {
		return err
	}
	demoHash, _ := auth.HashPassword("123456")
	_, err = pool.Exec(ctx, `
		WITH f AS (INSERT INTO factories(code,name) VALUES ('F1','Nhà máy Tây Ninh') RETURNING id),
		w AS (INSERT INTO workshops(factory_id,code,name) SELECT id,'WS-A','Xưởng May A' FROM f RETURNING id, factory_id),
		l AS (INSERT INTO production_lines(workshop_id,code,name) SELECT id,'L01','Chuyền 01' FROM w RETURNING id, workshop_id)
		INSERT INTO users(employee_code, full_name, password_hash, role, factory_id, workshop_id, line_id)
		SELECT v.code, v.name, $1, v.role, w.factory_id,
		       CASE WHEN v.role IN ('WORKER','LEADER') THEN w.id END,
		       CASE WHEN v.role='WORKER' THEN l.id END
		FROM w, l, (VALUES ('CN001','Nguyễn Văn Công','WORKER'),
		                   ('TT001','Trần Thị Tổ Trưởng','LEADER'),
		                   ('IE001','Lê Văn IE','IE'),
		                   ('KT001','Phạm Thị Kế Toán','FINANCE'),
		                   ('GD001','Võ Giám Đốc','DIRECTOR')) AS v(code,name,role)`, demoHash)
	return err
}
