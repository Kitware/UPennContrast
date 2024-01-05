// Desc: Unit tests for parserModule.ts
// Tests are written using Jest
// To run the tests, run the following command in the terminal:
// npm test
// You need to run the following command to install Jest:
// npm install --save-dev jest @types/jest ts-jest typescript
// Also need to install dataframe-js
// npm install dataframe-js
// npm install @types/dataframe-js
// This runs 3 different filename patterns: filenames1, filenames2, filenames3
// The expected output for each pattern is stored in expectedOutput1, expectedOutput2, expectedOutput3
// filenames1 and filenames2 are small enough to be stored in this file
// filenames3 is a large list of filenames that is stored in a separate file: M_Mir_image_file_list.txt
// The expected output for filenames3 is stored in a separate file as well: filenames3.json

import { collectFilenameMetadata2 } from "./parsing";
import { failTest, TEST_DATA_ROOT } from "@/test/scripts/utilities";
import { readFileSync } from "fs";

// Sample filenames can be moved outside individual tests since they are constants
// Sample filenames
const filenames1 = [
  "img000_000_000004_0000000002.ome.tif",
  "img000_000_000002_0000000000.ome.tif",
  "img000_000_000001_0000000001.ome.tif",
  "img000_000_000002_0000000001.ome.tif",
  "img000_000_000001_0000000000.ome.tif",
  "img000_000_000004_0000000003.ome.tif",
  "img000_000_000002_0000000003.ome.tif",
  "img000_000_000001_0000000002.ome.tif",
  "img000_000_000004_0000000001.ome.tif",
  "img000_000_000004_0000000000.ome.tif",
  "img000_000_000002_0000000002.ome.tif",
  "img000_000_000001_0000000003.ome.tif",
  "img000_000_000000_0000000003.ome.tif",
  "img000_000_000003_0000000002.ome.tif",
  "img000_000_000000_0000000002.ome.tif",
  "img000_000_000003_0000000003.ome.tif",
  "img000_000_000000_0000000000.ome.tif",
  "img000_000_000003_0000000001.ome.tif",
  "img000_000_000000_0000000001.ome.tif",
  "img000_000_000003_0000000000.ome.tif",
];

const expectedOutput1 = [
  {
    guess: "C",
    valueIdxPerFilename: {
      "img000_000_000000_0000000000.ome.tif": 0,
      "img000_000_000000_0000000001.ome.tif": 0,
      "img000_000_000000_0000000002.ome.tif": 0,
      "img000_000_000000_0000000003.ome.tif": 0,
      "img000_000_000001_0000000000.ome.tif": 1,
      "img000_000_000001_0000000001.ome.tif": 1,
      "img000_000_000001_0000000002.ome.tif": 1,
      "img000_000_000001_0000000003.ome.tif": 1,
      "img000_000_000002_0000000000.ome.tif": 2,
      "img000_000_000002_0000000001.ome.tif": 2,
      "img000_000_000002_0000000002.ome.tif": 2,
      "img000_000_000002_0000000003.ome.tif": 2,
      "img000_000_000003_0000000000.ome.tif": 3,
      "img000_000_000003_0000000001.ome.tif": 3,
      "img000_000_000003_0000000002.ome.tif": 3,
      "img000_000_000003_0000000003.ome.tif": 3,
      "img000_000_000004_0000000000.ome.tif": 4,
      "img000_000_000004_0000000001.ome.tif": 4,
      "img000_000_000004_0000000002.ome.tif": 4,
      "img000_000_000004_0000000003.ome.tif": 4,
    },
    values: ["000000", "000001", "000002", "000003", "000004"],
  },
  {
    guess: "XY",
    valueIdxPerFilename: {
      "img000_000_000000_0000000000.ome.tif": 0,
      "img000_000_000000_0000000001.ome.tif": 1,
      "img000_000_000000_0000000002.ome.tif": 2,
      "img000_000_000000_0000000003.ome.tif": 3,
      "img000_000_000001_0000000000.ome.tif": 0,
      "img000_000_000001_0000000001.ome.tif": 1,
      "img000_000_000001_0000000002.ome.tif": 2,
      "img000_000_000001_0000000003.ome.tif": 3,
      "img000_000_000002_0000000000.ome.tif": 0,
      "img000_000_000002_0000000001.ome.tif": 1,
      "img000_000_000002_0000000002.ome.tif": 2,
      "img000_000_000002_0000000003.ome.tif": 3,
      "img000_000_000003_0000000000.ome.tif": 0,
      "img000_000_000003_0000000001.ome.tif": 1,
      "img000_000_000003_0000000002.ome.tif": 2,
      "img000_000_000003_0000000003.ome.tif": 3,
      "img000_000_000004_0000000000.ome.tif": 0,
      "img000_000_000004_0000000001.ome.tif": 1,
      "img000_000_000004_0000000002.ome.tif": 2,
      "img000_000_000004_0000000003.ome.tif": 3,
    },
    values: ["0000000000", "0000000001", "0000000002", "0000000003"],
  },
];

