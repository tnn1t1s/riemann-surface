# riemann-surface

A dashboard for [Riemann](https://riemann.io), in Go; a port of
[riemann-dash](https://github.com/riemann/riemann-dash). The server serves
the UI and persists workspace configuration; the browser subscribes directly
to Riemann's websocket (or SSE) endpoint for event data.

## Get started

```bash
go build
./riemann-surface
```

Open http://localhost:4567 in a browser. The dashboard connects to
`127.0.0.1:5556` by default and shows a small manual. Point the address
field in the toolbar at your Riemann server's websocket port.

## Configuring

```
-listen string   address to listen on (default ":4567")
-config string   path to the workspace config JSON file (default "config.json")
```

The `RIEMANN_DASH_CONFIG` environment variable sets the default config path
when `-config` is not given. Workspace configs written by riemann-dash load
unchanged.

## Views

Grid, Gauge, Flot (time-series charts), Log, List, Dial, Geiger, Title,
iframe, and Help, composed into workspaces with HStack/VStack splits.
Each view subscribes to a Riemann query; on open it fetches current index
state in one shot, then streams updates, so a fresh dashboard populates
immediately. Events expire locally by TTL. Concurrent saves from multiple
browsers reconcile by workspace name, with the higher view version winning.

## Example

`examples/signals` emits five test waveforms (sine, square, sawtooth,
normal noise, uniform noise) over Riemann's TCP protocol and includes a
workspace config that charts each one plus an all-signals overlay:

```bash
go run ./examples/signals -riemann 127.0.0.1:5555
./riemann-surface -config examples/signals/config.json
```

## Keyboard reference

Press `?` in the dashboard. Briefly: `e` edit, `s` save, `r` reload,
`w` show config, `v`/`h` split, arrows move, `+`/`-` resize, `d` delete,
`p` pause streams, alt-1..9 switch workspaces, Control/Meta+click to focus
a view.

## Development

```bash
go test ./...
```

Frontend sources live in `web/` and are embedded with `go:embed`; rebuild to
pick up changes.

## License

MIT. A derived work of riemann-dash, copyright (c) 2011 Kyle Kingsbury.
See LICENSE.
