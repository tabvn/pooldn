/**
 * Render a country flag from a 2-letter ISO code (e.g. "CA", "VN"). Falls
 * back to the raw code wrapped in parens when the code isn't 2 letters.
 *
 * Uses Unicode regional-indicator symbols so we don't ship any flag images —
 * the OS renders them as the country flag. Server-safe (pure function).
 */
/**
 * Bare flag emoji string for a 2-letter ISO code, or "" when the code isn't
 * a valid 2-letter code. Use where a component can't be rendered (e.g. a
 * string-typed page title): `${name} ${flagEmoji(nationality)}`.
 */
export function flagEmoji(code: string | null | undefined): string {
  if (!code) return "";
  const c = code.trim().toUpperCase();
  if (c.length !== 2 || !/^[A-Z]{2}$/.test(c)) return "";
  return String.fromCodePoint(
    0x1f1e6 + (c.charCodeAt(0) - 65),
    0x1f1e6 + (c.charCodeAt(1) - 65),
  );
}

export function CountryFlag({
  code,
  className,
}: {
  code: string | null | undefined;
  className?: string;
}) {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  if (c.length !== 2 || !/^[A-Z]{2}$/.test(c)) {
    return <span className={className}>({code})</span>;
  }
  const flag = String.fromCodePoint(
    0x1f1e6 + (c.charCodeAt(0) - 65),
    0x1f1e6 + (c.charCodeAt(1) - 65),
  );
  return (
    <span
      role="img"
      aria-label={`${c} flag`}
      className={className}
      data-testid={`country-flag-${c}`}
    >
      {flag}
    </span>
  );
}
