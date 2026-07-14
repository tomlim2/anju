import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const VM_MODULE_PARSER_SOURCE = `
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source = readFileSync(process.argv[1], "utf8");
const module = new vm.SourceTextModule(source, { identifier: "closure-source.mjs" });
process.stdout.write(JSON.stringify(module.dependencySpecifiers));
`;

const IDENTIFIER_START = /[A-Za-z_$]/;
const IDENTIFIER_PART = /[A-Za-z0-9_$]/;
const REGEX_PREFIX_KEYWORDS = new Set([
  "await", "case", "delete", "do", "else", "in", "instanceof", "new",
  "of", "return", "throw", "typeof", "void", "yield"
]);

function skipQuoted(source, start, quote) {
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }
    if (source[index] === quote) return index + 1;
    if (source[index] === "\n" || source[index] === "\r") {
      throw new Error("unterminated JavaScript string literal");
    }
  }
  throw new Error("unterminated JavaScript string literal");
}

function skipLineComment(source, start) {
  let index = start + 2;
  while (index < source.length && source[index] !== "\n" && source[index] !== "\r") index += 1;
  return index;
}

function skipBlockComment(source, start) {
  const end = source.indexOf("*/", start + 2);
  if (end < 0) throw new Error("unterminated JavaScript block comment");
  return end + 2;
}

function skipTrivia(source, start) {
  let index = start;
  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index += 1;
    } else if (source[index] === "/" && source[index + 1] === "/") {
      index = skipLineComment(source, index);
    } else if (source[index] === "/" && source[index + 1] === "*") {
      index = skipBlockComment(source, index);
    } else {
      break;
    }
  }
  return index;
}

function skipRegexLiteral(source, start) {
  let inCharacterClass = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (character === "[") inCharacterClass = true;
    else if (character === "]") inCharacterClass = false;
    else if (character === "/" && !inCharacterClass) {
      index += 1;
      while (index < source.length && /[A-Za-z]/.test(source[index])) index += 1;
      return index;
    } else if (character === "\n" || character === "\r") {
      throw new Error("unterminated JavaScript regular expression literal");
    }
  }
  throw new Error("unterminated JavaScript regular expression literal");
}

function readDynamicImportSpecifier(source, openParenIndex) {
  let index = skipTrivia(source, openParenIndex + 1);
  const quote = source[index];
  if (quote !== '"' && quote !== "'") {
    throw new Error("dynamic import specifiers must be string literals");
  }
  const end = skipQuoted(source, index, quote);
  const rawSpecifier = source.slice(index + 1, end - 1);
  if (rawSpecifier.includes("\\")) {
    throw new Error("escaped dynamic import specifiers are forbidden");
  }
  index = skipTrivia(source, end);
  if (source[index] !== ")") throw new Error("dynamic import options and expressions are forbidden");
  return { specifier: rawSpecifier, end: index + 1 };
}

function scanCode(source, start = 0, stopAtTemplateBrace = false, dynamicSpecifiers = null) {
  let index = start;
  let braceDepth = 0;
  let canStartRegex = true;
  while (index < source.length) {
    const character = source[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === "/" && source[index + 1] === "/") {
      index = skipLineComment(source, index);
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      index = skipBlockComment(source, index);
      continue;
    }
    if (character === "'" || character === '"') {
      index = skipQuoted(source, index, character);
      canStartRegex = false;
      continue;
    }
    if (character === "`") {
      index = scanTemplate(source, index + 1, dynamicSpecifiers);
      canStartRegex = false;
      continue;
    }
    if (character === "/" && canStartRegex) {
      index = skipRegexLiteral(source, index);
      canStartRegex = false;
      continue;
    }
    if (IDENTIFIER_START.test(character)) {
      let end = index + 1;
      while (end < source.length && IDENTIFIER_PART.test(source[end])) end += 1;
      const identifier = source.slice(index, end);
      if (identifier === "import") {
        const next = skipTrivia(source, end);
        if (source[next] === "(") {
          if (!dynamicSpecifiers) throw new Error("dynamic import is forbidden in static closure sources");
          const dynamic = readDynamicImportSpecifier(source, next);
          dynamicSpecifiers.push(dynamic.specifier);
          index = dynamic.end;
          canStartRegex = false;
          continue;
        }
      }
      canStartRegex = REGEX_PREFIX_KEYWORDS.has(identifier);
      index = end;
      continue;
    }
    if (/[0-9]/.test(character)) {
      index += 1;
      while (index < source.length && /[A-Za-z0-9_.]/.test(source[index])) index += 1;
      canStartRegex = false;
      continue;
    }
    if (character === "{") {
      braceDepth += 1;
      canStartRegex = true;
      index += 1;
      continue;
    }
    if (character === "}") {
      if (stopAtTemplateBrace && braceDepth === 0) return index + 1;
      braceDepth -= 1;
      if (braceDepth < 0) throw new Error("unexpected JavaScript closing brace");
      canStartRegex = false;
      index += 1;
      continue;
    }
    canStartRegex = !/[)\]]/.test(character);
    index += 1;
  }
  if (stopAtTemplateBrace) throw new Error("unterminated JavaScript template expression");
  return index;
}

function scanTemplate(source, start, dynamicSpecifiers) {
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }
    if (source[index] === "`") return index + 1;
    if (source[index] === "$" && source[index + 1] === "{") {
      index = scanCode(source, index + 2, true, dynamicSpecifiers) - 1;
    }
  }
  throw new Error("unterminated JavaScript template literal");
}

export function assertNoDynamicImports(source) {
  if (typeof source !== "string") throw new TypeError("module source must be a string");
  scanCode(source);
  return true;
}

export function parseStaticModuleSpecifiers(source) {
  assertNoDynamicImports(source);
  const temporaryRoot = mkdtempSync(join(tmpdir(), "static-module-parse-"));
  const sourcePath = join(temporaryRoot, "source.mjs");
  let stdout;
  try {
    writeFileSync(sourcePath, source);
    stdout = execFileSync(process.execPath, [
      "--no-warnings",
      "--experimental-vm-modules",
      "--input-type=module",
      "--eval",
      VM_MODULE_PARSER_SOURCE,
      sourcePath
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
  const specifiers = JSON.parse(stdout);
  if (!Array.isArray(specifiers) || specifiers.some(value => typeof value !== "string")) {
    throw new Error("Node module parser returned invalid dependency specifiers");
  }
  return Object.freeze([...specifiers]);
}

export function parseModuleSpecifiersWithLiteralDynamicImports(source) {
  if (typeof source !== "string") throw new TypeError("module source must be a string");
  const dynamicSpecifiers = [];
  scanCode(source, 0, false, dynamicSpecifiers);
  const temporaryRoot = mkdtempSync(join(tmpdir(), "module-specifier-parse-"));
  const sourcePath = join(temporaryRoot, "source.mjs");
  let staticSpecifiers;
  try {
    writeFileSync(sourcePath, source);
    const stdout = execFileSync(process.execPath, [
      "--no-warnings",
      "--experimental-vm-modules",
      "--input-type=module",
      "--eval",
      VM_MODULE_PARSER_SOURCE,
      sourcePath
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    staticSpecifiers = JSON.parse(stdout);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
  if (!Array.isArray(staticSpecifiers) || staticSpecifiers.some(value => typeof value !== "string")) {
    throw new Error("Node module parser returned invalid dependency specifiers");
  }
  return Object.freeze({
    staticSpecifiers: Object.freeze([...staticSpecifiers]),
    dynamicSpecifiers: Object.freeze([...dynamicSpecifiers])
  });
}
