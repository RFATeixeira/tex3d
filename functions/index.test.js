import assert from "node:assert/strict";
import test from "node:test";
import { blockUserCreation, authorizeSignIn } from "./index.js";

test("creation trigger rejects all client registrations", async () => {
  await assert.rejects(
    async () => blockUserCreation.run({ data: { email: "user@gmail.com", emailVerified: true } }),
    { code: "permission-denied" },
  );
});

test("sign-in trigger rejects missing identity before querying permissions", async () => {
  await assert.rejects(
    async () => authorizeSignIn.run({ data: {} }),
    { code: "permission-denied" },
  );
});
