// riemann emits a path in the complex plane:
//
//	z(θ) = r(θ)·e^{iθ}
//
// and nothing else. The radius oscillates between rmin and rmax with a
// period incommensurate with the sheet period 4π (the golden ratio
// keeps them from ever locking), so over time the path fills the whole
// surface instead of retracing one ring. rmin stays above zero: the
// branch point is where the sheets meet and continuation through it is
// ambiguous.
//
// The square root of z, its analytic continuation, and the sheet of
// the Riemann surface the path is on are computed by the Riemann
// server itself — see continuation.clj. The dashboard (config.json)
// watches the surface emerge from the event stream.
package main

import (
	"flag"
	"fmt"
	"log"
	"math"
	"time"

	"github.com/tnn1t1s/riemann-surface/examples/internal/emit"
)

func main() {
	addr := flag.String("riemann", "127.0.0.1:5555", "riemann TCP address")
	interval := flag.Duration("interval", 100*time.Millisecond, "time between emissions")
	step := flag.Float64("step", math.Pi/50, "angular step per event, radians")
	rmin := flag.Float64("rmin", 0.15, "minimum path radius (keep above the branch point)")
	rmax := flag.Float64("rmax", 1.0, "maximum path radius")
	hostname := flag.String("host", "circle", "host field on emitted events")
	flag.Parse()

	// Radial oscillation period, in θ, chosen incommensurate with the
	// 4π sheet period so the path never locks onto a closed track.
	const goldenRatio = 1.6180339887498949

	conn := &emit.Conn{Addr: *addr}
	theta := 0.0
	log.Printf("emitting z = r(θ)·e^{iθ} to %s: r ∈ [%g, %g], Δθ = %.4f rad every %s (one circuit per %s)",
		*addr, *rmin, *rmax, *step, *interval,
		time.Duration(float64(*interval)*2*math.Pi / *step).Round(time.Second))

	for ; ; time.Sleep(*interval) {
		r := *rmin + (*rmax-*rmin)*(0.5+0.5*math.Sin(theta/goldenRatio))
		e := emit.Event{
			State:      "ok",
			Service:    "z",
			Host:       *hostname,
			Tags:       []string{"surface-demo"},
			TTL:        10,
			Metric:     theta,
			TimeMicros: time.Now().UnixMicro(),
			Attributes: map[string]string{
				"theta":  fmt.Sprintf("%.6f", theta),
				"r":      fmt.Sprintf("%.6f", r),
				"z-real": fmt.Sprintf("%.6f", r*math.Cos(theta)),
				"z-imag": fmt.Sprintf("%.6f", r*math.Sin(theta)),
			},
		}
		if err := conn.Send([]emit.Event{e}); err != nil {
			log.Printf("%v (retrying)", err)
		}
		theta += *step
	}
}
