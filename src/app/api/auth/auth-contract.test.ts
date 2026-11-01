import assert from "node:assert/strict";
import test from "node:test";

import { isCanonicalSpringRedirect, parseLoginRequest } from "./auth-contract.ts";

test("parses a valid JSON login request", () => {
  assert.deepEqual(parseLoginRequest({ username: "admin", password: "secret" }), {
    username: "admin",
    password: "secret",
  });
});

test("rejects missing and wrong-type login fields", () => {
  assert.equal(parseLoginRequest({ username: "admin" }), null);
  assert.equal(parseLoginRequest({ username: 42, password: "secret" }), null);
  assert.equal(parseLoginRequest({ username: "", password: "secret" }), null);
  assert.equal(parseLoginRequest(null), null);
});

test("accepts only Spring canonical redirect destinations", () => {
  assert.equal(isCanonicalSpringRedirect("/admin"), true);
  assert.equal(isCanonicalSpringRedirect("/dashboard"), true);
  assert.equal(isCanonicalSpringRedirect(null), true);
  assert.equal(isCanonicalSpringRedirect("https://example.com"), false);
  assert.equal(isCanonicalSpringRedirect("//example.com"), false);
  assert.equal(isCanonicalSpringRedirect("/unknown"), false);
});
