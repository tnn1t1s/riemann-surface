// signals emits five test waveforms to a Riemann server: sine, square,
// sawtooth, normal noise, and uniform noise. Use it with
// examples/signals/config.json to demo the dashboard's charting.
package main

import (
	"flag"
	"log"
	"math"
	"math/rand/v2"
	"time"

	"github.com/tnn1t1s/riemann-surface/examples/internal/emit"
)

func signals(t float64, period float64, hostname string, ttl float32) []emit.Event {
	phase := 2 * math.Pi * t / period
	values := map[string]float64{
		"signal.sine":    50 + 40*math.Sin(phase),
		"signal.square":  50 + 40*sign(math.Sin(phase)),
		"signal.saw":     10 + 80*frac(t/period),
		"signal.normal":  50 + 15*rand.NormFloat64(),
		"signal.uniform": 100 * rand.Float64(),
	}

	now := time.Now().UnixMicro()
	events := make([]emit.Event, 0, len(values))
	for service, metric := range values {
		events = append(events, emit.Event{
			State:      "ok",
			Service:    service,
			Host:       hostname,
			Tags:       []string{"signals"},
			TTL:        ttl,
			Metric:     metric,
			TimeMicros: now,
		})
	}
	return events
}

func sign(x float64) float64 {
	if x < 0 {
		return -1
	}
	return 1
}

func frac(x float64) float64 {
	return x - math.Floor(x)
}

func main() {
	addr := flag.String("riemann", "127.0.0.1:5555", "riemann TCP address")
	interval := flag.Duration("interval", time.Second, "time between emissions")
	period := flag.Duration("period", time.Minute, "waveform period")
	hostname := flag.String("host", "signals", "host field on emitted events")
	flag.Parse()

	ttl := float32(3 * interval.Seconds())
	if ttl < 10 {
		ttl = 10
	}

	conn := &emit.Conn{Addr: *addr}
	start := time.Now()
	log.Printf("emitting 5 signals to %s every %s (period %s)", *addr, *interval, *period)

	for ; ; time.Sleep(*interval) {
		t := time.Since(start).Seconds()
		if err := conn.Send(signals(t, period.Seconds(), *hostname, ttl)); err != nil {
			log.Printf("%v (retrying)", err)
		}
	}
}
