export function normalizeSpacing(text: string) {
  return String(text || "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function removeExtraBlankLines(text: string) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function removeEmptyLines(text: string) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function mergeLines(text: string) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function removeLikelyGarbageLines(text: string) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;

      const letters = (line.match(/[a-zA-Z]/g) || []).length;
      const digits = (line.match(/[0-9]/g) || []).length;
      const useful = letters + digits;
      const weird = (line.match(/[^a-zA-Z0-9\s.,:;'"!?$%&()\-+/#[\]]/g) || []).length;

      if (line.length <= 2 && useful === 0) return false;
      if (line.length >= 5 && useful / line.length < 0.32) return false;
      if (weird / Math.max(line.length, 1) > 0.28) return false;

      return true;
    })
    .join("\n")
    .trim();
}

export function cleanStandardText(text: string) {
  return removeLikelyGarbageLines(removeExtraBlankLines(normalizeSpacing(text)));
}