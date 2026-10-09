import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import { loadPhrases, savePhrase, deletePhrase } from "../lib/storage";
import { phrase } from "./fixtures";
it("persists complete phrases, prevents a fourth, preserves an old phrase on failed update, and deletes its blob/examples", async () => {
  const a = phrase("a");
  await savePhrase(a);
  await savePhrase(phrase("b", 1));
  await savePhrase(phrase("c", 2));
  expect((await loadPhrases()).length).toBe(3);
  await expect(savePhrase(phrase("d", 3))).rejects.toThrow();
  await expect(savePhrase({ ...a, text: "" })).rejects.toThrow();
  await expect(savePhrase({ ...a, negatives: [] })).rejects.toThrow();
  await expect(
    savePhrase({
      ...a,
      examples: a.examples.map((e) => ({ ...e, features: Array(42).fill(0) })),
    }),
  ).rejects.toThrow();
  expect((await loadPhrases()).find((p) => p.id === "a")?.text).toBe("Tubig");
  await savePhrase({ ...a, text: "Pahingi ng tubig" });
  await expect(savePhrase({ ...a, negatives: [] })).rejects.toThrow();
  await expect(
    savePhrase({
      ...a,
      examples: a.examples.map((e) => ({ ...e, features: Array(42).fill(0) })),
    }),
  ).rejects.toThrow();
  expect((await loadPhrases()).find((p) => p.id === "a")?.text).toBe(
    "Pahingi ng tubig",
  );
  await deletePhrase("a");
  expect((await loadPhrases()).map((p) => p.id)).not.toContain("a");
  await savePhrase(phrase("d", 3));
  expect((await loadPhrases()).length).toBe(3);
});

it("rejects conflicting concurrent saves inside the transaction", async () => {
  for (const p of await loadPhrases()) await deletePhrase(p.id);
  const results = await Promise.allSettled([
    savePhrase(phrase("first", 0)),
    savePhrase(phrase("second", 0)),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  expect(await loadPhrases()).toHaveLength(1);
});
it("rejects uneven attempts and invalid thresholds without replacing a phrase", async () => {
  for (const p of await loadPhrases()) await deletePhrase(p.id);
  const p = phrase("saved");
  await savePhrase(p);
  await expect(savePhrase({ ...p, maxDistance: NaN })).rejects.toThrow();
  await expect(
    savePhrase({
      ...p,
      examples: p.examples.map((e, i) => ({
        ...e,
        session: i < 22 ? 0 : i - 21,
      })),
    }),
  ).rejects.toThrow();
  await expect(
    savePhrase({
      ...p,
      negatives: Array.from({ length: 8 }, () => Array(63).fill(0.005)),
    }),
  ).rejects.toThrow(/relaxed pose/);
  expect((await loadPhrases())[0].audio.size).toBe(p.audio.size);
});
