// fail() is defined in @types/jest but not available in jest-circus
// see: https://github.com/jestjs/jest/issues/11698
// use failTest() instead of fail() as it avoids confusion
export function failTest(error?: any): never {
  throw new Error(error);
}

export const TEST_DATA_ROOT = __dirname + "/../data";
