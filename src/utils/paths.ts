import { IAnnotationPropertyValues, TNestedValues } from "@/store/model";

// Using "===" won't work on list of string
export function arePathEquals(path: string[], otherPath: string[]): boolean {
  return (
    path.length === otherPath.length &&
    path.every((name, i) => name === otherPath[i])
  );
}

export function findIndexOfPath(path: string[], pathArray: string[][]): number {
  return pathArray.findIndex((otherPath) => arePathEquals(otherPath, path));
}

// Generate a unique string from a path
export function createPathStringFromPathArray(path: string[]): string {
  // . shouldn't be used in a subId (mongoDB restriction on field names)
  return path.join(".");
}

// The object given as argument is seen as a tree, and the keys along the tree form the path
// Return the location where the path leads, and null if the path is unknown
export function getValueFromObjectAndPath(
  values: TNestedValues<number>,
  path: string[],
): TNestedValues<number> | null {
  let currentItem = values;
  for (const name of path) {
    if (typeof currentItem === "object" && name in currentItem) {
      currentItem = currentItem[name];
    } else {
      return null;
    }
  }
  return currentItem;
}

// Specialised function for UI
// Get a string of the value rounded to to decimals or a dash if no value
export function getStringFromPropertiesAndPath(
  properties: IAnnotationPropertyValues[0],
  path: string[],
): string {
  const value = getValueFromObjectAndPath(properties, path);
  return typeof value === "number" ? "" + Math.round(value * 100) / 100 : "-";
}

export default {
  arePathEquals,
  findIndexOfPath,
  createPathStringFromPathArray,
  getValueFromObjectAndPath,
  getStringFromPropertiesAndPath,
};
