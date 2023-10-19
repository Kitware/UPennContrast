export function processFilenames(filenames: string[]) {
  // Create an array to hold tokens for each position across filenames
  const allTokensByPosition: Set<string>[] = [];

  filenames.forEach(filename => {
    const tokens = filename.split(/[_\.\/]/);

    tokens.forEach((token, index) => {
      if (!allTokensByPosition[index]) {
        allTokensByPosition[index] = new Set<string>();
      }

      allTokensByPosition[index].add(token);
    });
  });

  // Count and return the number of distinct tokens for each position along with the tokens
  return allTokensByPosition.map((tokenSet, index) => ({
    tokenPosition: index + 1,
    distinctValues: tokenSet.size,
    tokens: tokenSet // Include the actual set of tokens in the result
  }));
}

import { DataFrame } from "dataframe-js";
import { logError } from "@/utils/log";

export function processFilenamesDF(filenames: string[]): DataFrame {
  const delimiterPattern = /[_\.\/]/;

  // Tokenize each filename
  const tokenizedData: string[][] = filenames.map(filename => {
    const tokens = filename.split(delimiterPattern);
    return [filename, ...tokens];
  });

  // Find the maximum number of tokens for column naming
  const maxTokens = Math.max(...tokenizedData.map(row => row.length));

  // Define column names
  const columns = [
    "Filename",
    ...Array.from({ length: maxTokens - 1 }, (_, i) => `Token ${i + 1}`)
  ];

  // Create a DataFrame
  const df = new DataFrame(tokenizedData, columns);

  // Sort by Filename
  const sortedDf = df.sortBy("Filename");

  return sortedDf;
}

export function getUniqueTokensPerColumn(df: DataFrame): Map<string, string[]> {
  const uniqueTokensMap: Map<string, string[]> = new Map();

  df.listColumns().forEach(column => {
    const uniqueValues = df.distinct(column).toArray(column);
    uniqueTokensMap.set(column, uniqueValues);
  });

  return uniqueTokensMap;
}

export function countUniqueTokensPerColumn(df: DataFrame): Map<string, number> {
  const uniqueTokensCountMap: Map<string, number> = new Map();

  df.listColumns().forEach(column => {
    const count = df.distinct(column).count();
    uniqueTokensCountMap.set(column, count);
  });

  return uniqueTokensCountMap;
}

export function findMinimalSpanningColumns(df: DataFrame): string[] {
  const allColumns = df.listColumns();
  // Exclude the "Filename" column
  const columns = allColumns.filter(column => column !== "Filename");
  const totalRows = df.count();

  // Helper function to compute the Cartesian product of arrays
  const cartesian = (...arrays: any[][]) =>
    arrays.reduce((acc, curr) =>
      acc.flatMap(d => curr.map(e => [d, e].flat()))
    );

  // For increasing sizes of combinations...
  for (let i = 1; i <= columns.length; i++) {
    const columnCombinations = getCombinations(columns, i); // Get all i-sized combinations of columns

    for (const combination of columnCombinations as string[][]) {
      const uniqueValueArrays = combination.map(col =>
        df.distinct(col).toArray(col)
      );

      // Compute the Cartesian product
      const product = cartesian(...uniqueValueArrays);

      if (product.length === totalRows) {
        return combination;
      }
    }
  }

  return [];
}

// Helper function to get combinations of elements (columns in our case)
function getCombinations<T>(elements: T[], size: number): T[][] {
  if (size === 1) {
    return elements.map(e => [e]);
  }

  let combinations: T[][] = [];
  for (let i = 0; i < elements.length; i++) {
    const head = elements.slice(i, i + 1);
    const tailCombinations = getCombinations(elements.slice(i + 1), size - 1);
    combinations = combinations.concat(
      tailCombinations.map(tc => head.concat(tc))
    );
  }
  return combinations;
}

export function findColumnsWithMatchingDistinctCount(
  df: DataFrame,
  specifiedColumn: string
): string[] {
  const specifiedColumnDistinctCount = df.distinct(specifiedColumn).count();
  const allColumns = df.listColumns();
  const matchingColumns: string[] = [];

  for (const testColumn of allColumns) {
    if (testColumn === specifiedColumn) continue; // Skip the column if it's the same as the specified column

    // Create a combined column and count distinct values
    const combined = df.withColumn(
      "combined",
      ((row: any) =>
        row.get(specifiedColumn) + "_" + row.get(testColumn)) as any
    );
    const combinedDistinctCount = combined.distinct("combined").count();

    if (combinedDistinctCount === specifiedColumnDistinctCount) {
      matchingColumns.push(testColumn);
    }
  }

  return matchingColumns;
}

