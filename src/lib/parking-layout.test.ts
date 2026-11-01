import assert from "node:assert/strict";
import test from "node:test";
import { groupParkingSlots, parkingLocation } from "./parking-layout.ts";

test("groups forty backend slots into four ten-slot parking zones", () => {
  const slots = Array.from({ length: 40 }, (_, index) => ({
    code: `CAR-${String(index + 1).padStart(3, "0")}`,
  }));
  const zones = groupParkingSlots(slots);

  assert.deepEqual(zones.map((zone) => zone.label), ["Khu A", "Khu B", "Khu C", "Khu D"]);
  assert.deepEqual(zones.map((zone) => zone.slots.length), [10, 10, 10, 10]);
  assert.equal(zones[0].slots[0].code, "CAR-001");
  assert.equal(zones[3].slots[9].code, "CAR-040");
});

test("maps backend slot IDs to stable customer-facing labels", () => {
  assert.deepEqual(parkingLocation("CAR-001"), {
    zone: "Khu A",
    position: "A1",
    label: "Khu A · A1",
  });
  assert.equal(parkingLocation("MOTORBIKE-010").position, "A10");
  assert.equal(parkingLocation("MOTORELECTRIC-011").position, "B1");
  assert.equal(parkingLocation("CAR-040").position, "D10");
});

test("retains a readable fallback for slot IDs without a numeric suffix", () => {
  assert.deepEqual(parkingLocation("TEMP"), {
    zone: "Khu chưa xác định",
    position: "TEMP",
    label: "TEMP",
  });
});
