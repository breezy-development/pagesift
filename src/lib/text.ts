/** Returns the items if every non-empty line is a "- ", "* " or "• " bullet, otherwise null. */
export function bulletItems(text: string): string[] | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2 || !lines.every((l) => /^[-*•]\s+/.test(l))) return null;
  return lines.map((l) => l.replace(/^[-*•]\s+/, ""));
}
