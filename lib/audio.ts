export class PhrasePlayer {
  private audio: HTMLAudioElement | null = null;
  private url: string | null = null;
  private generation = 0;
  stop() {
    this.generation++;
    if (this.audio) {
      this.audio.pause();
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio = null;
    }
    if (this.url) {
      URL.revokeObjectURL(this.url);
      this.url = null;
    }
  }
  async play(
    blob: Blob,
    onEnd: () => void,
    onError: (error: Error) => void = () => {},
  ) {
    this.stop();
    const generation = this.generation;
    let completed = false;
    let failure: Error | null = null;
    this.url = URL.createObjectURL(blob);
    this.audio = new Audio(this.url);
    this.audio.onended = () => {
      if (generation !== this.generation) return;
      completed = true;
      this.stop();
      onEnd();
    };
    this.audio.onerror = () => {
      if (generation !== this.generation) return;
      failure = new Error("The recording could not be decoded or played.");
      this.stop();
      onError(failure);
    };
    try {
      await this.audio.play();
      if (failure) throw failure;
      return completed || generation === this.generation;
    } catch (e) {
      if (generation !== this.generation && !failure) return false;
      if (generation === this.generation) this.stop();
      throw e;
    }
  }
}
export async function recordVoice(
  onStop: (blob: Blob, duration: number) => void,
  onError: (message: string) => void,
): Promise<{ stop: () => void; cancel: () => void }> {
  if (!globalThis.MediaRecorder)
    throw new Error(
      "Voice recording is unavailable in this browser. Try Chrome or Edge.",
    );
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false,
  });
  let recorder: MediaRecorder;
  try {
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
      (v) => MediaRecorder.isTypeSupported(v),
    );
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    throw e;
  }
  const chunks: Blob[] = [];
  const start = performance.now();
  let canceled = false;
  let stoppedAt: number | undefined;
  const close = () => {
    stream.getTracks().forEach((t) => t.stop());
    clearTimeout(timeout);
  };
  const stop = () => {
    stoppedAt ??= performance.now();
    if (recorder.state !== "inactive") recorder.stop();
    close();
  };
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.onstop = () => {
    close();
    if (!canceled) {
      const blob = new Blob(chunks, { type: recorder.mimeType });
      if (blob.size) onStop(blob, (stoppedAt ?? performance.now()) - start);
      else onError("No audio was recorded. Please try again.");
    }
  };
  recorder.onerror = () => {
    canceled = true;
    stop();
    onError("Recording stopped unexpectedly. Please try again.");
  };
  const timeout = setTimeout(stop, 8000);
  try {
    recorder.start();
  } catch (e) {
    close();
    throw e;
  }
  return {
    stop,
    cancel: () => {
      canceled = true;
      stop();
    },
  };
}
