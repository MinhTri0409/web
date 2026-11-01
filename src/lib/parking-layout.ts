const ZONE_CORNERS = [
  "Góc trên bên trái",
  "Góc trên bên phải",
  "Góc dưới bên trái",
  "Góc dưới bên phải",
];

export type ParkingZone<T> = {
  index: number;
  letter: string;
  label: string;
  corner: string;
  slots: T[];
};

function slotNumber(code: string): number | null {
  const match = code.match(/(\d+)$/);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function zoneLetter(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

export function parkingLocation(code: string): { zone: string; position: string; label: string } {
  const number = slotNumber(code);
  if (number === null) {
    return { zone: "Khu chưa xác định", position: code, label: code };
  }
  const zoneIndex = Math.floor((number - 1) / 10);
  const letter = zoneLetter(zoneIndex);
  const position = `${letter}${((number - 1) % 10) + 1}`;
  const zone = `Khu ${letter}`;
  return { zone, position, label: `${zone} · ${position}` };
}

export function groupParkingSlots<T extends { code?: unknown }>(slots: T[]): ParkingZone<T>[] {
  const grouped = new Map<number, T[]>();
  for (const slot of slots) {
    const code = typeof slot.code === "string" ? slot.code : "";
    const number = slotNumber(code);
    const index = number === null ? 0 : Math.floor((number - 1) / 10);
    const zoneSlots = grouped.get(index) ?? [];
    zoneSlots.push(slot);
    grouped.set(index, zoneSlots);
  }

  return Array.from(grouped, ([index, zoneSlots]) => {
    const letter = zoneLetter(index);
    return {
      index,
      letter,
      label: `Khu ${letter}`,
      corner: ZONE_CORNERS[index] ?? "Dãy tiếp theo",
      slots: zoneSlots,
    };
  }).sort((left, right) => left.index - right.index);
}
