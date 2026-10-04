import { randomInt } from "node:crypto";

function assertSides(sides) {
  if (!Number.isInteger(sides) || sides < 2) {
    throw new RangeError(`Dice sides must be an integer >= 2, got ${sides}`);
  }
}

export class CryptoDice {
  roll(sides = 20) {
    assertSides(sides);
    return randomInt(1, sides + 1);
  }
}

export class SequenceDice {
  constructor(results = []) {
    this.results = [...results];
  }

  roll(sides = 20) {
    assertSides(sides);
    if (this.results.length === 0) throw new Error("SequenceDice exhausted");
    const value = this.results.shift();
    if (!Number.isInteger(value) || value < 1 || value > sides) {
      throw new RangeError(`Scripted roll ${value} is invalid for d${sides}`);
    }
    return value;
  }
}

export function rollD20(dice, modifier = 0) {
  const natural = dice.roll(20);
  const total = natural + modifier;
  const sign = modifier >= 0 ? "+" : "";
  return {
    natural,
    modifier,
    total,
    notation: `d20${sign}${modifier}=${total}`
  };
}
