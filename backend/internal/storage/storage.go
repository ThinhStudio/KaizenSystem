package storage

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Store abstracts object storage. LocalStore is used on-prem; an S3/MinIO
// implementation can satisfy the same interface.
type Store interface {
	Put(key string, r io.Reader) (int64, error)
	Open(key string) (io.ReadSeekCloser, error)
	Delete(key string) error
}

type LocalStore struct{ root string }

func NewLocal(root string) (*LocalStore, error) {
	if err := os.MkdirAll(root, 0o750); err != nil {
		return nil, err
	}
	return &LocalStore{root: root}, nil
}

func (s *LocalStore) path(key string) (string, error) {
	clean := filepath.Clean("/" + key)
	if strings.Contains(clean, "..") {
		return "", errors.New("invalid key")
	}
	return filepath.Join(s.root, clean), nil
}

func (s *LocalStore) Put(key string, r io.Reader) (int64, error) {
	p, err := s.path(key)
	if err != nil {
		return 0, err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o750); err != nil {
		return 0, err
	}
	f, err := os.Create(p)
	if err != nil {
		return 0, err
	}
	defer f.Close()
	return io.Copy(f, r)
}

func (s *LocalStore) Open(key string) (io.ReadSeekCloser, error) {
	p, err := s.path(key)
	if err != nil {
		return nil, err
	}
	return os.Open(p)
}

func (s *LocalStore) Delete(key string) error {
	p, err := s.path(key)
	if err != nil {
		return err
	}
	return os.Remove(p)
}
