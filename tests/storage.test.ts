import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import { loadPhrases, savePhrase, deletePhrase } from "../lib/storage";
import { phrase } from "./fixtures";
it("persists complete phrases, prevents a fourth, preserves an old phrase on failed update, and deletes its blob/examples", async () => {
  const a = phrase("a");
  await savePhrase(a);
  await savePhrase(phrase("b"));
  await savePhrase(phrase("c"));
  expect((await loadPhrases()).length).toBe(3);
  await expect(savePhrase(phrase("d"))).rejects.toThrow();
  await expect(savePhrase({ ...a, text: "" })).rejects.toThrow();
  expect((await loadPhrases()).find((p) => p.id === "a")?.text).toBe("Tubig");
  await savePhrase({ ...a, text: "Pahingi ng tubig" });
  expect((await loadPhrases()).find((p) => p.id === "a")?.text).toBe(
    "Pahingi ng tubig",
  );
  await deletePhrase("a");
  expect((await loadPhrases()).map((p) => p.id)).not.toContain("a");
  await savePhrase(phrase("d"));
  expect((await loadPhrases()).length).toBe(3);
});
