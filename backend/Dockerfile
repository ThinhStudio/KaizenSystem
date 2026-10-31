FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/kaizen-api ./cmd/api

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 app
WORKDIR /app
COPY --from=build /out/kaizen-api /app/kaizen-api
COPY web /app/web
RUN mkdir -p /app/data/uploads && chown -R app /app/data
USER app
ENV ADDR=:8080 WEB_DIR=/app/web STORAGE_DIR=/app/data/uploads TZ=Asia/Ho_Chi_Minh
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:8080/healthz || exit 1
ENTRYPOINT ["/app/kaizen-api"]