const filenames2 = [
  "phase/VID1630_A1_1_00d00h00m.tif",
  "phase/VID1630_C4_1_00d00h00m.tif",
  "phase/VID1630_A1_1_01d23h34m.tif",
  "phase/VID1630_C4_1_00d23h56m.tif",
  "phase/VID1630_A1_1_00d23h56m.tif",
  "phase/VID1630_C4_1_01d23h34m.tif",
  "red/VID1630_A1_1_00d00h00m.tif",
  "red/VID1630_C4_1_00d00h00m.tif",
  "red/VID1630_A1_1_01d23h34m.tif",
  "red/VID1630_C4_1_00d23h56m.tif",
  "red/VID1630_A1_1_00d23h56m.tif",
  "red/VID1630_C4_1_01d23h34m.tif",
  "gfp/VID1630_A1_1_00d00h00m.tif",
  "gfp/VID1630_C4_1_00d00h00m.tif",
  "gfp/VID1630_A1_1_01d23h34m.tif",
  "gfp/VID1630_C4_1_00d23h56m.tif",
  "gfp/VID1630_A1_1_00d23h56m.tif",
  "gfp/VID1630_C4_1_01d23h34m.tif",
];

const expectedOutput2 = [
  {
    guess: "C",
    valueIdxPerFilename: {
      "gfp/VID1630_A1_1_00d00h00m.tif": 0,
      "gfp/VID1630_A1_1_00d23h56m.tif": 0,
      "gfp/VID1630_A1_1_01d23h34m.tif": 0,
      "gfp/VID1630_C4_1_00d00h00m.tif": 0,
      "gfp/VID1630_C4_1_00d23h56m.tif": 0,
      "gfp/VID1630_C4_1_01d23h34m.tif": 0,
      "phase/VID1630_A1_1_00d00h00m.tif": 1,
      "phase/VID1630_A1_1_00d23h56m.tif": 1,
      "phase/VID1630_A1_1_01d23h34m.tif": 1,
      "phase/VID1630_C4_1_00d00h00m.tif": 1,
      "phase/VID1630_C4_1_00d23h56m.tif": 1,
      "phase/VID1630_C4_1_01d23h34m.tif": 1,
      "red/VID1630_A1_1_00d00h00m.tif": 2,
      "red/VID1630_A1_1_00d23h56m.tif": 2,
      "red/VID1630_A1_1_01d23h34m.tif": 2,
      "red/VID1630_C4_1_00d00h00m.tif": 2,
      "red/VID1630_C4_1_00d23h56m.tif": 2,
      "red/VID1630_C4_1_01d23h34m.tif": 2,
    },
    values: ["gfp", "phase", "red"],
  },
  {
    guess: "XY",
    valueIdxPerFilename: {
      "gfp/VID1630_A1_1_00d00h00m.tif": 0,
      "gfp/VID1630_A1_1_00d23h56m.tif": 0,
      "gfp/VID1630_A1_1_01d23h34m.tif": 0,
      "gfp/VID1630_C4_1_00d00h00m.tif": 1,
      "gfp/VID1630_C4_1_00d23h56m.tif": 1,
      "gfp/VID1630_C4_1_01d23h34m.tif": 1,
      "phase/VID1630_A1_1_00d00h00m.tif": 0,
      "phase/VID1630_A1_1_00d23h56m.tif": 0,
      "phase/VID1630_A1_1_01d23h34m.tif": 0,
      "phase/VID1630_C4_1_00d00h00m.tif": 1,
      "phase/VID1630_C4_1_00d23h56m.tif": 1,
      "phase/VID1630_C4_1_01d23h34m.tif": 1,
      "red/VID1630_A1_1_00d00h00m.tif": 0,
      "red/VID1630_A1_1_00d23h56m.tif": 0,
      "red/VID1630_A1_1_01d23h34m.tif": 0,
      "red/VID1630_C4_1_00d00h00m.tif": 1,
      "red/VID1630_C4_1_00d23h56m.tif": 1,
      "red/VID1630_C4_1_01d23h34m.tif": 1,
    },
    values: ["A1", "C4"],
  },
  {
    guess: "T",
    valueIdxPerFilename: {
      "gfp/VID1630_A1_1_00d00h00m.tif": 0,
      "gfp/VID1630_A1_1_00d23h56m.tif": 1,
      "gfp/VID1630_A1_1_01d23h34m.tif": 2,
      "gfp/VID1630_C4_1_00d00h00m.tif": 0,
      "gfp/VID1630_C4_1_00d23h56m.tif": 1,
      "gfp/VID1630_C4_1_01d23h34m.tif": 2,
      "phase/VID1630_A1_1_00d00h00m.tif": 0,
      "phase/VID1630_A1_1_00d23h56m.tif": 1,
      "phase/VID1630_A1_1_01d23h34m.tif": 2,
      "phase/VID1630_C4_1_00d00h00m.tif": 0,
      "phase/VID1630_C4_1_00d23h56m.tif": 1,
      "phase/VID1630_C4_1_01d23h34m.tif": 2,
      "red/VID1630_A1_1_00d00h00m.tif": 0,
      "red/VID1630_A1_1_00d23h56m.tif": 1,
      "red/VID1630_A1_1_01d23h34m.tif": 2,
      "red/VID1630_C4_1_00d00h00m.tif": 0,
      "red/VID1630_C4_1_00d23h56m.tif": 1,
      "red/VID1630_C4_1_01d23h34m.tif": 2,
    },
    values: ["00d00h00m", "00d23h56m", "01d23h34m"],
  },
];

