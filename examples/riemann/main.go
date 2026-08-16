// riemann emits a path in the complex plane:
//
//	z(θ) = r·e^{iθ}
//
// and nothing else. The square root of z, its analytic continuation,
// and the sheet of the Riemann surface the path is on are computed by
// the Riemann server itself — see continuation.clj. The dashboard
// (config.json) watches the surface emerge from the event stream.
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
	radius := flag.Float64("radius", 1.0, "path radius")
	hostname := flag.String("host", "circle", "host field on emitted events")
	flag.Parse()

	conn := &emit.Conn{Addr: *addr}
	theta := 0.0
	log.Printf("emitting z = %g·e^{iθ} to %s: Δθ = %.4f rad every %s (one circuit per %s)",
		*radius, *addr, *step, *interval,
		time.Duration(float64(*interval)*2*math.Pi / *step).Round(time.Second))

	for ; ; time.Sleep(*interval) {
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
				"z-real": fmt.Sprintf("%.6f", *radius*math.Cos(theta)),
				"z-imag": fmt.Sprintf("%.6f", *radius*math.Sin(theta)),
			},
		}
		if err := conn.Send([]emit.Event{e}); err != nil {
			log.Printf("%v (retrying)", err)
		}
		theta += *step
	}
}
