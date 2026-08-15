// signals emits five test waveforms to a Riemann server over its TCP
// protobuf protocol: sine, square, sawtooth, normal noise, and uniform
// noise. Use it with examples/signals/config.json to demo the dashboard's
// charting. The protobuf encoding is hand-rolled so the example, like the
// dashboard, has no dependencies.
package main

import (
	"encoding/binary"
	"flag"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand/v2"
	"net"
	"time"
)

type event struct {
	State      string
	Service    string
	Host       string
	Tags       []string
	TTL        float32
	Metric     float64
	TimeMicros int64
}

// --- riemann protobuf wire format ---
//
// Event fields: state=2 service=3 host=4 tags=7 ttl=8(float)
// metric_d=14(double) time_micros=16(varint).
// Msg fields: ok=2(varint) error=3(string) events=6(message).
// Framing: 4-byte big-endian length prefix per Msg.

func appendUvarint(b []byte, v uint64) []byte {
	for v >= 0x80 {
		b = append(b, byte(v)|0x80)
		v >>= 7
	}
	return append(b, byte(v))
}

func appendTag(b []byte, field, wire int) []byte {
	return appendUvarint(b, uint64(field<<3|wire))
}

func appendString(b []byte, field int, s string) []byte {
	b = appendTag(b, field, 2)
	b = appendUvarint(b, uint64(len(s)))
	return append(b, s...)
}

func encodeEvent(e event) []byte {
	var b []byte
	b = appendString(b, 2, e.State)
	b = appendString(b, 3, e.Service)
	b = appendString(b, 4, e.Host)
	for _, t := range e.Tags {
		b = appendString(b, 7, t)
	}
	b = appendTag(b, 8, 5)
	b = binary.LittleEndian.AppendUint32(b, math.Float32bits(e.TTL))
	b = appendTag(b, 14, 1)
	b = binary.LittleEndian.AppendUint64(b, math.Float64bits(e.Metric))
	b = appendTag(b, 16, 0)
	b = appendUvarint(b, uint64(e.TimeMicros))
	return b
}

func encodeMsg(events []event) []byte {
	var body []byte
	for _, e := range events {
		eb := encodeEvent(e)
		body = appendTag(body, 6, 2)
		body = appendUvarint(body, uint64(len(eb)))
		body = append(body, eb...)
	}
	frame := binary.BigEndian.AppendUint32(nil, uint32(len(body)))
	return append(frame, body...)
}

// readAck reads one response Msg and returns the server's ok flag and
// error string.
func readAck(conn net.Conn) (bool, string, error) {
	var lenBuf [4]byte
	if _, err := io.ReadFull(conn, lenBuf[:]); err != nil {
		return false, "", err
	}
	body := make([]byte, binary.BigEndian.Uint32(lenBuf[:]))
	if _, err := io.ReadFull(conn, body); err != nil {
		return false, "", err
	}

	ok := false
	errMsg := ""
	for i := 0; i < len(body); {
		tag, n := binary.Uvarint(body[i:])
		if n <= 0 {
			break
		}
		i += n
		field, wire := int(tag>>3), int(tag&7)
		switch wire {
		case 0: // varint
			v, n := binary.Uvarint(body[i:])
			if n <= 0 {
				return ok, errMsg, fmt.Errorf("bad varint")
			}
			i += n
			if field == 2 {
				ok = v == 1
			}
		case 1: // 64-bit
			i += 8
		case 2: // length-delimited
			l, n := binary.Uvarint(body[i:])
			if n <= 0 {
				return ok, errMsg, fmt.Errorf("bad length")
			}
			i += n
			if field == 3 {
				errMsg = string(body[i : i+int(l)])
			}
			i += int(l)
		case 5: // 32-bit
			i += 4
		default:
			return ok, errMsg, fmt.Errorf("unknown wire type %d", wire)
		}
	}
	return ok, errMsg, nil
}

// --- signal generators ---

func signals(t float64, period float64, hostname string, ttl float32) []event {
	phase := 2 * math.Pi * t / period
	values := map[string]float64{
		"signal.sine":    50 + 40*math.Sin(phase),
		"signal.square":  50 + 40*sign(math.Sin(phase)),
		"signal.saw":     10 + 80*frac(t/period),
		"signal.normal":  50 + 15*rand.NormFloat64(),
		"signal.uniform": 100 * rand.Float64(),
	}

	now := time.Now().UnixMicro()
	events := make([]event, 0, len(values))
	for service, metric := range values {
		events = append(events, event{
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

	var conn net.Conn
	start := time.Now()
	log.Printf("emitting 5 signals to %s every %s (period %s)", *addr, *interval, *period)

	for ; ; time.Sleep(*interval) {
		if conn == nil {
			var err error
			conn, err = net.DialTimeout("tcp", *addr, 5*time.Second)
			if err != nil {
				log.Printf("connect: %v (retrying)", err)
				continue
			}
		}

		t := time.Since(start).Seconds()
		msg := encodeMsg(signals(t, period.Seconds(), *hostname, ttl))

		conn.SetDeadline(time.Now().Add(5 * time.Second))
		if _, err := conn.Write(msg); err != nil {
			log.Printf("write: %v (reconnecting)", err)
			conn.Close()
			conn = nil
			continue
		}
		ok, errMsg, err := readAck(conn)
		if err != nil {
			log.Printf("ack: %v (reconnecting)", err)
			conn.Close()
			conn = nil
			continue
		}
		if !ok {
			log.Printf("server rejected batch: %s", errMsg)
		}
	}
}
