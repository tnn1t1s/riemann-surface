package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// The browser posts its full config on save. Saves from concurrent browsers
// are reconciled by merging: the incoming config wins field-by-field, except
// workspaces, which merge by name with the higher view.version winning.

// mergeConfigs merges update a over stored config b.
func mergeConfigs(a, b map[string]any) map[string]any {
	out := make(map[string]any, len(a)+2)
	for k, v := range a {
		out[k] = v
	}
	if out["server"] == nil {
		out["server"] = b["server"]
	}
	if out["server_type"] == nil {
		out["server_type"] = b["server_type"]
	}
	out["workspaces"] = mergeWorkspaces(asSlice(a["workspaces"]), asSlice(b["workspaces"]))
	return out
}

func asSlice(v any) []any {
	s, _ := v.([]any)
	return s
}

func asMap(v any) map[string]any {
	m, _ := v.(map[string]any)
	return m
}

// mergeWorkspaces merges two workspace lists by name. Names from a keep
// their order, followed by names present only in b.
func mergeWorkspaces(as, bs []any) []any {
	if as == nil {
		return bs
	}
	if bs == nil {
		return as
	}

	index := func(list []any) map[string]map[string]any {
		idx := make(map[string]map[string]any, len(list))
		for _, w := range list {
			if m := asMap(w); m != nil {
				name, _ := m["name"].(string)
				idx[name] = m
			}
		}
		return idx
	}
	ai, bi := index(as), index(bs)

	var names []string
	seen := map[string]bool{}
	for _, list := range [][]any{as, bs} {
		for _, w := range list {
			if m := asMap(w); m != nil {
				name, _ := m["name"].(string)
				if !seen[name] {
					seen[name] = true
					names = append(names, name)
				}
			}
		}
	}

	merged := make([]any, 0, len(names))
	for _, name := range names {
		merged = append(merged, mergeWorkspace(ai[name], bi[name]))
	}
	return merged
}

// mergeWorkspace picks the workspace with the higher view.version,
// preferring a on ties.
func mergeWorkspace(a, b map[string]any) map[string]any {
	if b == nil {
		return a
	}
	if a == nil {
		return b
	}
	if viewVersion(a) < viewVersion(b) {
		return b
	}
	return a
}

func viewVersion(w map[string]any) float64 {
	view := asMap(w["view"])
	if view == nil {
		return 0
	}
	v, _ := view["version"].(float64)
	return v
}

// FileStore persists the browser config as pretty-printed JSON.
type FileStore struct {
	path string
	mu   sync.Mutex
}

func NewFileStore(path string) *FileStore {
	return &FileStore{path: path}
}

func (s *FileStore) Read() ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.read()
}

func (s *FileStore) read() ([]byte, error) {
	data, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		return []byte("{}"), nil
	}
	return data, err
}

func (s *FileStore) Update(update []byte) error {
	var updateMap map[string]any
	if err := json.Unmarshal(update, &updateMap); err != nil {
		return fmt.Errorf("invalid config update: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	oldData, err := s.read()
	if err != nil {
		return err
	}
	var oldMap map[string]any
	if err := json.Unmarshal(oldData, &oldMap); err != nil {
		// An unreadable stored config should not block saves.
		oldMap = map[string]any{}
	}

	merged, err := json.MarshalIndent(mergeConfigs(updateMap, oldMap), "", "  ")
	if err != nil {
		return err
	}

	dir := filepath.Dir(s.path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".config-*.json")
	if err != nil {
		return err
	}
	if _, err := tmp.Write(merged); err != nil {
		tmp.Close()
		os.Remove(tmp.Name())
		return err
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmp.Name())
		return err
	}
	if err := os.Chmod(tmp.Name(), 0o644); err != nil {
		os.Remove(tmp.Name())
		return err
	}
	return os.Rename(tmp.Name(), s.path)
}
