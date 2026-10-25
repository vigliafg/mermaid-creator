import { afterEach, describe, expect, it, vi } from "vitest";
import { createSaveQueue, type BoardSaveState } from "./saveQueue";

afterEach(() => {
  vi.useRealTimers();
});

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("save queue", () => {
  it("fa debounce e salva solo l'ultima scena", async () => {
    vi.useFakeTimers();
    const saves: string[] = [];
    const states: BoardSaveState[] = [];
    const queue = createSaveQueue({
      save: async (scene) => {
        saves.push(scene);
      },
      onState: (state) => states.push(state),
      debounceMs: 600,
    });

    queue.notify("a");
    queue.notify("b");
    await vi.advanceTimersByTimeAsync(599);
    expect(saves).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    await queue.flush();
    expect(saves).toEqual(["b"]);
    expect(states).toContain("dirty");
    expect(queue.state()).toBe("saved");
  });

  it("serializza le revisioni arrivate durante un salvataggio", async () => {
    const saves: string[] = [];
    const first = deferred();
    const queue = createSaveQueue({
      save: async (scene) => {
        saves.push(scene);
        if (saves.length === 1) await first.promise;
      },
      debounceMs: 0,
    });

    queue.notify("a");
    const flushing = queue.flush();
    await Promise.resolve();
    queue.notify("b");
    first.resolve();
    expect(await flushing).toBe(true);
    await queue.flush();
    expect(saves).toEqual(["a", "b"]);
    expect(queue.revision()).toEqual({ current: 2, saved: 2 });
    expect(queue.state()).toBe("saved");
  });

  it("dopo un errore resta in error e ritenta alla notifica successiva", async () => {
    const saves: string[] = [];
    const states: BoardSaveState[] = [];
    const errors: string[] = [];
    const queue = createSaveQueue({
      save: async (scene) => {
        saves.push(scene);
        if (scene === "bad") throw new Error("DB offline");
      },
      onState: (state) => states.push(state),
      onError: (message) => errors.push(message),
      debounceMs: 0,
    });

    queue.notify("bad");
    expect(await queue.flush()).toBe(false);
    expect(queue.state()).toBe("error");
    expect(states).toContain("error");
    expect(errors).toEqual(["DB offline"]);

    queue.notify("good");
    expect(await queue.flush()).toBe(true);
    expect(queue.state()).toBe("saved");
    expect(saves).toEqual(["bad", "good"]);
  });

  it("il reset non salva la scena precedente", async () => {
    const saves: string[] = [];
    const queue = createSaveQueue({
      save: async (scene) => {
        saves.push(scene);
      },
      debounceMs: 10,
    });

    queue.notify("pending");
    queue.reset("server");
    await queue.flush();
    expect(saves).toEqual([]);
    expect(queue.state()).toBe("saved");
    expect(queue.revision()).toEqual({ current: 0, saved: 0 });
  });

  it("scarta una notifica arrivata dopo il reset", async () => {
    const saves: string[] = [];
    const queue = createSaveQueue({
      save: async (scene) => {
        saves.push(scene);
      },
      debounceMs: 0,
    });

    queue.reset("server");
    queue.notify("new");
    await queue.flush();
    expect(saves).toEqual(["new"]);
  });
});
