import {
  convertDateToTime,
  getFilenameMetadata,
  splitFilenames,
  getStringType,
  collectFilenameMetadata,
  collectFilenameMetadata2,
  getFields
} from "./parsing";

const filenames_directories: string[] = [
  "red/VID1203_B1_1_27d18h32m.tif",
  "red/VID1203_B1_1_15d23h31m.tif",
  "red/VID1203_B1_1_14d01h55m.tif",
  "phase/VID1203_B1_1_27d18h32m.tif",
  "phase/VID1203_B1_1_15d23h31m.tif",
  "phase/VID1203_B1_1_14d01h55m.tif"
];
const output_convert_directories: string[] = [
  "red/VID1203_B1_1_time39992.tif",
  "red/VID1203_B1_1_time23011.tif",
  "red/VID1203_B1_1_time20275.tif",
  "phase/VID1203_B1_1_time39992.tif",
  "phase/VID1203_B1_1_time23011.tif",
  "phase/VID1203_B1_1_time20275.tif"
];
const output_split_directories: string[][] = [
  ["red", "", "VID", "1203", "B", "1", "1", "", "time", "39992"],
  ["red", "", "VID", "1203", "B", "1", "1", "", "time", "23011"],
  ["red", "", "VID", "1203", "B", "1", "1", "", "time", "20275"],
  ["phase", "", "VID", "1203", "B", "1", "1", "", "time", "39992"],
  ["phase", "", "VID", "1203", "B", "1", "1", "", "time", "23011"],
  ["phase", "", "VID", "1203", "B", "1", "1", "", "time", "20275"]
];

const output_directories: {
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
} = {
  metadata: {
    chan: ["red", "phase"],
    t: ["39992", "23011", "20275"],
    xy: [],
    z: []
  },
  filesInfo: {
    "phase/VID1203_B1_1_14d01h55m.tif": {
      chan: [1],
      t: [2],
      xy: [],
      z: []
    },
    "phase/VID1203_B1_1_15d23h31m.tif": {
      chan: [1],
      t: [1],
      xy: [],
      z: []
    },
    "phase/VID1203_B1_1_27d18h32m.tif": {
      chan: [1],
      t: [0],
      xy: [],
      z: []
    },
    "red/VID1203_B1_1_14d01h55m.tif": {
      chan: [0],
      t: [2],
      xy: [],
      z: []
    },
    "red/VID1203_B1_1_15d23h31m.tif": {
      chan: [0],
      t: [1],
      xy: [],
      z: []
    },
    "red/VID1203_B1_1_27d18h32m.tif": {
      chan: [0],
      t: [0],
      xy: [],
      z: []
    }
  }
};

const filenames_combined: string[] = [
  "red_B1_1_t001.tif",
  "red_B1_1_t002.tif",
  "red_B1_1_t003.tif",
  "red_B1_1_t004.tif",
  "phase_B1_1_t001.tif",
  "phase_B1_1_t002.tif",
  "phase_B1_1_t003.tif",
  "phase_B1_1_t004.tif"
];
const output_split_combined: string[][] = [
  ["", "", "red_B", "1", "1", "", "t", "001"],
  ["", "", "red_B", "1", "1", "", "t", "002"],
  ["", "", "red_B", "1", "1", "", "t", "003"],
  ["", "", "red_B", "1", "1", "", "t", "004"],
  ["", "", "phase_B", "1", "1", "", "t", "001"],
  ["", "", "phase_B", "1", "1", "", "t", "002"],
  ["", "", "phase_B", "1", "1", "", "t", "003"],
  ["", "", "phase_B", "1", "1", "", "t", "004"]
];
const output_getFields_combined: {
  values: string[];
  numberOfElement: number;
  isNumeric: boolean;
}[] = [
  { values: [""], numberOfElement: 1, isNumeric: false },
  { values: [""], numberOfElement: 1, isNumeric: false },
  { values: ["red_B", "phase_B"], numberOfElement: 2, isNumeric: false },
  { values: ["1"], numberOfElement: 1, isNumeric: true },
  { values: ["1"], numberOfElement: 1, isNumeric: true },
  { values: [""], numberOfElement: 1, isNumeric: false },
  { values: ["t"], numberOfElement: 1, isNumeric: false },
  {
    values: ["001", "002", "003", "004"],
    numberOfElement: 4,
    isNumeric: true
  }
];
const output_combined: {
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
} = {
  metadata: {
    chan: ["red", "phase"], // TODO: To fix. For now returns red_B and phase_B
    t: ["001", "002", "003", "004"],
    xy: [],
    z: []
  },
  filesInfo: {
    "phase_B1_1_t001.tif": {
      chan: [1],
      t: [0],
      xy: [],
      z: []
    },
    "phase_B1_1_t002.tif": {
      chan: [1],
      t: [1],
      xy: [],
      z: []
    },
    "phase_B1_1_t003.tif": {
      chan: [1],
      t: [2],
      xy: [],
      z: []
    },
    "phase_B1_1_t004.tif": {
      chan: [1],
      t: [3],
      xy: [],
      z: []
    },
    "red_B1_1_t001.tif": {
      chan: [0],
      t: [0],
      xy: [],
      z: []
    },
    "red_B1_1_t002.tif": {
      chan: [0],
      t: [1],
      xy: [],
      z: []
    },
    "red_B1_1_t003.tif": {
      chan: [0],
      t: [2],
      xy: [],
      z: []
    },
    "red_B1_1_t004.tif": {
      chan: [0],
      t: [3],
      xy: [],
      z: []
    }
  }
};

