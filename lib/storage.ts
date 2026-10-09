import {
  MAX_DISTANCE,
  MIN_MARGIN,
  negativesPreserveGesture,
  overlaps,
} from "./classifier";
import { FEATURE_VERSION, type Phrase } from "./types";
let pending: Promise<IDBDatabase> | undefined;
function db(): Promise<IDBDatabase> {
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open("kumpas-v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("phrases", { keyPath: "id" });
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => {
        request.result.close();
        pending = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      pending = undefined;
      reject(request.error);
    };
    request.onblocked = () => {
      blocked = true;
      pending = undefined;
      reject(new Error("Close other Kumpas tabs and try again."));
    };
  });
  return pending;
}
export async function loadPhrases(): Promise<Phrase[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const r = database
      .transaction("phrases", "readonly")
      .objectStore("phrases")
      .getAll();
    r.onsuccess = () =>
      resolve((r.result as Phrase[]).sort((a, b) => a.createdAt - b.createdAt));
    r.onerror = () => reject(r.error);
  });
}
export async function savePhrase(phrase: Phrase) {
  if (
    !phrase.text.trim() ||
    !(phrase.audio instanceof Blob) ||
    !phrase.audio.size ||
    phrase.examples.length < 24 ||
    new Set(phrase.examples.map((e) => e.session)).size !== 3 ||
    [...new Set(phrase.examples.map((e) => e.session))].some(
      (session) =>
        phrase.examples.filter((e) => e.session === session).length < 8,
    ) ||
    !Number.isFinite(phrase.maxDistance) ||
    phrase.maxDistance <= 0 ||
    phrase.maxDistance > MAX_DISTANCE ||
    !Number.isFinite(phrase.minMargin) ||
    phrase.minMargin < MIN_MARGIN ||
    !Number.isFinite(phrase.durationMs) ||
    phrase.durationMs <= 0 ||
    phrase.examples.some(
      (e) =>
        !Number.isFinite(e.session) ||
        e.features.length !== 63 ||
        e.features.some((v) => !Number.isFinite(v)),
    ) ||
    !phrase.negatives ||
    phrase.negatives.length < 8 ||
    phrase.negatives.some(
      (f) => f.length !== 63 || f.some((v) => !Number.isFinite(v)),
    ) ||
    phrase.featureVersion !== FEATURE_VERSION
  )
    throw new Error(
      "Phrase, recording, and gesture examples must be complete.",
    );
  if (!negativesPreserveGesture(phrase, phrase.negatives!))
    throw new Error(
      "The relaxed pose conflicts with your gesture. Repeat the rejection check.",
    );
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction("phrases", "readwrite");
    const store = tx.objectStore("phrases");
    let reason = "Only three phrases can be saved.";
    const read = store.getAll();
    read.onsuccess = () => {
      if (
        read.result.length >= 3 &&
        !read.result.some((p: Phrase) => p.id === phrase.id)
      ) {
        tx.abort();
        return;
      }
      if (
        overlaps(
          phrase,
          (read.result as Phrase[]).filter((p) => p.id !== phrase.id),
        )
      ) {
        reason =
          "Your saved phrases changed during setup. This gesture now conflicts with another phrase. Collect again.";
        tx.abort();
        return;
      }
      store.put(phrase);
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error(reason));
    tx.onerror = () => reject(tx.error);
  });
}
export async function deletePhrase(id: string) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction("phrases", "readwrite");
    tx.objectStore("phrases").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
