import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RelayStore } from "./relay-store";

let store: RelayStore;

beforeEach(() => {
  store = new RelayStore(":memory:");
});

afterEach(() => {
  store.close();
});

const payload = {
  model: "llama3.2",
  messages: [
    { role: "system" as const, content: "Use supplied context." },
    { role: "user" as const, content: "Hello" },
  ],
};

describe("RelayStore", () => {
  it("leases a job only to a connector that supports its model", () => {
    const id = store.enqueue(payload, 1_000);
    expect(store.claim("connector-a", ["other-model"], 1_010)).toBeNull();

    const job = store.claim("connector-a", ["llama3.2"], 1_020);
    expect(job).toMatchObject({ id, model: "llama3.2" });
    expect(store.get(id, 1_030)).toEqual({ status: "leased" });
  });

  it("accepts a result only from the connector holding the lease", () => {
    const id = store.enqueue(payload, 1_000);
    store.claim("connector-a", ["llama3.2"], 1_010);

    expect(
      store.complete(id, "connector-b", { reply: "stolen" }, 1_020),
    ).toBe(false);
    expect(
      store.complete(id, "connector-a", { reply: "safe reply" }, 1_030),
    ).toBe(true);
    expect(store.get(id, 1_040)).toEqual({
      status: "complete",
      reply: "safe reply",
    });
  });

  it("releases an expired lease for another connector", () => {
    const id = store.enqueue(payload, 1_000);
    store.claim("connector-a", ["llama3.2"], 1_010);
    const reclaimed = store.claim("connector-b", ["llama3.2"], 31_011);
    expect(reclaimed?.id).toBe(id);
  });

  it("does not expose an expired request as queued", () => {
    const id = store.enqueue(payload, 1_000);
    expect(store.get(id, 121_001)).toEqual({
      status: "failed",
      error: "The local model request expired.",
    });
  });
});
