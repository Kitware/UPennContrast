export const compositionModes = {
  lighten: {
    text: "Lighten",
    help: "Retains the lightest pixels of both layers.",
  },
  screen: {
    text: "Screen",
    help: "The pixels are inverted, multiplied, and inverted again. A lighter picture is the result (opposite of multiply)",
  },
  luminosity: {
    text: "Luminosity",
    help: "Preserves the hue and chroma of the bottom layer, while adopting the luma of the top layer.",
  },
  difference: {
    text: "Difference",
    help: "Subtracts the bottom layer from the top layer or the other way round to always get a positive value.",
  },
  exclusion: {
    text: "Exclusion",
    help: "Like difference, but with lower contrast.",
  },
};

export const advancedCompositionModes = {
  darken: {
    text: "Darken",
    help: "Retains the darkest pixels of both layers.",
  },
  normal: {
    text: "Normal",
    help: "Draws new shapes on top of the existing canvas content.",
  },
  color: {
    text: "Color",
    help: "Preserves the luma of the bottom layer, while adopting the hue and chroma of the top layer.",
  },
  saturation: {
    text: "Saturation",
    help: "Preserves the luma and hue of the bottom layer, while adopting the chroma of the top layer.",
  },
  hue: {
    text: "Hue",
    help: "Preserves the luma and chroma of the bottom layer, while adopting the hue of the top layer.",
  },
  "soft-light": {
    text: "Soft light",
    help: "A softer version of hard-light. Pure black or white does not result in pure black or white.",
  },
  "hard-light": {
    text: "Hard light",
    help: "A combination of multiply and screen like overlay, but with top and bottom layer swapped.",
  },
  "color-burn": {
    text: "Color burn",
    help: "Divides the inverted bottom layer by the top layer, and then inverts the result.",
  },
  "color-dodge": {
    text: "Color dodge",
    help: "Divides the bottom layer by the inverted top layer.",
  },
  overlay: {
    text: "Overlay",
    help: "A combination of multiply and screen. Dark parts on the base layer become darker, and light parts become lighter.",
  },
  multiply: {
    text: "Multiply",
    help: "The pixels of the top layer are multiplied with the corresponding pixel of the bottom layer. A darker picture is the result.",
  },
};

export const compositionItems = Object.entries(compositionModes).map(
  ([mode, data]) => ({ value: mode as TCompositionMode, ...data }),
);

export const advancedCompositionItems = Object.entries(
  advancedCompositionModes,
).map(([mode, data]) => ({ value: mode as TCompositionMode, ...data }));

export type TCompositionMode =
  | keyof typeof compositionModes
  | keyof typeof advancedCompositionModes;