export function findComplementaryColumns(
  df: DataFrame,
  specifiedColumn: string
): string[] {
  const specifiedColumnDistinctCount = df.distinct(specifiedColumn).count();
  const allColumns = df.listColumns();
  const complementaryColumns: string[] = [];

  for (const testColumn of allColumns) {
    if (testColumn === specifiedColumn) continue; // Skip the column if it's the same as the specified column

    const testColumnDistinctCount = df.distinct(testColumn).count();

    // Create a combined column and count distinct values
    const combined = df.withColumn(
      "combined",
      ((row: any) =>
        row.get(specifiedColumn) + "_" + row.get(testColumn)) as any
    );
    const combinedDistinctCount = combined.distinct("combined").count();

    if (
      combinedDistinctCount === specifiedColumnDistinctCount &&
      combinedDistinctCount === testColumnDistinctCount
    ) {
      complementaryColumns.push(testColumn);
    }
  }

  return complementaryColumns;
}

export function findAllComplementaryColumns(
  df: DataFrame,
  specifiedColumns: string[]
): string[][] {
  const results: string[][] = [];

  for (const column of specifiedColumns) {
    const complementary = findComplementaryColumns(df, column);
    results.push([column, ...complementary]); // Add the specified column to the front
  }

  return results;
}

function findCommonSubstring(tokens: string[]): string {
  // Assuming all tokens have the same length
  const tokenLength = tokens[0].length;
  let commonSubstring = "";

  for (let i = 0; i < tokenLength; i++) {
    const currentChar = tokens[0][i];
    if (tokens.every(token => token[i] === currentChar)) {
      commonSubstring += currentChar;
    } else {
      // TODO: have to decide whether to keep placeholders or just remove
      commonSubstring += "_"; // placeholder for non-matching characters
    }
  }

  return commonSubstring;
}

export function findColumnCommonSubstring(
  df: DataFrame,
  specifiedColumn: string
): string {
  // Ensure the column exists in the DataFrame
  const columns = df.listColumns();
  if (!columns.includes(specifiedColumn)) {
    logError(`Column '${specifiedColumn}' does not exist in the DataFrame.`);
    return "";
  }

  const tokens: string[] = df.toArray(specifiedColumn);

  // Check if tokens array is defined and non-empty
  if (!tokens || !tokens.length) {
    logError(`Tokens for column '${specifiedColumn}' are undefined or empty.`);
    return "";
  }

  return findCommonSubstring(tokens);
}

export function categorizeSubstring(substring: string): string {
  // Convert the substring to lowercase for case-insensitive matching
  const lowerSub = substring.toLowerCase();

  const categories = {
    z: ["z", "slice"],
    xy: ["well", "stage", "pos"],
    chan: ["chan", "channel", "fp", "ch"],
    t: ["t", "time", "sec", "msec", "ms", "d", "m", "hr", "h"]
  };

  for (const category in categories) {
    if (
      categories[category as keyof typeof categories].some(keyword =>
        lowerSub.includes(keyword)
      )
    ) {
      return category;
    }
  }

  // If no match found, default to "chan"
  return "chan";
}

export function categorizeColumns(
  df: DataFrame,
  columnNames: string[]
): string {
  // Helper regex pattern to detect a single letter followed by a single digit
  const xyPattern = /^[A-Za-z]\d$/;

  const firstColumn = columnNames[0];

  const tokens: string[] = df.toArray(firstColumn);

  // If all tokens are of the pattern "A7", "C3", etc.
  if (tokens.every(token => xyPattern.test(token))) {
    return "xy";
  }

  // If none of the tokens in the column contain numerals
  if (tokens.every(token => !/\d/.test(token))) {
    return "chan";
  }

  // Find common substring
  const commonStr = findColumnCommonSubstring(df, firstColumn);

  // Use the common substring to determine the category
  return categorizeSubstring(commonStr);
}

