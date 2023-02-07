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

const enumType: { [index: string]: TDimensions } = {
  t: "T",
  time: "T",
  timepoint: "T",
  s: "XY",
  stage: "XY",
  position: "XY",
  xy: "XY",
  XY: "XY",
  z: "Z",
  Z: "Z",
  slice: "Z",
  chann: "C",
  channel: "C"
};

export function getStringType(inputString: string): TDimensions | undefined {
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

export type TDimensions = "XY" | "Z" | "T" | "C";

export interface IVariableGuess {
  guess: TDimensions; // Guessed dimension
  values: string[]; // All the values for this dimension (a list of unique strings)
  valueIdxPerFilename: {
    [key: string]: number; // Index of the value for each filename
  };
}

export function collectFilenameMetadata2(
  filenames: string[]
): IVariableGuess[] {
  // Convert annoying date format to time
  const convertedFilenames = filenames.map(filename =>
    convertDateToTime(filename)
  );

  // Split up the filenames with delimiters
  // Get a matrix of values: filenamesSplit[fileIdx][variableIdx]
  const filenamesSplit: string[][] = splitFilenames(convertedFilenames);

  const guesses: IVariableGuess[] = [];

  // A list of variables
  const fieldsElements = getFields(filenamesSplit);

  fieldsElements.forEach((fieldElement, variableIdx) => {
    const { values, numberOfElement, isNumeric } = fieldElement;
    values.sort((a, b) => a.localeCompare(b));

    // Guess an ID (XY, Z, T, C) for this variable
    let typename: TDimensions | undefined = undefined;
    if (numberOfElement <= 1) {
      return;
    }
    if (isNumeric) {
      typename =
        variableIdx > 0 && fieldsElements[variableIdx - 1].numberOfElement === 1
          ? getStringType(fieldsElements[variableIdx - 1].values[0])
          : "XY";
    } else {
      // If we just have a bunch of names, then assume it's a channel
      typename = "C";
    }

    // If an ID was guessed, add the guess to the list
    if (typename) {
      const valueIdxPerFilename: { [key: string]: number } = {};
      filenames.forEach((filename, filenameIdx) => {
        const filenameValue = filenamesSplit[filenameIdx][variableIdx];
        // We know that filenameValue is in values thanks to the implementation of getFields
        valueIdxPerFilename[filename] = values.findIndex(
          value => value === filenameValue
        );
      });
      const guess: IVariableGuess = {
        guess: typename,
        values: [...values],
        valueIdxPerFilename
      };
      guesses.push(guess);
    }
  });

  return guesses;
}
