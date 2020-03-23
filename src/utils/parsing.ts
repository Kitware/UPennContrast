function parseTime(s: string): string | null {
  const re = /time(\d+)/;
  const match = s.match(re);

  return match ? match[1] : null;
}

function parseXY(s: string): string | null {
  const re = /XY(\d+)/;
  const match = s.match(re);

  return match ? match[1] : null;
}

function collectFilenameMetadata(
  filenames: string[]
): { xy: string[]; t: string[] } {
  const times = filenames.map(parseTime);
  const xys = filenames.map(parseXY);

  return {
    t: times.filter(d => d !== null).sort(),
    xy: xys.filter(d => d !== null).sort()
  };
}
