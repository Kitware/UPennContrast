var pathParse = require("path-parse");

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

const triggerChannel = ["channel", "wave"];
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
  filenames: string[],
  sort: boolean = true
): { xy: string[]; t: string[]; z: string[]; chan: string[] } {
  const times = filenames.map(parseTime);
  const xys = filenames.map(parseXY);
  const zs = filenames.map(parseZ);
  const channels = filenames.map(parseChannel);
  if (sort) {
    return {
      t: times.filter(d => d !== null).sort() as string[],
      xy: xys.filter(d => d !== null).sort() as string[],
      z: zs.filter(d => d !== null).sort() as string[],
      chan: channels.filter(d => d !== null).sort() as string[]
    };
  }

  return {
    t: times.filter(d => d !== null) as string[],
    xy: xys.filter(d => d !== null) as string[],
    z: zs.filter(d => d !== null) as string[],
    chan: channels.filter(d => d !== null) as string[]
  };
}

export function convertDateToTime(filename: string): string {
  const dateRegex = new RegExp("[0-9]{2}d[0-9]{2}h[0-9]{2}m", "i");
  const matching = filename.match(dateRegex);
  if (matching) {
    // Convert date to time in minutes
    const dateInfo = matching[0].match(new RegExp("[0-9]{2}", "g"));
    if (dateInfo && dateInfo.length === 3) {
      const day = Number(dateInfo[0]) as number;
      const hours = Number(dateInfo[1]) as number;
      const minutes = Number(dateInfo[2]) as number;
      const time = day * 24 * 60 + hours * 60 + minutes;
      return filename.replace(dateRegex, `time${time}`);
    }
  }
  return filename;
}

export function splitFilenames(filenames: string[]): string[][] {
  // So far, just assuming 1 level deep. Could parse multiple as well if required.
  return filenames
    .map(filename => pathParse(filename))
    .map(filepathInfo => {
      const info = ("_" + filepathInfo.name).split(/_([^0-9]+|[0-9]+)/);
      info.splice(0, 0, filepathInfo.dir);
      return info;
    });
}

const enumType: { [index: string]: string } = {
  t: "t",
  time: "t",
  timepoint: "t",
  s: "xy",
  stage: "xy",
  position: "xy",
  xy: "xy",
  XY: "xy",
  z: "z",
  Z: "z",
  slice: "z",
  chann: "chan",
  channel: "chan"
};

export function getStringType(inputString: string): string | undefined {
  return enumType[inputString];
}

export function getFields(filenames: string[][]) {
  // Takes the first row and use that as the field value (i.e, time, position, channel, etc)
  const fields: string[] = filenames[0];

  return fields.map((field: string, i: number) => {
    const column: string[] = [];
    for (let j = 0; j < filenames.length; j++) {
      column.push(filenames[j][i]);
    }

    const uniqueValues = Array.from(new Set(column));
    return {
      values: uniqueValues,
      numberOfElement: uniqueValues.length,
      isNumeric: !isNaN(parseInt(field))
    };
  });
}

export function collectFilenameMetadata2(
  filenames: string[]
): {
  metadata: {
    [key: string]: string[];
    t: string[];
    xy: string[];
    z: string[];
    chan: string[];
  };
  filesInfo: {
    [key: string]: { [key: string]: number[] };
  };
} {
  // Convert annoying date format to time
  const convertedFilenames = filenames.map(filename =>
    convertDateToTime(filename)
  );

  // Split up the filenames with delimiters
  const filenamesSplit: string[][] = splitFilenames(convertedFilenames);

  const output: {
    [key: string]: string[];
    t: string[];
    xy: string[];
    z: string[];
    chan: string[];
  } = {
    t: [],
    xy: [],
    z: [],
    chan: []
  };
  const filesInfo: {
    [key: string]: { [key: string]: number[] };
  } = {};

  const fieldsElements = getFields(filenamesSplit);
  fieldsElements.forEach((fieldElement, index) => {
    const { values, numberOfElement, isNumeric } = fieldElement;
    let typename: string | undefined = undefined;
    if (numberOfElement > 1) {
      if (isNumeric) {
        typename =
          index > 0 && fieldsElements[index - 1].numberOfElement === 1
            ? getStringType(fieldsElements[index - 1].values[0])
            : "xy";
      } else {
        // If we just have a bunch of names, then assume it's a channel
        typename = "chan";
      }
      if (typename) {
        output[typename].push(...values);

        filenamesSplit.forEach((split, j) => {
          const filename = filenames[j];
          if (!filesInfo[filename]) {
            filesInfo[filename] = {
              t: [],
              xy: [],
              z: [],
              chan: []
            };
          }
          if (typename) {
            const val: string = split[index];
            const foundIndex = output[typename].indexOf(val);
            if (foundIndex > -1) {
              filesInfo[filename][typename].push(foundIndex);
            }
          }
        });
      }
    }
  });

  return {
    metadata: output,
    filesInfo
  };
}
