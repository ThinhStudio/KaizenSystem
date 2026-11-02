package config

import (
	"os"
	"strconv"
)

type Config struct {
	Addr           string
	DatabaseURL    string
	JWTSecret      string
	JWTTTLHours    int
	StorageDir     string
	WebDir         string
	MaxUploadMB    int64
	TelegramToken  string
	TelegramChatID string
	WebhookURL     string // generic webhook (Zalo OA bridge, Slack, n8n ...)
	AdminCode      string
	AdminPassword  string
	SeedDemo       bool
	QuickWinPoints int
	MajorPoints    int
	RewardRatePct  float64 // % of verified annual saving paid as bonus
}

func Load() Config {
	return Config{
		Addr:           env("ADDR", ":8080"),
		DatabaseURL:    env("DATABASE_URL", "postgres://kaizen:kaizen@localhost:5432/kaizen?sslmode=disable"),
		JWTSecret:      env("JWT_SECRET", "change-me-in-production"),
		JWTTTLHours:    envInt("JWT_TTL_HOURS", 12),
		StorageDir:     env("STORAGE_DIR", "./data/uploads"),
		WebDir:         env("WEB_DIR", "./web"),
		MaxUploadMB:    int64(envInt("MAX_UPLOAD_MB", 25)),
		TelegramToken:  os.Getenv("TELEGRAM_BOT_TOKEN"),
		TelegramChatID: os.Getenv("TELEGRAM_CHAT_ID"),
		WebhookURL:     os.Getenv("NOTIFY_WEBHOOK_URL"),
		AdminCode:      env("ADMIN_CODE", "admin"),
		AdminPassword:  env("ADMIN_PASSWORD", "admin123"),
		SeedDemo:       env("SEED_DEMO", "false") == "true",
		QuickWinPoints: envInt("REWARD_QUICKWIN_POINTS", 10),
		MajorPoints:    envInt("REWARD_MAJOR_POINTS", 50),
		RewardRatePct:  envFloat("REWARD_RATE_PCT", 1),
	}
}

func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func envInt(k string, d int) int {
	if v, err := strconv.Atoi(os.Getenv(k)); err == nil {
		return v
	}
	return d
}

func envFloat(k string, d float64) float64 {
	if v, err := strconv.ParseFloat(os.Getenv(k), 64); err == nil {
		return v
	}
	return d
}
