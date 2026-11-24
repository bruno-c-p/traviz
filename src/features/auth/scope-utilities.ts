const UTILITIES_LAYER = /@layer utilities\s*\{/g;

function blockEnd(css: string, start: number): number {
  let depth = 1;
  let quote: string | null = null;

  for (let index = start; index < css.length; index += 1) {
    const character = css[index];

    if (quote !== null) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
    } else if (character === '"' || character === "'") quote = character;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;

      if (depth === 0) return index;
    }
  }

  throw new Error("The utilities layer has no closing brace.");
}

export function scopeUtilities(css: string, scopeSelector: string): string {
  const layers = [...css.matchAll(UTILITIES_LAYER)];

  if (layers.length === 0) throw new Error("The stylesheet has no utilities layer to scope.");

  let scoped = "";
  let copied = 0;

  for (const layer of layers) {
    const start = layer.index + layer[0].length;

    if (start <= copied) continue;

    const end = blockEnd(css, start);

    scoped += `${css.slice(copied, start)}${scopeSelector}{${css.slice(start, end)}}`;
    copied = end;
  }

  return scoped + css.slice(copied);
}
