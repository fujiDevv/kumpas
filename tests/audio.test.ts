import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { PhrasePlayer } from "../lib/audio";
class FakeAudio {
  static instances: FakeAudio[] = [];
  static blocked = false;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  pause = vi.fn();
  play = vi.fn(async () => {
    if (FakeAudio.blocked) throw new Error("Playback blocked");
  });
  constructor(_url: string) {
    FakeAudio.instances.push(this);
  }
}
beforeEach(() => {
  FakeAudio.instances = [];
  FakeAudio.blocked = false;
  vi.stubGlobal("Audio", FakeAudio);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:example");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("stops old playback, revokes URLs, and suppresses stale completion", async () => {
  const p = new PhrasePlayer(),
    first = vi.fn(),
    second = vi.fn();
  await p.play(new Blob(["a"]), first);
  const old = FakeAudio.instances[0],
    stale = old.onended;
  await p.play(new Blob(["b"]), second);
  stale?.();
  expect(old.pause).toHaveBeenCalled();
  expect(first).not.toHaveBeenCalled();
  FakeAudio.instances[1].onended?.();
  expect(second).toHaveBeenCalledOnce();
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
});
it("cleans resources when autoplay is rejected", async () => {
  const p = new PhrasePlayer();
  FakeAudio.blocked = true;
  await expect(p.play(new Blob(["a"]), vi.fn())).rejects.toThrow(
    "Playback blocked",
  );
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});

it("reports late decode errors separately from successful completion", async () => {
  const p = new PhrasePlayer(),
    ended = vi.fn(),
    error = vi.fn();
  await p.play(new Blob(["bad clip"]), ended, error);
  FakeAudio.instances[0].onerror?.();
  expect(ended).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledOnce();
  expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
});
it("returns false when playback is cancelled while play is pending", async () => {
  let resolve!: () => void;
  const p = new PhrasePlayer();
  class PendingAudio extends FakeAudio {
    play = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
  }
  vi.stubGlobal("Audio", PendingAudio);
  const pending = p.play(new Blob(["clip"]), vi.fn());
  p.stop();
  resolve();
  expect(await pending).toBe(false);
});
it("suppresses late errors belonging to older playback", async () => {
  const p = new PhrasePlayer(),
    error = vi.fn();
  await p.play(new Blob(["a"]), vi.fn(), error);
  const stale = FakeAudio.instances[0].onerror;
  await p.play(new Blob(["b"]), vi.fn(), error);
  stale?.();
  expect(error).not.toHaveBeenCalled();
  expect(FakeAudio.instances[1].pause).not.toHaveBeenCalled();
});
