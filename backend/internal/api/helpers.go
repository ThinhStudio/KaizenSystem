package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"

	"github.com/thinhstudio/kaizensystem/backend/internal/auth"
)

type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func internalErr(w http.ResponseWriter, err error) {
	slog.Error("internal error", "err", err)
	writeErr(w, http.StatusInternalServerError, "internal error")
}

func decode(r *http.Request, v any) error {
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20))
	return dec.Decode(v)
}

func pathID(r *http.Request, name string) (int64, error) {
	id, err := strconv.ParseInt(r.PathValue(name), 10, 64)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("invalid %s", name)
	}
	return id, nil
}

func queryMaps(ctx context.Context, q querier, sql string, args ...any) ([]map[string]any, error) {
	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	res, err := pgx.CollectRows(rows, pgx.RowToMap)
	if res == nil {
		res = []map[string]any{}
	}
	return res, err
}

func queryMap(ctx context.Context, q querier, sql string, args ...any) (map[string]any, error) {
	rows, err := queryMaps(ctx, q, sql, args...)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, pgx.ErrNoRows
	}
	return rows[0], nil
}

func isNoRows(err error) bool { return errors.Is(err, pgx.ErrNoRows) }

func audit(ctx context.Context, tx pgx.Tx, actor int64, entity string, id int64, action string, data any) error {
	b, _ := json.Marshal(data)
	_, err := tx.Exec(ctx, `INSERT INTO audit_logs(actor_id, entity, entity_id, action, data) VALUES ($1,$2,$3,$4,$5)`,
		actor, entity, id, action, b)
	return err
}

func requireRole(w http.ResponseWriter, c *auth.Claims, roles ...string) bool {
	if auth.HasRole(c, roles...) {
		return true
	}
	writeErr(w, http.StatusForbidden, "forbidden")
	return false
}

// scopeSQL returns a WHERE fragment (with alias i.) limiting ideas to what the user may see.
//
//	WORKER   -> own ideas
//	LEADER   -> own workshop (+ own ideas)
//	others   -> own factory (or everything when no factory assigned)
func scopeSQL(c *auth.Claims, args *[]any) string {
	add := func(v any) string { *args = append(*args, v); return "$" + strconv.Itoa(len(*args)) }
	switch c.Role {
	case auth.RoleWorker:
		return "i.submitter_id = " + add(c.UserID)
	case auth.RoleLeader:
		if c.WorkshopID != nil {
			uid := add(c.UserID)
			return "(i.workshop_id = " + add(*c.WorkshopID) + " OR i.submitter_id = " + uid + ")"
		}
		return "i.submitter_id = " + add(c.UserID)
	default:
		if c.FactoryID != nil && c.Role != auth.RoleAdmin {
			return "i.factory_id = " + add(*c.FactoryID)
		}
		return "TRUE"
	}
}
