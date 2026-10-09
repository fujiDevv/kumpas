"use client";
import { useEffect, useRef, useState } from "react";
import { Camera } from "./camera";
import { PhrasePlayer, recordVoice } from "../lib/audio";
import {
  calibrate,
  overlaps,
  predict,
  MIN_MARGIN,
  negativesPreserveGesture,
} from "../lib/classifier";
import {
  FEATURE_VERSION,
  type Example,
  type Hand,
  type Observation,
  type Phrase,
} from "../lib/types";
import { collectFrame, emptyCapture } from "../lib/capture";
import { savePhrase } from "../lib/storage";

export function Enrollment({
  existing,
  phrases,
  onClose,
  onSaved,
}: {
  existing?: Phrase;
  phrases: Phrase[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState(0),
    [text, setText] = useState(existing?.text ?? ""),
    [hand, setHand] = useState<Hand>(existing?.hand ?? "Right");
  const [audio, setAudio] = useState<Blob | undefined>(existing?.audio),
    [duration, setDuration] = useState(existing?.durationMs ?? 0);
  const [recording, setRecording] = useState(false),
    [requesting, setRequesting] = useState(false),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [attempt, setAttempt] = useState(0),
    [count, setCount] = useState(0),
    [capture, setCapture] = useState(false),
    [message, setMessage] = useState(
      "Start your camera, then choose a comfortable pose.",
    );
  const [candidate, setCandidate] = useState<Phrase | null>(null),
    [tested, setTested] = useState(false),
    [neutral, setNeutral] = useState(false);
  const recorder = useRef<Awaited<ReturnType<typeof recordVoice>> | null>(null),
    player = useRef(new PhrasePlayer()),
    mounted = useRef(true);
  const samples = useRef<Example[]>([]),
    captureRef = useRef(false),
    attemptRef = useRef(0),
    started = useRef(0),
    captureState = useRef(emptyCapture()),
    negativeState = useRef(emptyCapture()),
    positiveState = useRef(emptyCapture());
  const released = useRef(true),
    releaseSince = useRef(0),
    testSince = useRef(0),
    lastObs = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      recorder.current?.cancel();
      player.current.stop();
    };
  }, []);
  const makeCandidate = (): Phrase => ({
    id: existing?.id ?? crypto.randomUUID(),
    text: text.trim(),
    audio: audio!,
    mime: audio!.type,
    durationMs: duration,
    hand,
    examples: [...samples.current],
    maxDistance: calibrate(samples.current),
    minMargin: MIN_MARGIN,
    featureVersion: FEATURE_VERSION,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  });
  const others = phrases.filter((p) => p.id !== existing?.id);
  function observe(o: Observation) {
    if (document.hidden) {
      captureState.current = emptyCapture();
      positiveState.current = emptyCapture();
      negativeState.current = emptyCapture();

      return;
    }
    const now = performance.now(),
      gap = now - lastObs.current > 350;
    lastObs.current = now;
    if (!o) {
      if (!releaseSince.current || gap) releaseSince.current = now;
      if (now - releaseSince.current > 400) released.current = true;
    } else releaseSince.current = 0;
    if (captureRef.current) {
      if (now - started.current > 12000) {
        captureRef.current = false;
        setCapture(false);
        samples.current = samples.current.filter(
          (e) => e.session !== attemptRef.current,
        );
        setCount(0);
        setError(
          "Capture timed out. Keep one steady hand visible, then try again.",
        );
        return;
      }
      captureState.current = collectFrame(
        captureState.current,
        o?.hand === hand ? o.features : null,
        now,
      );
      const n = captureState.current.samples.length;
      setCount(n);
      setMessage(
        !o
          ? `Show one whole ${hand.toLowerCase()} hand clearly in view.`
          : o.hand !== hand
            ? `The camera detects ${o.hand.toLowerCase()}. Choose that hand above or use your ${hand.toLowerCase()} hand.`
            : n
              ? `Keep this same pose steady: ${n}/8 examples.`
              : "Keep the same pose steady. Movement restarts this attempt.",
      );
      if (n >= 8) {
        samples.current.push(
          ...captureState.current.samples.map((features) => ({
            features,
            session: attemptRef.current,
          })),
        );
        captureRef.current = false;
        setCapture(false);
        attemptRef.current++;
        setAttempt(attemptRef.current);
        released.current = false;
        setMessage(
          attemptRef.current < 3
            ? "Move your hand out of view. Then repeat your pose for another attempt."
            : "Examples collected. Remove your hand, then test a fresh attempt.",
        );
        if (attemptRef.current === 3) {
          try {
            const p = makeCandidate();
            const conflictingPhrase = others.find((saved) =>
              overlaps(p, [saved]),
            );
            if (conflictingPhrase) {
              setError(
                `This pose repeatedly conflicts with “${conflictingPhrase.text}”. Change which fingers are extended or curled, then collect again. Moving the same pose to another position does not create a different gesture.`,
              );
              return;
            }
            setCandidate(p);
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not calibrate gesture.",
            );
          }
        }
      }
    } else if (candidate && !tested) {
      if (!released.current) {
        positiveState.current = emptyCapture();
        testSince.current = 0;
        return;
      }
      if (
        o &&
        o.hand === hand &&
        predict(o.features, o.hand, [candidate, ...others])?.id === candidate.id
      ) {
        positiveState.current = collectFrame(
          positiveState.current,
          o.features,
          now,
        );
        testSince.current = positiveState.current.since;
        setMessage("That’s your pose. Keep holding…");
        if (now - testSince.current >= 700) {
          setTested(true);
          setMessage(
            "Open or curl your fingers into a different shape. Keep your hand in view and hold still.",
          );
        }
      } else {
        positiveState.current = emptyCapture();
        testSince.current = 0;
        setMessage("Repeat your chosen pose for a fresh test.");
      }
    } else if (candidate && tested && !neutral) {
      const match = o
        ? predict(o.features, o.hand, [candidate, ...others])
        : null;
      // A missing hand proves release, but cannot test unknown-pose rejection.
      negativeState.current = collectFrame(
        negativeState.current,
        o?.hand === hand &&
          ![candidate, ...others].some((p) => predict(o.features, o.hand, [p]))
          ? o.features
          : null,
        now,
      );

      if (negativeState.current.samples.length >= 8) {
        if (
          !negativesPreserveGesture(
            candidate,
            negativeState.current.samples,
            positiveState.current.samples,
          )
        ) {
          negativeState.current = emptyCapture();

          setMessage(
            "That relaxed pose is too close to your gesture. Try a clearly different finger shape for this check.",
          );
          return;
        }
        setCandidate({
          ...candidate,
          negatives: negativeState.current.samples,
        });
        setNeutral(true);
        setMessage("Both checks passed. Save your phrase below.");
      } else if (!o) {
        setMessage(
          `Bring your whole ${hand.toLowerCase()} hand back into view. Keep it visible for this check.`,
        );
      } else if (o.hand !== hand) {
        setMessage(
          `Use your ${hand.toLowerCase()} hand, the same hand you taught the gesture with.`,
        );
      } else if (match) {
        setMessage(
          "That shape still matches a phrase. Change which fingers are open or curled, then hold still.",
        );
      } else {
        setMessage(
          negativeState.current.samples.length
            ? "Good — keep holding until the check finishes."
            : "Open or curl your fingers into a different shape. Keep your hand in view and hold still.",
        );
      }
    }
  }
  function cancelCapture() {
    captureRef.current = false;
    setCapture(false);
    samples.current = samples.current.filter(
      (e) => e.session !== attemptRef.current,
    );
    setCount(0);
    setMessage("Attempt canceled. Start the camera and try again when ready.");
  }
  function collect() {
    if (!cameraReady) {
      setError("Start the camera before collecting your pose.");
      return;
    }
    if (!released.current) {
      setError(
        "Move your hand out of view for a moment before the next attempt.",
      );
      return;
    }
    setError("");
    captureRef.current = true;
    setCapture(true);
    started.current = performance.now();
    captureState.current = emptyCapture();
    setCount(0);
    setMessage("Hold your chosen pose comfortably.");
  }
  function reset() {
    samples.current = [];
    attemptRef.current = 0;
    captureRef.current = false;
    setAttempt(0);
    setCapture(false);
    setCount(0);
    setCandidate(null);
    setTested(false);
    setNeutral(false);

    testSince.current = 0;
    positiveState.current = emptyCapture();
    negativeState.current = emptyCapture();
    captureState.current = emptyCapture();
    released.current = true;
    setError("");
    setMessage("Choose a comfortable, distinct pose and collect again.");
  }
  async function startRecording() {
    setError("");
    setRequesting(true);
    player.current.stop();
    try {
      const r = await recordVoice(
        (blob, ms) => {
          if (mounted.current) {
            setAudio(blob);
            setDuration(ms);
            setRecording(false);
          }
        },
        (m) => {
          if (mounted.current) {
            setError(m);
            setRecording(false);
          }
        },
      );
      if (!mounted.current) {
        r.cancel();
        return;
      }
      recorder.current = r;
      setRecording(true);
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Microphone unavailable.");
    } finally {
      if (mounted.current) setRequesting(false);
    }
  }
  async function preview() {
    try {
      const started = await player.current.play(
        audio!,
        () => {},
        () => {
          if (mounted.current)
            setError(
              "Audio could not play. Check the speaker and record again.",
            );
        },
      );
      if (!started) throw new Error("Playback canceled.");
    } catch (e) {
      setError("Audio could not play. Check the speaker and record again.");
      throw e;
    }
  }
  async function save() {
    if (!candidate || !tested || !neutral || saving) return;
    setSaving(true);
    setError("");
    player.current.stop();
    try {
      await savePhrase(candidate);
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save on this device.",
      );
      setSaving(false);
    }
  }
  return (
    <div className="enrollment">
      <div className="section-heading">
        <div>
          <p className="eyebrow">A phrase of your own</p>
          <h1>
            {existing
              ? "Teach this phrase again"
              : "Let’s give your gesture a voice."}
          </h1>
        </div>
        <button className="button subtle" disabled={saving} onClick={onClose}>
          Cancel
        </button>
      </div>
      <ol className="steps">
        {["Choose a phrase", "Record a voice", "Teach a gesture"].map(
          (s, i) => (
            <li
              key={s}
              className={i === step ? "active" : i < step ? "complete" : ""}
            >
              <span>{i + 1}</span>
              {s}
            </li>
          ),
        )}
      </ol>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {step === 0 && (
        <section className="form-sheet">
          <label htmlFor="phrase">What would you like to say?</label>
          <input
            id="phrase"
            value={text}
            maxLength={120}
            autoFocus
            placeholder="Ma, pahingi ng tubig."
            onChange={(e) => setText(e.target.value)}
          />
          <p>
            Use words that feel familiar. Any language, nickname, or everyday
            phrase is welcome.
          </p>
          <div className="suggestions">
            {[
              "Ma, pahingi ng tubig.",
              "Gusto kong magpahinga.",
              "Pakatawag si Ate.",
            ].map((s) => (
              <button
                className="button subtle"
                key={s}
                onClick={() => setText(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            className="button primary"
            disabled={!text.trim()}
            onClick={() => setStep(1)}
          >
            Next: record a voice →
          </button>
        </section>
      )}
      {step === 1 && (
        <section className="form-sheet">
          <p className="phrase-quote">“{text}”</p>
          <h2>A voice that feels like home.</h2>
          <p>
            Ask someone familiar to record this phrase. Speak naturally; you
            have up to eight seconds.
          </p>
          <div className="record-controls">
            <button
              className={`button ${recording ? "danger" : "primary"}`}
              disabled={requesting}
              onClick={
                recording ? () => recorder.current?.stop() : startRecording
              }
            >
              {requesting
                ? "Waiting for microphone…"
                : recording
                  ? "Stop recording"
                  : audio
                    ? "Record again"
                    : "Record voice"}
            </button>
            {audio && !recording && (
              <button
                className="button subtle"
                onClick={() => void preview().catch(() => {})}
              >
                Listen to recording · {(duration / 1000).toFixed(1)}s
              </button>
            )}
          </div>
          {recording && (
            <p role="status">
              Recording… the microphone stops when you finish.
            </p>
          )}
          <div className="form-actions">
            <button
              className="button subtle"
              disabled={recording || requesting}
              onClick={() => {
                player.current.stop();
                setStep(0);
              }}
            >
              Back
            </button>
            <button
              className="button primary"
              disabled={!audio || recording || requesting}
              onClick={async () => {
                try {
                  await preview();
                  player.current.stop();
                  if (mounted.current) setStep(2);
                } catch {
                  setError("Please record a playable clip.");
                }
              }}
            >
              Next: teach a gesture →
            </button>
          </div>
        </section>
      )}
      {step === 2 && (
        <div className="teach-layout">
          <Camera
            onObservation={observe}
            onReady={(ready) => {
              setCameraReady(ready);
              if (!ready && captureRef.current) cancelCapture();
            }}
            onError={(m) => {
              setError(m);
              captureRef.current = false;
              setCapture(false);
            }}
          />
          <section className="teach-guide">
            <p className="eyebrow">Your movement, your meaning</p>
            <h2>“{text}”</h2>
            <p>
              Choose one static pose you can repeat comfortably. We’ll collect
              three steady attempts, test a fresh one, then check a different
              visible hand pose. Keep all fingers in view.
            </p>
            <label htmlFor="hand">Which hand will you use?</label>
            <select
              id="hand"
              value={hand}
              disabled={attempt > 0 || capture}
              onChange={(e) => setHand(e.target.value as Hand)}
            >
              <option value="Right">Right hand</option>
              <option value="Left">Left hand</option>
            </select>
            <div className="attempts">
              {[0, 1, 2].map((i) => (
                <span key={i} className={attempt > i ? "done" : ""}>
                  {attempt > i ? "✓" : i + 1}
                </span>
              ))}
              <p>
                {capture
                  ? `Collecting ${count}/8 examples`
                  : attempt < 3
                    ? `Attempt ${attempt + 1} of 3`
                    : neutral
                      ? "Checks complete"
                      : tested
                        ? "Pose recognized"
                        : "Fresh test"}
              </p>
            </div>
            <p className="instruction" role="status">
              {candidate && tested && (
                <strong className="check-label">
                  {neutral ? "Check complete" : "Final check"}
                </strong>
              )}
              {message}
            </p>
            {attempt < 3 ? (
              <button
                className="button primary"
                disabled={capture || !cameraReady}
                onClick={collect}
              >
                {capture ? "Collecting…" : `Collect attempt ${attempt + 1}`}
              </button>
            ) : (
              <>
                <button
                  className="button primary"
                  disabled={!candidate || !tested || !neutral || saving}
                  onClick={save}
                >
                  {saving ? "Saving…" : "Save phrase & gesture"}
                </button>
                <button className="button subtle" onClick={reset}>
                  Collect again
                </button>
              </>
            )}
            {capture && (
              <button className="button subtle" onClick={cancelCapture}>
                Cancel attempt
              </button>
            )}
            <button
              className="text-button back-link"
              disabled={capture || saving}
              onClick={() => {
                reset();
                setStep(1);
              }}
            >
              ← Back to recording
            </button>
            <p className="fine-print">
              Only hand geometry is saved. Camera video is not recorded. Keep
              the same hand and camera orientation when communicating.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
