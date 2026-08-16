# riemann

The Riemann surface of √z, watched emerging from an event stream.

A source emits a path around the origin of the complex plane and
nothing more:

    z(θ) = r(θ)·e^{iθ},  θ = 0, Δθ, 2Δθ, …

The radius oscillates between rmin and rmax with a period
incommensurate with the sheet period 4π (the golden ratio keeps them
from locking), so over time the path fills the whole surface rather
than retracing one ring. rmin stays above zero because the branch
point is where the sheets meet; continuation through it is ambiguous.

At every instant there are algebraically two square roots, +√z and
−√z. The Riemann *server* maintains the continuous choice between them
as stream state: each event's root is the one nearest the previously
chosen root,

    w(θ) = argmin over w ∈ {+√z, −√z} of |w − w(θ−Δθ)|

which is analytic continuation implemented as a streaming state
machine (continuation.clj). The stream fans each path event out to the
continued root, its components as chartable metrics, and the sheet the
path is on.

The payoff is monodromy. On a fixed-radius run (`-rmin 1 -rmax 1`):
start at z = 1, w = 1. After one circuit the path returns to z = 1,
but continuity forces w = −1; after a second circuit, w = +1 again:

    θ         z              continued √z
    0.00π     +1 + 0i        +1 + 0i
    0.50π      0 + 1i        +.707 + .707i
    1.00π     −1 + 0i         0 + 1i
    1.50π      0 − 1i        −.707 + .707i
    2.00π     +1 + 0i        −1 + 0i        ← same z!

The instantaneous observation z cannot tell you which value √z has;
the stream's state can, because history matters. Event history is
analytic continuation; stream state is the sheet of the surface.

## Two workspaces, one stream

**√z / time** charts everything against time. z contributes cos θ and
sin θ with period T (one circuit); the continued root contributes
cos(θ/2) and sin(θ/2) with period 2T. That half-frequency trace is the
theorem in signal form: a memoryless function of z can only produce
output at z's own period, so a subharmonic in the output is proof the
processor carries state. The sheet chart is a square wave flipping once
per circuit.

**√z / surface** draws the classic picture in 3D: Re √z as height over
the (Re z, Im z) plane, on a slowly orbiting camera, with a faint
reference wireframe of both sheets. The graph of √z lives in ℝ⁴, so
this is a projection, and the apparent self-intersection along the
negative real axis is an artifact of projecting, not a feature of the
surface. The stream's trail traces the double cover live: one circuit
ends on the lower sheet, the second closes the loop.

**√z / plane** draws the two complex planes side by side: the z-dot
loops around the origin while the continued root orbits at half the
angular rate, changing color when the path crosses onto the other
sheet.

All workspaces end with the stream trace; once per circuit it reads
`← full circuit; other sheet`.

## Run it

Start Riemann with the demo config (or load continuation.clj into an
existing server and wire
`(where (service "z") (riemann.surface-demo/continue-sqrt index))`
into its streams):

```bash
riemann examples/riemann/riemann.config
```

Start the path source and the dashboard:

```bash
go run ./examples/riemann -riemann 127.0.0.1:5555
./riemann-surface -config examples/riemann/config.json
```

Open http://localhost:4567. Switch workspaces with alt-1 / alt-2 / alt-3.

Flags:

```
-riemann string    riemann TCP address (default "127.0.0.1:5555")
-interval duration time between emissions (default 100ms)
-step float        angular step per event, radians (default π/50)
-rmin float        minimum path radius (default 0.15)
-rmax float        maximum path radius (default 1)
-host string       host field on emitted events (default "circle")
```