function parseTestFiles(filenamesPath: string, expectedOutputPath: string) {
  // Read the file and populate the test variable
  try {
    // Get filenames
    const data = readFileSync(filenamesPath, "utf8"); // Read the file as a string
    const filenames = data
      .split("\n") // Split the string by newline
      .map((line) => line.trim()) // Trim whitespace from each line
      .filter((line) => line !== ""); // Filter out empty lines

    // Get expected output
    const jsonData = readFileSync(expectedOutputPath, "utf-8");
    const expectedOutput = JSON.parse(jsonData);

    return { filenames, expectedOutput };
  } catch (err) {
    console.error("Error reading the file:", err);
    return null;
  }
}

describe("Parser Module", () => {
  test("Test with filenames1", () => {
    const filenames = filenames1;
    const result = collectFilenameMetadata2(filenames);
    // Assert your expectations here
    expect(result).toEqual(expectedOutput1); // You should define expectedOutput1
  });

  test("Test with filenames2", () => {
    const filenames = filenames2;
    const result = collectFilenameMetadata2(filenames);
    // Assert your expectations here
    expect(result).toEqual(expectedOutput2); // You should define expectedOutput2
  });

  test("Test with filenames3", () => {
    // Specify the path to your files here
    const filenamesPath = TEST_DATA_ROOT + "/parsing/M_Mir_image_file_list.txt";
    const expectedOutputPath = TEST_DATA_ROOT + "/parsing/filenames3.json";

    // Fetch and parse files
    const data = parseTestFiles(filenamesPath, expectedOutputPath);
    if (!data) {
      failTest(
        `Unable to fetch test data for files: "${filenamesPath}" and "${expectedOutputPath}"`,
      );
    }
    const { filenames, expectedOutput } = data;

    const result = collectFilenameMetadata2(filenames);
    // Assert your expectations here
    expect(result).toEqual(expectedOutput);
  });
});
