"use client";
import { useEffect, useRef, useState } from "react";
import { Camera } from "./camera";
import { Enrollment } from "./enrollment";
import { PhrasePlayer } from "../lib/audio";
import { advance, initialActivation, waitForRelease } from "../lib/activation";
import { predict } from "../lib/classifier";
import { deletePhrase, loadPhrases } from "../lib/storage";
import { prepareOffline } from "../lib/offline";
import type { Observation, Phrase } from "../lib/types";

export default function Kumpas() {
  const [phrases, setPhrases] = useState<Phrase[]>([]),
    [mode, setMode] = useState<"communicate" | "setup">("communicate");
  const [draft, setDraft] = useState<Phrase | "new" | null>(null),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  const [online, setOnline] = useState(true),
    [offline, setOffline] = useState(""),
    [preparing, setPreparing] = useState(false);
  const [status, setStatus] = useState("Ready when you are."),
    [active, setActive] = useState<string | null>(null),
    [progress, setProgress] = useState(0),
    [speaking, setSpeaking] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false),
    [cameraEpoch, setCameraEpoch] = useState(0),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState<string | null>(null);
  const activation = useRef(initialActivation()),
    player = useRef(new PhrasePlayer()),
    mounted = useRef(true),
    isSpeaking = useRef(false);
  const speechGeneration = useRef(0);
  async function refresh() {
    try {
      const p = await loadPhrases();
      if (mounted.current) {
        setPhrases(p);
        setLoaded(true);
      }
    } catch (e) {
      if (mounted.current) {
        setError(
          e instanceof Error ? e.message : "Local storage is unavailable.",
        );
        setLoaded(true);
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      mounted.current = false;
      player.current.stop();
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (draft) {
      player.current.stop();
      speechGeneration.current++;
      isSpeaking.current = false;
      setSpeaking(false);
    }
  }, [draft]);
  function stopSpeech() {
    speechGeneration.current++;
    player.current.stop();
    isSpeaking.current = false;
    setSpeaking(false);
    activation.current = waitForRelease(performance.now());
    setProgress(0);
    setStatus("Relax your hand before the next phrase.");
  }
  function changeMode(next: "communicate" | "setup") {
    stopSpeech();
    setActive(null);
    activation.current = initialActivation();
    setStatus("Ready when you are.");
    setMode(next);
    setError("");
  }
  async function playPhrase(p: Phrase) {
    const generation = ++speechGeneration.current;
    activation.current = waitForRelease(performance.now());
    setProgress(0);
    setActive(p.id);
    setStatus("Speaking in a familiar voice.");
    setSpeaking(true);
    isSpeaking.current = true;
    try {
      await player.current.play(p.audio, () => {
        if (mounted.current && generation === speechGeneration.current) {
          isSpeaking.current = false;
          setSpeaking(false);
          activation.current = waitForRelease(performance.now());
          setStatus("Relax your hand before the next phrase.");
        }
      });
      setSoundEnabled(true);
    } catch {
      if (mounted.current && generation === speechGeneration.current) {
        isSpeaking.current = false;
        setSpeaking(false);
        setError(
          "Audio could not play. Check your speaker, then press a phrase button to enable sound.",
        );
        activation.current = waitForRelease(performance.now());
        setStatus("Audio needs your attention.");
      }
    }
  }
  function observe(o: Observation) {
    if (isSpeaking.current) return;
    const result = o ? predict(o.features, o.hand, phrases) : null;
    const next = advance(
      activation.current,
      result?.id ?? null,
      performance.now(),
    );
    activation.current = next.state;
    setProgress(next.progress);
    if (next.fire && soundEnabled) {
      const p = phrases.find((p) => p.id === next.fire);
      if (p) void playPhrase(p);
      return;
    }
    if (next.state.phase === "waiting") {
      setStatus("Relax your hand before the next phrase.");
      return;
    }
    if (next.state.phase === "holding") {
      setActive(next.state.id);
      setStatus(
        soundEnabled
          ? "Keep holding your gesture…"
          : "Tap a phrase once to enable sound.",
      );
    } else {
      setStatus(
        o
          ? "No phrase recognized. Try your enrolled pose."
          : "Show one hand to communicate.",
      );
      setActive(null);
    }
  }
  async function remove(p: Phrase) {
    setBusy(true);
    setError("");
    stopSpeech();
    try {
      await deletePhrase(p.id);
      await refresh();
      setDeleting(null);
    } catch {
      setError("Could not delete this phrase. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function offlineSetup() {
    stopSpeech();
    setCameraEpoch((v) => v + 1);
    setPreparing(true);
    setError("");
    try {
      await prepareOffline(setOffline);
      setOffline(
        "Assets saved for offline use. Disconnect and reload to verify on this device.",
      );
    } catch (e) {
      setOffline("");
      setError(e instanceof Error ? e.message : "Offline setup failed.");
    } finally {
      setPreparing(false);
    }
  }
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="Kumpas home">
          <img
            className="brand-logo"
            src="/images/workshop-spark.png"
            alt=""
            width={42}
            height={42}
          />
          <span>
            kumpas<small>Movement with meaning.</small>
          </span>
        </a>
        <div className="header-right">
          <span className="local-label">On this device</span>
          <span className={`network ${online ? "" : "disconnected"}`}>
            {online ? "Connected" : "Offline"}
          </span>
        </div>
      </header>
      {!draft && (
        <nav className="mode-nav" aria-label="Workspace mode">
          <button
            aria-current={mode === "communicate" ? "page" : undefined}
            onClick={() => changeMode("communicate")}
          >
            Communicate
          </button>
          <button
            aria-current={mode === "setup" ? "page" : undefined}
            onClick={() => changeMode("setup")}
          >
            Set up phrases <span>{phrases.length}/3</span>
          </button>
        </nav>
      )}
      <main>
        {error && (
          <div className="error" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}
        {!loaded ? (
          <div className="loading-state">
            Opening your local phrase notebook…
          </div>
        ) : draft ? (
          <Enrollment
            existing={draft === "new" ? undefined : draft}
            phrases={phrases}
            onClose={() => setDraft(null)}
            onSaved={() => {
              setDraft(null);
              void refresh();
              setMode("setup");
            }}
          />
        ) : mode === "setup" ? (
          <>
            <div className="section-heading">
              <div>
                <p className="eyebrow">Words that belong to you</p>
                <h1>A voice for your everyday.</h1>
                <p>Pair a comfortable gesture with words from home.</p>
              </div>
              <button
                className="button primary"
                disabled={phrases.length >= 3}
                onClick={() => {
                  setError("");
                  setDraft("new");
                }}
              >
                + Add a phrase
              </button>
            </div>
            <div className="phrase-list">
              {phrases.map((p, i) => (
                <article key={p.id} className="saved-phrase">
                  <span className="phrase-number">0{i + 1}</span>
                  <div>
                    <h2>{p.text}</h2>
                    <p>
                      {p.hand} hand · {(p.durationMs / 1000).toFixed(1)}s
                      recording · {p.examples.length} examples
                    </p>
                  </div>
                  <div className="phrase-actions">
                    <button
                      className="button subtle"
                      onClick={() => void playPhrase(p)}
                    >
                      Listen
                    </button>
                    <button
                      className="button subtle"
                      onClick={() => {
                        stopSpeech();
                        setDraft(p);
                      }}
                    >
                      Edit & reteach
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setDeleting(p.id)}
                    >
                      Delete
                    </button>
                  </div>
                  {deleting === p.id && (
                    <div className="delete-confirm">
                      <p>
                        Delete this phrase, recording, and gesture from this
                        browser?
                      </p>
                      <button
                        className="button danger"
                        disabled={busy}
                        onClick={() => void remove(p)}
                      >
                        Delete phrase
                      </button>
                      <button
                        className="button subtle"
                        disabled={busy}
                        onClick={() => setDeleting(null)}
                      >
                        Keep phrase
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
            {phrases.length === 0 && (
              <section className="empty-notebook">
                <span className="eyebrow">Start with one small request</span>
                <h2>“Ma, pahingi ng tubig.”</h2>
                <p>
                  Record a familiar voice, then teach a gesture you can
                  comfortably repeat. Add up to three phrases to begin.
                </p>
                <button
                  className="button primary"
                  onClick={() => setDraft("new")}
                >
                  Create your first phrase →
                </button>
              </section>
            )}
            <aside className="setup-note">
              <h3>Personal gestures. Personal voices.</h3>
              <p>
                You choose what each pose means. Kumpas recognizes only the
                poses you teach it; this is not Filipino Sign Language
                translation.
              </p>
            </aside>
          </>
        ) : (
          <>
            <div className="section-heading">
              <div>
                <p className="eyebrow">A familiar voice, at your fingertips</p>
                <h1>Say it your way.</h1>
                <p>One comfortable gesture. Words that feel like home.</p>
              </div>
              {phrases.length > 0 && (
                <button className="button subtle" onClick={stopSpeech}>
                  Stop audio
                </button>
              )}
            </div>
            <div className="communication-layout">
              <Camera
                key={`${mode}-${cameraEpoch}`}
                onObservation={observe}
                onError={setError}
              />
              <section
                className="voice-panel"
                aria-label="Communication output"
              >
                <div className="voice-top">
                  <span className="eyebrow">Your voice</span>
                  <span className="phrase-count">
                    {phrases.length}{" "}
                    {phrases.length === 1 ? "phrase" : "phrases"}
                  </span>
                </div>
                <div className={`voice-output ${speaking ? "speaking" : ""}`}>
                  <p className="current-phrase">
                    {active
                      ? phrases.find((p) => p.id === active)?.text
                      : phrases.length
                        ? "A gesture is all it takes."
                        : "Let’s start with your first phrase."}
                  </p>
                  <p className="recognition-status" role="status">
                    {phrases.length
                      ? status
                      : "Record a voice and teach a comfortable pose."}
                  </p>
                  {progress > 0 && (
                    <progress
                      value={progress}
                      max={1}
                      aria-label="Gesture hold progress"
                    />
                  )}
                </div>
                {phrases.length > 0 ? (
                  <>
                    <p className="manual-label">
                      You can also tap to speak
                      {!soundEnabled ? " · tap once to enable sound" : ""}
                    </p>
                    <div className="manual-phrases">
                      {phrases.map((p, i) => (
                        <button
                          key={p.id}
                          className={active === p.id ? "selected" : ""}
                          onClick={() => void playPhrase(p)}
                        >
                          <span>{String(i + 1).padStart(2, "0")}</span>
                          {p.text}
                          <span aria-hidden="true">↗</span>
                        </button>
                      ))}
                    </div>
                    <p className="fine-print">
                      Hold your pose briefly. Relax your hand after each phrase.
                      If Kumpas is unsure, it stays quiet.
                    </p>
                  </>
                ) : (
                  <div className="first-phrase">
                    <button
                      className="button primary"
                      onClick={() => {
                        setMode("setup");
                        setDraft("new");
                      }}
                    >
                      Teach your first phrase →
                    </button>
                    <p>About three minutes. A caregiver can help with setup.</p>
                  </div>
                )}
              </section>
            </div>
            <div className="below-workspace">
              <p>
                <strong>Your movement stays yours.</strong> Hand recognition
                happens here. Camera video is not saved.
              </p>
              <button
                className="text-button"
                onClick={() => changeMode("setup")}
              >
                Manage your phrases →
              </button>
            </div>
          </>
        )}
      </main>
      {!draft && (
        <footer className="app-footer">
          <div>
            <strong>Made for the words closest to home.</strong>
            <p>
              Personal communication prototype · best on desktop Chrome or Edge.
            </p>
            {offline && (
              <p className="offline-feedback" role="status">
                {offline}
              </p>
            )}
          </div>
          <button
            className="button subtle"
            disabled={preparing}
            onClick={() => void offlineSetup()}
          >
            {preparing ? "Saving offline assets…" : "Prepare offline use"}
          </button>
        </footer>
      )}
    </div>
  );
}
