const COUNTRY_FORMATS: { code: string; groups: number[] }[] = [
  { code: "+998", groups: [2, 3, 2, 2] },
  { code: "+996", groups: [3, 3, 3] },
  { code: "+7", groups: [3, 3, 2, 2] },
  { code: "+1", groups: [3, 3, 4] },
];

export function formatPhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, "");

  if (!digits.startsWith("+")) {
    return digits;
  }

  const match = COUNTRY_FORMATS.find((f) => digits.startsWith(f.code));
  if (!match) {
    return digits;
  }

  const rest = digits.slice(match.code.length);
  const parts: string[] = [match.code];
  let pos = 0;

  for (const len of match.groups) {
    const chunk = rest.slice(pos, pos + len);
    if (chunk.length === 0) break;
    parts.push(chunk);
    pos += len;
  }

  return parts.join(" ");
}

export function normalizePhone(input: string): string {
  return input.replace(/\s/g, "");
}
