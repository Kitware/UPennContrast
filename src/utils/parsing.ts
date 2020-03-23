export function parseTime(s: string): string | null {
  const re = /time(\d+)/;
  const match = s.match(re);

  return match ? match[1] : null;
}

export function parseXY(s: string): string | null {
  const re = /XY(\d+)/;
  const match = s.match(re);

  return match ? match[1] : null;
}

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
