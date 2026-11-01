function correctDigits(value: string): string {
  return value.replace(/[OQD]/g, "0").replace(/[IL]/g, "1").replace(/Z/g, "2").replace(/S/g, "5").replace(/B/g, "8").replace(/G/g, "6");
}

function correctLetters(value: string): string {
  return value.replace(/0/g, "O").replace(/1/g, "I").replace(/2/g, "Z").replace(/5/g, "S").replace(/6/g, "G").replace(/8/g, "B");
}

function normalizeCompactPlate(compact: string): string | null {
  if (compact.length < 8 || compact.length > 10) return null;

  const provinceCode = correctDigits(compact.slice(0, 2));
  if (!/^\d{2}$/.test(provinceCode)) return null;

  const remainder = compact.slice(2);
  const seriesLengths = remainder.length === 7 ? [2, 1] : [1, 2];
  for (const seriesLength of seriesLengths) {
    const rawSeries = remainder.slice(0, seriesLength);
    const digits = correctDigits(remainder.slice(seriesLength));
    if (!/^\d{5,6}$/.test(digits)) continue;

    const series = seriesLength === 1
      ? correctLetters(rawSeries)
      : `${correctLetters(rawSeries[0])}${/^\d$/.test(rawSeries[1]) ? correctDigits(rawSeries[1]) : correctLetters(rawSeries[1])}`;
    if (!/^[A-Z][A-Z0-9]?$/.test(series)) continue;

    return `${provinceCode}${series}-${digits.slice(0, -2)}.${digits.slice(-2)}`;
  }

  return null;
}

export function normalizeVietnamesePlate(text: string): string | null {
  const compact = text.toLocaleUpperCase("en-US").replace(/[^A-Z0-9]/g, "");
  const directMatch = normalizeCompactPlate(compact);
  if (directMatch) return directMatch;

  for (let length = Math.min(10, compact.length); length >= 8; length -= 1) {
    for (let start = 0; start <= compact.length - length; start += 1) {
      const plate = normalizeCompactPlate(compact.slice(start, start + length));
      if (plate) return plate;
    }
  }

  return null;
}
