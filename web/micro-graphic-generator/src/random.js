import { hashCanonical } from "./canonical-hash.js";

const MULBERRY32_STEP = 0x6D2B79F5;

export function mulberry32(seed) {
  let value = seed;
  return function next() {
    let mixed = value += MULBERRY32_STEP;
    mixed = Math.imul(mixed ^ mixed >>> 15, mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

export function createRandomSource(initialSeed) {
  let core;
  let drawCount;
  let state;

  function reset(nextSeed) {
    const normalizedSeed = Number(nextSeed) >>> 0;
    core = mulberry32(normalizedSeed);
    drawCount = 0;
    state = normalizedSeed;
  }

  function random() {
    drawCount += 1;
    state = (state + MULBERRY32_STEP) >>> 0;
    return core();
  }

  function range(min = 0, max = 1) {
    return min + (max - min) * random();
  }

  function integer(min, max) {
    return Math.floor(range(min, max + 1));
  }

  function pick(items) {
    return items[integer(0, items.length - 1)];
  }

  function chance(probability) {
    return random() < probability;
  }

  function shuffled(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = integer(0, index);
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function snapshot() {
    return { drawCount, state };
  }

  reset(initialSeed);
  return { reset, random, range, integer, pick, chance, shuffled, snapshot };
}

function randomOperations(random) {
  function range(min = 0, max = 1) {
    return min + (max - min) * random();
  }

  function integer(min, max) {
    return Math.floor(range(min, max + 1));
  }

  function pick(items) {
    return items[integer(0, items.length - 1)];
  }

  function chance(probability) {
    return random() < probability;
  }

  function shuffled(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = integer(0, index);
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  return { random, range, integer, pick, chance, shuffled };
}

export function createRecordingRandomSource(source) {
  const values = [];
  const operations = randomOperations(() => {
    const value = source.random();
    values.push(value);
    return value;
  });
  return { ...operations, values };
}

export function createReplayRandomSource(values) {
  let index = 0;
  const operations = randomOperations(() => {
    if (index >= values.length) throw new Error("Graphic random replay exhausted");
    const value = values[index];
    index += 1;
    return value;
  });
  return {
    ...operations,
    assertExhausted() {
      if (index !== values.length) {
        throw new Error(`Graphic random replay left ${values.length - index} unused draw(s)`);
      }
    }
  };
}

export function deriveSeed(input, label) {
  if (typeof label !== "string" || label.length === 0) {
    throw new TypeError("deriveSeed requires a non-empty label");
  }
  const digest = hashCanonical({ input, label });
  return Number.parseInt(digest.slice("sha256:".length, "sha256:".length + 8), 16) >>> 0;
}

export function keyedValue(seedInput, key) {
  const seed = deriveSeed(seedInput, key);
  return mulberry32(seed)();
}
