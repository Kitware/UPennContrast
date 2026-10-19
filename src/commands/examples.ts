// Example queries for the command palette's placeholder ("Try: z 3 · show
// only DAPI · list Area"). A first query that finds nothing loses the user,
// so the examples are built from the open dataset: every one names a slice,
// layer or property that exists here and runs a real command.

export interface IExampleContext {
  inViewer: boolean;
  isLoggedIn: boolean;
  zCount: number;
  timeCount: number;
  layerNames: string[];
  // Last segment of each property value path ("Area", a gene name).
  propertyNames: string[];
}

/** How many examples the placeholder shows at once. */
export const EXAMPLES_SHOWN = 3;

export function paletteExamples(ctx: IExampleContext): string[] {
  if (!ctx.inViewer) {
    return ctx.isLoggedIn ? ["upload", "tour", "docs"] : ["tour", "docs"];
  }
  const examples: string[] = [];
  if (ctx.zCount > 1) {
    examples.push(`z ${Math.min(3, ctx.zCount)}`);
  }
  if (ctx.layerNames.length > 1) {
    examples.push(`show only ${ctx.layerNames[0]}`);
  }
  if (ctx.propertyNames.length > 0) {
    const name =
      ctx.propertyNames.find((n) => /area/i.test(n)) ?? ctx.propertyNames[0];
    examples.push(`list ${name}`, `color by ${name}`);
  }
  if (ctx.timeCount > 1) {
    examples.push(`t ${Math.min(10, ctx.timeCount)}`);
  }
  if (ctx.zCount > 1) {
    examples.push("merge z");
  }
  // Both verbs: the palette keeps only the one that resolves in the current
  // state (filterResolvable), since "hide objects" finds nothing while hidden.
  examples.push(
    "objects",
    "hide objects",
    "show objects",
    "measure",
    "minimap",
    "snapshot",
  );
  return examples;
}

/**
 * The examples that find something right now: a typed command, or at least
 * one ranked match. State-flipping commands answer only the verb of what they
 * will do, so a fixed example like "hide objects" can stop resolving.
 */
export function filterResolvable(
  examples: string[],
  resolves: (query: string) => boolean,
): string[] {
  return examples.filter(resolves);
}

/**
 * The `EXAMPLES_SHOWN` examples starting at `offset`, wrapping around, as the
 * placeholder text. Fewer examples than slots shows each once.
 */
export function examplePlaceholder(examples: string[], offset: number) {
  if (examples.length === 0) {
    return "Search commands";
  }
  const count = Math.min(EXAMPLES_SHOWN, examples.length);
  const shown = Array.from(
    { length: count },
    (_, i) => examples[(offset + i) % examples.length],
  );
  return `Try: ${shown.join(" · ")}`;
}
