export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * 2.54;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Number((totalInches - feet * 12).toFixed(1));

  return { feet, inches };
}

export function poundsToKg(pounds: number): number {
  return pounds * 0.453592;
}

export function kgToPounds(kg: number): number {
  return kg / 0.453592;
}

export function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function isValidHeightCm(value: number): boolean {
  return value >= 50 && value <= 250;
}

export function isValidFeetInches(feet: number, inches: number): boolean {
  return feet >= 1 && feet <= 8 && inches >= 0 && inches < 12;
}

export function isValidWeightKg(value: number): boolean {
  return value >= 10 && value <= 350;
}
