// riemann-surface serves the Riemann dashboard UI and persists its
// workspace configuration. Event data never passes through this server:
// the browser subscribes directly to Riemann's websocket or SSE endpoint.
package main

import (
	"embed"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
)

//go:embed web
var webFS embed.FS

func defaultConfigPath() string {
	if p := os.Getenv("RIEMANN_SURFACE_CONFIG"); p != "" {
		return p
	}
	return "config.json"
}

func main() {
	listen := flag.String("listen", ":4567", "address to listen on (host:port)")
	configPath := flag.String("config", defaultConfigPath(), "path to the workspace config JSON file")
	flag.Parse()

	store := NewFileStore(*configPath)

	static, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatal(err)
	}
	fileServer := http.FileServer(http.FS(static))

	mux := http.NewServeMux()
	mux.HandleFunc("/config", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			serveConfig(w, store)
		case http.MethodPost:
			body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 10<<20))
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			if err := store.Update(body); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			serveConfig(w, store)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			index, err := fs.ReadFile(static, "index.html")
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write(index)
			return
		}
		fileServer.ServeHTTP(w, r)
	})

	log.Printf("riemann-surface listening on %s (config: %s)", *listen, *configPath)
	log.Fatal(http.ListenAndServe(*listen, mux))
}

func serveConfig(w http.ResponseWriter, store *FileStore) {
	data, err := store.Read()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, "%s", data)
}
