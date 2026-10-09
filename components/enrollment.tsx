"use client";
import { useEffect, useRef, useState } from "react";
import { Camera } from "./camera";
import { PhrasePlayer, recordVoice } from "../lib/audio";
import { calibrate, overlaps, predict } from "../lib/classifier";
import {
  FEATURE_VERSION,
  type Example,
  type Hand,
  type Observation,
  type Phrase,
} from "../lib/types";
import { distance } from "../lib/features";
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
    lastSample = useRef(0),
    started = useRef(0),
    lastFeatures = useRef<number[] | null>(null);
  const released = useRef(true),
    releaseSince = useRef(0),
    testSince = useRef(0),
    neutralSince = useRef(0),
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
    minMargin: 0.035,
    featureVersion: FEATURE_VERSION,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  });
  const others = phrases.filter((p) => p.id !== existing?.id);
  function observe(o: Observation) {
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
      if (!o || o.hand !== hand) {
        lastFeatures.current = null;
        setMessage(`Show only your ${hand.toLowerCase()} hand.`);
        return;
      }
      if (
        lastFeatures.current &&
        distance(lastFeatures.current, o.features) > 0.09
      ) {
        lastFeatures.current = o.features;
        setMessage("Keep your pose steady for a moment.");
        return;
      }
      lastFeatures.current = o.features;
      if (now - lastSample.current < 150) return;
      lastSample.current = now;
      samples.current.push({
        features: o.features,
        session: attemptRef.current,
      });
      const n = samples.current.filter(
        (e) => e.session === attemptRef.current,
      ).length;
      setCount(n);
      if (n >= 8) {
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
            if (overlaps(p, others)) {
              setError(
                "This pose is too similar to a saved phrase. Choose a more distinct pose and collect again.",
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
        testSince.current = 0;
        return;
      }
      if (
        o &&
        o.hand === hand &&
        predict(o.features, o.hand, [candidate, ...others])?.id === candidate.id
      ) {
        if (!testSince.current || gap) testSince.current = now;
        setMessage("That’s your pose. Keep holding…");
        if (now - testSince.current >= 700) {
          setTested(true);
          setMessage(
            "Pose recognized. Now try a different, neutral pose or remove your hand.",
          );
          neutralSince.current = 0;
        }
      } else {
        testSince.current = 0;
        setMessage("Repeat your chosen pose for a fresh test.");
      }
    } else if (candidate && tested && !neutral) {
      const match = o
        ? predict(o.features, o.hand, [candidate, ...others])
        : null;
      if (!match) {
        if (!neutralSince.current || gap) neutralSince.current = now;
        if (now - neutralSince.current >= 600) {
          setNeutral(true);
          setMessage(
            "Ready to save. Your pose passed a fresh recognition and release check.",
          );
        }
      } else neutralSince.current = 0;
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
    lastSample.current = 0;
    lastFeatures.current = null;
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
    neutralSince.current = 0;
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
      setError(e instanceof Error ? e.message : "Microphone unavailable.");
    } finally {
      if (mounted.current) setRequesting(false);
    }
  }
  async function preview() {
    try {
      await player.current.play(audio!, () => {});
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
                  setStep(2);
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
              three separate attempts, then test a new one.
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
                    : "Fresh test"}
              </p>
            </div>
            <p className="instruction" role="status">
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
