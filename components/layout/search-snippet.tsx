/**
 * Safe renderer for ts_headline output.
 *
 * Postgres returns the snippet pre-marked with literal `<mark>` and
 * `</mark>` tags around hits. We escape everything else so a malicious
 * post body can't inject HTML, then re-allow just `<mark>` by splitting on
 * the token and wrapping the highlighted chunks in a real <mark> element.
 */
export function SearchSnippet({ snippet }: { snippet: string | null }) {
  if (!snippet) return null;
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  let highlight = false;
  // Split on <mark> / </mark> as plain tokens. Everything outside is
  // text-escaped via React's default. Highlighted chunks render through a
  // wrapped <mark> element.
  const tokens = snippet.split(/(<mark>|<\/mark>)/g);
  for (const tok of tokens) {
    if (tok === "<mark>") {
      highlight = true;
      continue;
    }
    if (tok === "</mark>") {
      highlight = false;
      continue;
    }
    if (!tok) continue;
    parts.push(
      highlight ? (
        <mark
          key={key++}
          className="rounded-sm bg-primary/20 px-0.5 text-foreground"
        >
          {tok}
        </mark>
      ) : (
        <span key={key++}>{tok}</span>
      ),
    );
    void i;
  }
  return (
    <span className="text-xs text-muted-foreground line-clamp-2">
      {parts}
    </span>
  );
}
