package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const (
	RoleWorker   = "WORKER"
	RoleLeader   = "LEADER"
	RoleIE       = "IE"
	RoleFinance  = "FINANCE"
	RoleDirector = "DIRECTOR"
	RoleAdmin    = "ADMIN"
)

type Claims struct {
	UserID     int64  `json:"uid"`
	Role       string `json:"role"`
	FactoryID  *int64 `json:"fid,omitempty"`
	WorkshopID *int64 `json:"wid,omitempty"`
	Name       string `json:"name"`
	jwt.RegisteredClaims
}

type Manager struct {
	secret []byte
	ttl    time.Duration
}

func NewManager(secret string, ttl time.Duration) *Manager {
	return &Manager{secret: []byte(secret), ttl: ttl}
}

func (m *Manager) Issue(c Claims) (string, error) {
	now := time.Now()
	c.RegisteredClaims = jwt.RegisteredClaims{
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(m.ttl)),
		Issuer:    "digital-kaizen",
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(m.secret)
}

func (m *Manager) Parse(tok string) (*Claims, error) {
	c := &Claims{}
	_, err := jwt.ParseWithClaims(tok, c, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return m.secret, nil
	})
	if err != nil {
		return nil, err
	}
	return c, nil
}

type ctxKey struct{}

func FromContext(ctx context.Context) *Claims {
	c, _ := ctx.Value(ctxKey{}).(*Claims)
	return c
}

// Middleware rejects requests without a valid Bearer token.
func (m *Manager) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := r.Header.Get("Authorization")
		tok, ok := strings.CutPrefix(h, "Bearer ")
		if !ok {
			// allow ?token= for <img src> of attachments
			tok = r.URL.Query().Get("token")
		}
		if tok == "" {
			http.Error(w, `{"error":"missing token"}`, http.StatusUnauthorized)
			return
		}
		c, err := m.Parse(tok)
		if err != nil {
			http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, c)))
	})
}

func HasRole(c *Claims, roles ...string) bool {
	if c == nil {
		return false
	}
	for _, r := range roles {
		if c.Role == r {
			return true
		}
	}
	return false
}

func HashPassword(p string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(p), bcrypt.DefaultCost)
	return string(b), err
}

func CheckPassword(hash, p string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(p)) == nil
}
