import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVietnamesePlate } from "./license-plate.ts";

test("formats a standard Vietnamese plate read from OCR", () => {
  assert.equal(normalizeVietnamesePlate("51A12345"), "51A-123.45");
});

test("ignores OCR whitespace and punctuation around plate characters", () => {
  assert.equal(normalizeVietnamesePlate(" 59 x1 - 123.45 "), "59X1-123.45");
});

test("formats a plate with a two-letter series", () => {
  assert.equal(normalizeVietnamesePlate("59AA22164"), "59AA-221.64");
});

test("finds a plate when OCR includes surrounding noise", () => {
  assert.equal(normalizeVietnamesePlate("VEHICLE 59 AA 22164"), "59AA-221.64");
});

test("keeps a digit in a motorcycle series when trying a two-character series first", () => {
  assert.equal(normalizeVietnamesePlate("59X112345"), "59X1-123.45");
});

test("corrects common OCR letter/digit confusion in numeric sections", () => {
  assert.equal(normalizeVietnamesePlate("5IA-I23.45"), "51A-123.45");
});

test("rejects text that does not resemble a Vietnamese vehicle plate", () => {
  assert.equal(normalizeVietnamesePlate("DAU XE"), null);
  assert.equal(normalizeVietnamesePlate(""), null);
});