export function assignUniqueCategorizations(
  df: DataFrame,
  allComplementaryLists: string[][]
): string[] {
  // Base list of categorizations
  const baseCategorizations = ["chan", "xy", "z", "t"];

  // Initial check
  if (allComplementaryLists.length > baseCategorizations.length) {
    logError(
      "Error: Too many lists in allComplementaryLists to assign unique categorizations."
    );
    return [];
  }

  // Step 2: Initial assignment
  let assignedCategorizations: string[] = [];
  for (const list of allComplementaryLists) {
    assignedCategorizations.push(categorizeColumns(df, list));
  }

  // Step 3: Resolve conflicts
  for (let i = 0; i < assignedCategorizations.length; i++) {
    while (assignedCategorizations.indexOf(assignedCategorizations[i]) !== i) {
      // If conflict exists
      const nextAvailableCategory = baseCategorizations.find(
        cat => !assignedCategorizations.includes(cat)
      );
      if (nextAvailableCategory) {
        assignedCategorizations[i] = nextAvailableCategory;
      } else {
        logError("Error: Unable to find a unique categorization.");
        return [];
      }
    }
  }

  return assignedCategorizations; // Return the results
}

export function addAssignmentColumns(
  df: DataFrame,
  allComplementaryLists: string[][],
  assignments: string[]
): DataFrame {
  for (let i = 0; i < assignments.length; i++) {
    const assignment = assignments[i];
    const list = allComplementaryLists[i];

    // Ensure the column from the list exists in the DataFrame
    if (!df.listColumns().includes(list[0])) {
      logError(`Column '${list[0]}' does not exist in the DataFrame.`);
      continue;
    }

    // Get the tokens for the column and sort them alphabetically
    const tokens: string[] = df.distinct(list[0]).toArray(list[0]);
    tokens.sort();

    // Create a map for tokens to their respective integer values
    const tokenToIntMap: { [key: string]: number } = {};
    tokens.forEach((token, index) => {
      tokenToIntMap[token] = index;
    });

    // Add the assignment column to the DataFrame
    df = df.withColumn(
      assignment,
      ((row: any) => tokenToIntMap[row.get(list[0])]) as any
    );
  }

  return df; // Return the updated DataFrame
}

export function structuredAssignments(
  df: DataFrame,
  allComplementaryLists: string[][],
  assignments: string[]
): any[] {
  const output: any[] = [];

  const assignmentToLetterMap: { [key: string]: string } = {
    chan: "C",
    t: "T",
    xy: "XY",
    z: "Z"
  };

  for (let i = 0; i < assignments.length; i++) {
    const assignment = assignments[i];
    const list = allComplementaryLists[i];

    // Ensure the column from the list exists in the DataFrame
    if (!df.listColumns().includes(list[0])) {
      logError(`Column '${list[0]}' does not exist in the DataFrame.`);
      continue;
    }

    // Get the tokens for the column and sort them alphabetically
    const tokens: string[] = df.distinct(list[0]).toArray(list[0]);
    tokens.sort();

    // Create a map for tokens to their respective integer values
    const tokenToIntMap: { [key: string]: number } = {};
    tokens.forEach((token, index) => {
      tokenToIntMap[token] = index;
    });

    // Structure the data
    const structuredData = {
      guess: assignmentToLetterMap[assignment],
      valueIdxPerFilename: {},
      values: tokens
    };

    const mappedRows = df.select("Filename", list[0]);

    const valueIdxPerFilename: { [Filename: string]: number } = {};
    const rowsArray = mappedRows.toArray();

    // Loop over each row
    for (const row of rowsArray) {
      const Filename = row[0]; // The first element is the filename
      const token = row[1]; // The second element is the token

      // Use tokenToIntMap to fetch the index value for the token
      valueIdxPerFilename[Filename] = tokenToIntMap[token];
    }

    structuredData.valueIdxPerFilename = valueIdxPerFilename;

    output.push(structuredData);
  }

  return output;
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
  const df = processFilenamesDF(filenames);
  const minimalColumns = findMinimalSpanningColumns(df);
  const allComplementaryLists = findAllComplementaryColumns(df, minimalColumns);
  const assignments = assignUniqueCategorizations(df, allComplementaryLists);
  return structuredAssignments(df, allComplementaryLists, assignments);
}

// Below copied in from old version to make things compile. Probably doesn't work.

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

function stringToNumber(val: string | null): number | null {
  return val === null ? null : +val;
}

export function getNumericMetadata(filename: string): NumericMetadata {
  return {
    t: stringToNumber(filename),
    xy: stringToNumber("1"),
    z: stringToNumber("1"),
    chan: "GFP"
  };
}
