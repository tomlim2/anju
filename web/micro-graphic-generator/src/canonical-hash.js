import { sha256 } from "./vendor/sha256.js";

const textEncoder = new TextEncoder();

function assertUnicodeScalars(value, label) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new TypeError(`${label} contains an unpaired surrogate`);
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError(`${label} contains an unpaired surrogate`);
    }
  }
}

function serialize(value, ancestors) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") {
    assertUnicodeScalars(value, "string");
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("canonical JSON only accepts finite numbers");
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new TypeError(`canonical JSON does not support ${typeof value}`);
  }
  if (ancestors.has(value)) throw new TypeError("canonical JSON does not support cycles");

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const keys = Reflect.ownKeys(value);
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) throw new TypeError("canonical JSON requires dense arrays");
      }
      const expectedKeys = new Set(["length", ...Array.from({ length: value.length }, (_, index) => String(index))]);
      if (keys.some(key => typeof key !== "string" || !expectedKeys.has(key))) {
        throw new TypeError("canonical JSON arrays cannot have extra properties");
      }
      return `[${value.map(item => serialize(item, ancestors)).join(",")}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("canonical JSON requires plain objects");
    }
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key === "symbol")) {
      throw new TypeError("canonical JSON does not support symbol keys");
    }
    for (const key of keys) {
      assertUnicodeScalars(key, "object key");
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        throw new TypeError("canonical JSON requires enumerable data properties");
      }
      if (key === "toJSON") throw new TypeError("canonical JSON does not support toJSON");
    }
    keys.sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${serialize(value[key], ancestors)}`).join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalJson(value) {
  return serialize(value, new Set());
}

export function utf8Bytes(value) {
  if (typeof value !== "string") throw new TypeError("utf8Bytes expects a string");
  assertUnicodeScalars(value, "string");
  return textEncoder.encode(value);
}

export function sha256Hex(bytes) {
  return Array.from(sha256(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function hashCanonical(value) {
  return `sha256:${sha256Hex(utf8Bytes(canonicalJson(value)))}`;
}
