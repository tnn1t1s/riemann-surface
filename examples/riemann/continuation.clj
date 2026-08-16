; Analytic continuation of sqrt(z), implemented as Riemann stream state.
;
; The source emits only a path in the z-plane: events with service "z"
; and string attributes theta, z-real, z-imag. At every instant there
; are algebraically two square roots, +sqrt(z) and -sqrt(z). This
; stream chooses the root nearest the previously chosen one — analytic
; continuation as a state machine — and fans each input event out to:
;
;   "sqrt-z"               the chosen root as attributes (w-real,
;                          w-imag, sheet, turn) plus a readable
;                          description; drives plane views and logs
;   "z re", "z im"         path components as metrics, for time charts
;   "sqrt-z re", "sqrt-z im"  continued-root components as metrics
;   "sheet"                which sheet the path is on, 0 or 1
;
; After one circuit of the origin, z returns to its start but the
; continued root arrives at the other sheet: same z, different w,
; because history matters. In the time domain this appears as a
; subharmonic — the sqrt-z components complete a cycle only every
; second circuit of z, which no memoryless function of z can produce.
; The stream's state IS the sheet of the Riemann surface.

(ns riemann.surface-demo)

; Previously chosen root, per source host.
(def ^:private continuation (atom {}))

(defn- principal-sqrt [re im]
  (let [r (Math/sqrt (Math/hypot re im))
        half (/ (Math/atan2 im re) 2.0)]
    [(* r (Math/cos half)) (* r (Math/sin half))]))

(defn- dist2 [[a b] [c d]]
  (+ (* (- a c) (- a c)) (* (- b d) (- b d))))

(defn- fmt-c [[re im]]
  (format "%+.3f %+.3fi" re im))

(defn- enrich
  "The continuation step: given a z-path event, choose the root nearest
  the previous choice and return the fan-out of enriched events."
  [e]
  (try
    (let [z-re  (Double/parseDouble (:z-real e))
          z-im  (Double/parseDouble (:z-imag e))
          theta (Double/parseDouble (:theta e))
          p     (principal-sqrt z-re z-im)
          n     [(- (first p)) (- (second p))]
          prev  (get @continuation (:host e))
          w     (if prev (min-key #(dist2 % prev) p n) p)
          sheet (if (= w p) 0 1)
          st    (if (zero? sheet) "ok" "warning")
          turns (/ theta (* 2.0 Math/PI))
          at-start (and (> theta 0.1)
                        (< (Math/abs (- turns (Math/round turns))) 0.005))]
      (swap! continuation assoc (:host e) w)
      [(merge e
              {:service "sqrt-z"
               :state   st
               :w-real  (str (first w))
               :w-imag  (str (second w))
               :sheet   (str sheet)
               :turn    (format "%.3f" turns)
               :description
               (str (format "θ=%.2fπ   z = %s   √z = %s   sheet %d"
                            (/ theta Math/PI)
                            (fmt-c [z-re z-im])
                            (fmt-c w)
                            sheet)
                    (cond
                      (and at-start (= sheet 1)) "   ← same z, other sheet"
                      (and at-start (zero? sheet)) "   ← same z, back to sheet 0"
                      :else ""))})
       (merge e {:service "z re" :metric z-re})
       (merge e {:service "z im" :metric z-im})
       (merge e {:service "sqrt-z re" :metric (first w) :state st})
       (merge e {:service "sqrt-z im" :metric (second w) :state st})
       (merge e {:service "sheet" :metric sheet :state st})])
    (catch Exception _
      ; Malformed path event; drop it.
      nil)))

(defn continue-sqrt
  "Stream: fans each z-path event out to its enriched events (see the
  file header for the services emitted) and passes them to children."
  [& children]
  (fn [e]
    (doseq [ev (enrich e)
            child children]
      (child ev))))
