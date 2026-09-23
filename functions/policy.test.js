import assert from "node:assert/strict";
import test from "node:test";
import { canSignIn } from "./policy.js";

const event = {
  eventType: "providers/cloud.auth/eventTypes/user.beforeSignIn:google.com",
  data: { email: "user@gmail.com", emailVerified: true, disabled: false },
};

test("only active permissions allow verified Google accounts", () => {
  assert.equal(canSignIn(event, { active: true }), true);
  for (const permission of [undefined, {}, { active: false }, { active: "true" }]) {
    assert.equal(canSignIn(event, permission), false);
  }
});

test("rejects disabled, unverified, missing-email and non-Google sign-ins", () => {
  for (const data of [{ ...event.data, disabled: true }, { ...event.data, emailVerified: false }, {}]) {
    assert.equal(canSignIn({ ...event, data }, { active: true }), false);
  }
  assert.equal(canSignIn({ ...event, eventType: "user.beforeSignIn:password" }, { active: true }), false);
});
