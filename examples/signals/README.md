# signals

Emits five test waveforms to Riemann so the dashboard has something to
chart: sine, square, sawtooth, normal noise, and uniform noise. The
Riemann TCP protobuf protocol is implemented in this file directly; no
client library is needed.

Run the generator against your Riemann server:

```bash
go run ./examples/signals -riemann 127.0.0.1:5555
```

Serve the dashboard with the example workspace:

```bash
go build
./riemann-surface -config examples/signals/config.json
```

Open http://localhost:4567. The workspace charts each signal on its own
pane plus an all-signals overlay. Edit `config.json`'s `server` field
(or the field in the dashboard toolbar) if Riemann is not on localhost.

Flags:

```
-riemann string    riemann TCP address (default "127.0.0.1:5555")
-interval duration time between emissions (default 1s)
-period duration   waveform period (default 1m)
-host string       host field on emitted events (default "signals")
```
