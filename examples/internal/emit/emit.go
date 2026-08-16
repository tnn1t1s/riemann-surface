// Package emit sends events to a Riemann server over its TCP protobuf
// protocol. The wire format is implemented here directly, so examples
// need no client library.
package emit

import (
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"net"
	"sort"
	"time"
)

// Event is a Riemann event. Attributes ride along as string key/value
// pairs and surface as extra fields on the event everywhere downstream
// (streams, index, websocket JSON).
type Event struct {
	Service     string
	Host        string
	State       string
	Description string
	Tags        []string
	TTL         float32
	Metric      float64
	TimeMicros  int64
	Attributes  map[string]string
}

// Riemann protobuf wire format.
//
// Event fields: state=2 service=3 host=4 description=5 tags=7
// ttl=8(float) attributes=9(message: key=1 value=2)
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

func encodeEvent(e Event) []byte {
	var b []byte
	b = appendString(b, 2, e.State)
	b = appendString(b, 3, e.Service)
	b = appendString(b, 4, e.Host)
	if e.Description != "" {
		b = appendString(b, 5, e.Description)
	}
	for _, t := range e.Tags {
		b = appendString(b, 7, t)
	}
	b = appendTag(b, 8, 5)
	b = binary.LittleEndian.AppendUint32(b, math.Float32bits(e.TTL))
	keys := make([]string, 0, len(e.Attributes))
	for k := range e.Attributes {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		var a []byte
		a = appendString(a, 1, k)
		a = appendString(a, 2, e.Attributes[k])
		b = appendTag(b, 9, 2)
		b = appendUvarint(b, uint64(len(a)))
		b = append(b, a...)
	}
	b = appendTag(b, 14, 1)
	b = binary.LittleEndian.AppendUint64(b, math.Float64bits(e.Metric))
	b = appendTag(b, 16, 0)
	b = appendUvarint(b, uint64(e.TimeMicros))
	return b
}

func encodeMsg(events []Event) []byte {
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

// Conn is a reconnecting Riemann client. Send dials on demand and
// drops the connection on any error, so the next Send retries.
type Conn struct {
	Addr string
	c    net.Conn
}

func (c *Conn) Send(events []Event) error {
	if c.c == nil {
		conn, err := net.DialTimeout("tcp", c.Addr, 5*time.Second)
		if err != nil {
			return fmt.Errorf("connect: %w", err)
		}
		c.c = conn
	}

	c.c.SetDeadline(time.Now().Add(5 * time.Second))
	if _, err := c.c.Write(encodeMsg(events)); err != nil {
		c.Close()
		return fmt.Errorf("write: %w", err)
	}
	ok, errMsg, err := readAck(c.c)
	if err != nil {
		c.Close()
		return fmt.Errorf("ack: %w", err)
	}
	if !ok {
		return fmt.Errorf("server rejected batch: %s", errMsg)
	}
	return nil
}

func (c *Conn) Close() {
	if c.c != nil {
		c.c.Close()
		c.c = nil
	}
}
