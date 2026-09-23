import test from "node:test";
import assert from "node:assert/strict";
import { createRecordId } from "../src/lib/record-id.ts";

test("generates IDs when randomUUID is unavailable on HTTP", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis.crypto, "randomUUID");
  Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
  try {
    const ids = Array.from({ length: 100 }, () => createRecordId());
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^[0-9a-f]{32}$/);
  } finally {
    if (original) Object.defineProperty(globalThis.crypto, "randomUUID", original);
    else Reflect.deleteProperty(globalThis.crypto, "randomUUID");
  }
});

test("uses the native UUID generator when available", () => {
  assert.match(createRecordId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
