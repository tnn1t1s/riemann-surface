# riemann-dash-go

A Go port of [riemann-dash](https://github.com/riemann/riemann-dash), the
websockets-powered dashboard for [Riemann](https://riemann.io). One static
binary serves the UI and persists workspace configuration; the browser
subscribes directly to Riemann's websocket (or SSE) endpoint for event data,
exactly as in the original.

## Get started

```bash
go build
./riemann-dash-go
```

Open http://localhost:4567 in a browser. The dashboard connects to
`127.0.0.1:5556` by default and shows a small manual. Change the address in
the top-right field to point at your Riemann server's websocket port.

## Configuring

```
-listen string   address to listen on (default ":4567")
-config string   path to the workspace config JSON file (default "config.json")
```

The `RIEMANN_DASH_CONFIG` environment variable sets the default config path
when `-config` is not given. Workspace configs saved by the original
riemann-dash load unchanged: the JSON schema, the workspace merge semantics
(merge by name, higher `view.version` wins), and the view type names are the
same.

## What is here

- The full view system: HStack/VStack splits, weights, keyboard-driven
  layout editing, workspaces with rename, reorder, and URL fragments.
- View types: `Grid`, `Gauge`, `Flot`, `Log`, `List`, `Title`, `Help`,
  `Dial`, `Geiger`, `TimeSeries`, `iframe`, and the `Balloon`/`Fullscreen`
  containers.
- Local TTL expiry, the converging stream clock, the load meter, the event
  inspector pane, and save/reload against the server.
- Config persistence with the same merge-on-write reconciliation as the
  Ruby implementation.

## What is intentionally not here

- No Ruby, no gems, no npm, no vendored JavaScript libraries. The frontend
  is hand-written vanilla JS and CSS, embedded in the binary. Charts that
  the original drew with flot, smoothie, and gauge.js are drawn on plain
  canvas.
- The S3 config backend. Config is a file on disk.
- Sound files. The Geiger view synthesizes its click with WebAudio; the
  `sound` config field is preserved but not played.
- The `TimeSeries` view renders through the same chart engine as `Flot`
  (the original deprecated it in favor of Flot). Its `speed` option maps to
  a time range; `delay` and `opacity` are preserved in the config but not
  rendered.

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

MIT, like the original. This is a derived work of riemann-dash,
copyright (c) 2011 Kyle Kingsbury. See LICENSE.