const filenames_nikon: string[] = [
  "FT_705_D1_72HR_wF7.nd2",
  "FT_705_D1_72HR_wF6.nd2",
  "FT_705_D1_72HR_wE8.nd2",
  "FT_705_D1_72HR_wE7.nd2",
  "FT_705_D1_72HR_wE6.nd2",
  "FT_705_D1_72HR_wE5.nd2"
];
const output_nikon: {
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
} = {
  metadata: {
    chan: [],
    t: [],
    xy: [],
    z: []
  },
  filesInfo: {}
};

const filenames_legacy: string[] = [
  "trans001.tif",
  "trans002.tif",
  "trans003.tif",
  "gfp001.tif",
  "gfp002.tif",
  "gfp003.tif",
  "alexa001.tif",
  "alexa002.tif",
  "alexa003.tif"
];
const output_split_legacy: string[][] = [
  ["", "", "trans", "001"],
  ["", "", "trans", "002"],
  ["", "", "trans", "003"],
  ["", "", "gfp", "001"],
  ["", "", "gfp", "002"],
  ["", "", "gfp", "003"],
  ["", "", "alexa", "001"],
  ["", "", "alexa", "002"],
  ["", "", "alexa", "003"]
];
const output_legacy: {
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
} = {
  metadata: {
    chan: ["trans", "gfp", "alexa"],
    t: [],
    xy: ["001", "002", "003"],
    z: []
  },
  filesInfo: {
    "trans001.tif": { t: [], xy: [0], z: [], chan: [0] },
    "trans002.tif": { t: [], xy: [1], z: [], chan: [0] },
    "trans003.tif": { t: [], xy: [2], z: [], chan: [0] },
    "gfp001.tif": { t: [], xy: [0], z: [], chan: [1] },
    "gfp002.tif": { t: [], xy: [1], z: [], chan: [1] },
    "gfp003.tif": { t: [], xy: [2], z: [], chan: [1] },
    "alexa001.tif": { t: [], xy: [0], z: [], chan: [2] },
    "alexa002.tif": { t: [], xy: [1], z: [], chan: [2] },
    "alexa003.tif": { t: [], xy: [2], z: [], chan: [2] }
  }
};

test("Test convertDateToTime", () => {
  expect(convertDateToTime(filenames_directories[0])).toBe(
    output_convert_directories[0]
  );
});

test("Test splitFileNames", () => {
  expect(splitFilenames(output_convert_directories)).toStrictEqual(
    output_split_directories
  );
  expect(splitFilenames(filenames_combined)).toStrictEqual(
    output_split_combined
  );
  expect(splitFilenames(filenames_legacy)).toStrictEqual(output_split_legacy);
});

test("Test getFields", () => {
  expect(getFields(output_split_combined)).toStrictEqual(
    output_getFields_combined
  );
});

test("Test collectFilenameMetadata2", () => {
  expect(collectFilenameMetadata2(filenames_directories)).toStrictEqual(
    output_directories
  );
  expect(collectFilenameMetadata2(filenames_combined)).toStrictEqual(
    output_combined
  );
  expect(collectFilenameMetadata2(filenames_legacy)).toStrictEqual(
    output_legacy
  );
});
