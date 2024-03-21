import { TUnitLength, TUnitTime } from "@/store/model";

const oneUnitToMeterConversion = {
  nm: 1e-9,
  µm: 1e-6,
  mm: 1e-3,
  m: 1,
};

export function convertLength(
  value: number,
  oldUnit: TUnitLength,
  newUnit: TUnitLength,
) {
  const multiplier =
    oneUnitToMeterConversion[oldUnit] / oneUnitToMeterConversion[newUnit];
  return multiplier * value;
}

const oneUnitToSecondConversion = {
  ms: 1e-3,
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
};

export function convertTime(
  value: number,
  oldUnit: TUnitTime,
  newUnit: TUnitTime,
) {
  const multiplier =
    oneUnitToSecondConversion[oldUnit] / oneUnitToSecondConversion[newUnit];
  return multiplier * value;
}
