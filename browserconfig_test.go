package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestMergeConfigsServerPriority(t *testing.T) {
	first := map[string]any{"server": "first_server", "server_type": "first_type"}
	second := map[string]any{"server": "second_server", "server_type": "second_type"}

	merged := mergeConfigs(first, second)
	if merged["server"] != "first_server" {
		t.Errorf("server = %v, want first_server", merged["server"])
	}
	if merged["server_type"] != "first_type" {
		t.Errorf("server_type = %v, want first_type", merged["server_type"])
	}

	merged = mergeConfigs(map[string]any{}, second)
	if merged["server"] != "second_server" {
		t.Errorf("server = %v, want second_server", merged["server"])
	}
	if merged["server_type"] != "second_type" {
		t.Errorf("server_type = %v, want second_type", merged["server_type"])
	}
}

func TestMergeWorkspace(t *testing.T) {
	first := map[string]any{"view": map[string]any{"version": 2.0}, "name": "first"}
	second := map[string]any{"view": map[string]any{"version": 3.0}, "name": "second"}
	unversioned := map[string]any{"view": map[string]any{}}

	if got := mergeWorkspace(first, second); !reflect.DeepEqual(got, second) {
		t.Errorf("higher version should win, got %v", got)
	}
	if got := mergeWorkspace(second, first); !reflect.DeepEqual(got, second) {
		t.Errorf("higher version should win, got %v", got)
	}
	if got := mergeWorkspace(first, nil); !reflect.DeepEqual(got, first) {
		t.Errorf("non-nil should win, got %v", got)
	}
	if got := mergeWorkspace(nil, first); !reflect.DeepEqual(got, first) {
		t.Errorf("non-nil should win, got %v", got)
	}
	if got := mergeWorkspace(first, unversioned); !reflect.DeepEqual(got, first) {
		t.Errorf("versioned should win, got %v", got)
	}
	if got := mergeWorkspace(unversioned, first); !reflect.DeepEqual(got, first) {
		t.Errorf("versioned should win, got %v", got)
	}

	tied := map[string]any{"view": map[string]any{"version": 2.0}, "name": "tied"}
	if got := mergeWorkspace(first, tied); !reflect.DeepEqual(got, first) {
		t.Errorf("first should win ties, got %v", got)
	}
}

func TestMergeWorkspacesOrderAndNilHandling(t *testing.T) {
	a := []any{
		map[string]any{"name": "x", "view": map[string]any{"version": 1.0}},
		map[string]any{"name": "y", "view": map[string]any{"version": 5.0}},
	}
	b := []any{
		map[string]any{"name": "y", "view": map[string]any{"version": 2.0}},
		map[string]any{"name": "z", "view": map[string]any{}},
	}

	merged := mergeWorkspaces(a, b)
	if len(merged) != 3 {
		t.Fatalf("len = %d, want 3", len(merged))
	}
	names := []string{}
	for _, w := range merged {
		names = append(names, asMap(w)["name"].(string))
	}
	if !reflect.DeepEqual(names, []string{"x", "y", "z"}) {
		t.Errorf("names = %v, want [x y z]", names)
	}
	if v := viewVersion(asMap(merged[1])); v != 5.0 {
		t.Errorf("workspace y version = %v, want 5 (update wins)", v)
	}

	if got := mergeWorkspaces(nil, b); !reflect.DeepEqual(got, b) {
		t.Errorf("nil a should return b")
	}
	if got := mergeWorkspaces(a, nil); !reflect.DeepEqual(got, a) {
		t.Errorf("nil b should return a")
	}
}

func TestFileStoreReadMissing(t *testing.T) {
	store := NewFileStore(filepath.Join(t.TempDir(), "nope", "config.json"))
	data, err := store.Read()
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "{}" {
		t.Errorf("Read = %q, want {}", data)
	}
}

func TestFileStoreUpdateRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sub", "config.json")
	store := NewFileStore(path)

	if err := store.Update([]byte(`{"server": "1.2.3.4:5556", "workspaces": [{"name": "a", "view": {"version": 1}}]}`)); err != nil {
		t.Fatal(err)
	}
	if err := store.Update([]byte(`{"workspaces": [{"name": "a", "view": {"version": 0}}, {"name": "b", "view": {}}]}`)); err != nil {
		t.Fatal(err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var cfg map[string]any
	if err := json.Unmarshal(data, &cfg); err != nil {
		t.Fatal(err)
	}
	if cfg["server"] != "1.2.3.4:5556" {
		t.Errorf("server = %v, want carried over from first save", cfg["server"])
	}
	ws := asSlice(cfg["workspaces"])
	if len(ws) != 2 {
		t.Fatalf("workspaces = %v, want 2 entries", ws)
	}
	if v := viewVersion(asMap(ws[0])); v != 1.0 {
		t.Errorf("workspace a version = %v, want 1 (higher stored version wins)", v)
	}

	if err := store.Update([]byte(`not json`)); err == nil {
		t.Error("invalid JSON update should error")
	}
}
