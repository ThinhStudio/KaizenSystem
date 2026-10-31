package notify

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"
)

// Notifier sends fire-and-forget messages to Telegram and/or a generic webhook.
type Notifier struct {
	telegramToken, telegramChat, webhook string
	client                               *http.Client
}

func New(token, chat, webhook string) *Notifier {
	return &Notifier{telegramToken: token, telegramChat: chat, webhook: webhook,
		client: &http.Client{Timeout: 5 * time.Second}}
}

type Event struct {
	Type    string `json:"type"`
	IdeaID  int64  `json:"idea_id"`
	Code    string `json:"code"`
	Title   string `json:"title"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

func (n *Notifier) Send(e Event) {
	if n == nil {
		return
	}
	go func() {
		if n.telegramToken != "" && n.telegramChat != "" {
			body, _ := json.Marshal(map[string]string{
				"chat_id": n.telegramChat,
				"text":    "[" + e.Code + "] " + e.Title + "\n" + e.Message + " (" + e.Status + ")",
			})
			n.post("https://api.telegram.org/bot"+n.telegramToken+"/sendMessage", body)
		}
		if n.webhook != "" {
			body, _ := json.Marshal(e)
			n.post(n.webhook, body)
		}
	}()
}

func (n *Notifier) post(url string, body []byte) {
	resp, err := n.client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		slog.Warn("notify failed", "err", err)
		return
	}
	resp.Body.Close()
}
