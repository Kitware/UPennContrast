function applyRegex(regex: RegExp, s: string): string | null {
  const match = s.match(regex);
  return match ? match[1] : null;
}

export const parseZ: (s: string) => string | null = applyRegex.bind(null, /Z(\d+)/);
export const parseTime: (s: string) => string | null = applyRegex.bind(null, /time(\d+)/);
export const parseXY: (s: string) => string | null = applyRegex.bind(null, /XY(\d+)/);

export function getFilenameMetadata(
  filename: string
): { xy: string | null; t: string | null } {
  return {
    t: parseTime(filename),
    xy: parseXY(filename)
  };
}

function stringToNumber(val: string | null): number | null {
  return val === null ? null : +val;
}

export function getNumericMetadata(
  filename: string
): { xy: number | null; t: number | null } {
  const metadata = getFilenameMetadata(filename);
  return {
    t: stringToNumber(metadata.t),
    xy: stringToNumber(metadata.xy)
  };
}

export function collectFilenameMetadata(
  filenames: string[]
): { xy: string[]; t: string[] } {
  const times = filenames.map(parseTime);
  const xys = filenames.map(parseXY);

  return {
    t: times.filter(d => d !== null).sort(),
    xy: xys.filter(d => d !== null).sort()
  };
}
