function applyRegex(regex: RegExp, s: string): string | null {
  const match = s.match(regex);
  return match ? match[1] : null;
}

export function makeAlternation(strings: string[]): string {
  return strings.join("|");
}

const triggerZ = ["z", "slice"];
export const parseZ: (s: string) => string | null = applyRegex.bind(
  null,
  new RegExp(`(?:^|[_\\-])(?:${makeAlternation(triggerZ)})(\\d+)`, "i")
);

const triggerTime = ["time", "t", "date", "hour", "min", "wk", "d", "h"];
export const parseTime: (s: string) => string | null = applyRegex.bind(
  null,
  new RegExp(`(?:^|[_\\-])(?:${makeAlternation(triggerTime)})(\\d+)`, "i")
);

const triggerXY = ["xy", "x", "y", "stage", "pos"];
export const parseXY: (s: string) => string | null = applyRegex.bind(
  null,
  new RegExp(`(?:^|[_\\-])(?:${makeAlternation(triggerXY)})(\\d+)`, "i")
);

const triggerChannel = ["channel", "ch", "c", "wave"];
export const parseChannel: (s: string) => string | null = applyRegex.bind(
  null,
  new RegExp(
    `(?:^|[_\\-])(?:${makeAlternation(triggerChannel)})(.+?)[_\\.\\-]`,
    "i"
  )
);

export const triggers = [
  ...triggerZ,
  ...triggerTime,
  ...triggerXY,
  ...triggerChannel
];

interface FilenameMetadata {
  t: string | null;
  xy: string | null;
  z: string | null;
  chan: string | null;
}

interface NumericMetadata {
  t: number | null;
  xy: number | null;
  z: number | null;
  chan: string | null;
}

export function getFilenameMetadata(filename: string): FilenameMetadata {
  return {
    t: parseTime(filename),
    xy: parseXY(filename),
    z: parseZ(filename),
    chan: parseChannel(filename)
  };
}

function stringToNumber(val: string | null): number | null {
  return val === null ? null : +val;
}

export function getNumericMetadata(filename: string): NumericMetadata {
  const metadata = getFilenameMetadata(filename);
  return {
    t: stringToNumber(metadata.t),
    xy: stringToNumber(metadata.xy),
    z: stringToNumber(metadata.z),
    chan: metadata.chan
  };
}

export function collectFilenameMetadata(
  filenames: string[]
): { xy: string[]; t: string[]; z: string[]; chan: string[] } {
  const times = filenames.map(parseTime);
  const xys = filenames.map(parseXY);
  const zs = filenames.map(parseZ);
  const channels = filenames.map(parseChannel);

  return {
    t: times.filter(d => d !== null).sort() as string[],
    xy: xys.filter(d => d !== null).sort() as string[],
    z: zs.filter(d => d !== null).sort() as string[],
    chan: channels.filter(d => d !== null).sort() as string[]
  };
}
