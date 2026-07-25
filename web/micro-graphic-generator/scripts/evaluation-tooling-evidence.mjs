import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { hashCanonical, sha256Hex } from "../src/canonical-hash.js";
import { validateEvaluationToolingEvidence } from "./evaluation-model.mjs";
import { deriveRuntimeResourceClosure } from "./composition-owner-manifest-lib.mjs";
import { parseModuleSpecifiersWithLiteralDynamicImports } from "./static-module-specifiers.mjs";

const PROFILE_CONTRACTS = Object.freeze({
  "expressive-range-v2": Object.freeze({
    moduleEntrypoints: Object.freeze([
      "web/micro-graphic-generator/scripts/generate-expressive-range-report.mjs",
      "web/micro-graphic-generator/tests/static-server.mjs"
    ]),
    htmlEntrypoints: Object.freeze([]),
    browserDynamicBases: Object.freeze({})
  }),
  "blind-evaluation-v1": Object.freeze({
    moduleEntrypoints: Object.freeze([
      "web/micro-graphic-generator/scripts/generate-blind-evaluation-corpus.mjs",
      "web/micro-graphic-generator/scripts/record-blind-review-result.mjs",
      "web/micro-graphic-generator/tests/blind-review-server.mjs",
      "web/micro-graphic-generator/tests/static-server.mjs"
    ]),
    htmlEntrypoints: Object.freeze([
      "web/micro-graphic-generator/tests/blind-review/index.html"
    ]),
    browserDynamicBases: Object.freeze({
      "web/micro-graphic-generator/scripts/generate-blind-evaluation-corpus.mjs":
        "web/micro-graphic-generator"
    })
  })
});

const APPROVED_EXTERNAL_SPECIFIERS = new Set(["@playwright/test"]);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function localDependencyPath(root, fromPath, specifier, baseOverride = null) {
  if (!specifier.startsWith(".")) return null;
  const base = baseOverride || dirname(fromPath);
  const joined = normalize(join(base, specifier)).split("\\").join("/");
  const dependency = extname(joined) ? joined : `${joined}.js`;
  if (!existsSync(resolve(root, dependency))) {
    throw new Error(`missing evaluation tooling dependency ${dependency}`);
  }
  return dependency;
}

export function deriveEvaluationToolingClosure(repoRoot, profile) {
  const root = resolve(repoRoot);
  const contract = PROFILE_CONTRACTS[profile];
  if (!contract) throw new Error(`unknown evaluation tooling profile ${profile}`);
  const pending = [...contract.moduleEntrypoints];
  const visited = new Set();
  while (pending.length > 0) {
    const path = pending.pop();
    if (visited.has(path)) continue;
    const absolute = resolve(root, path);
    if (!existsSync(absolute)) throw new Error(`missing evaluation tooling source ${path}`);
    visited.add(path);
    const source = readFileSync(absolute, "utf8");
    const parsed = parseModuleSpecifiersWithLiteralDynamicImports(source);
    for (const specifier of parsed.staticSpecifiers) {
      const dependency = localDependencyPath(root, path, specifier);
      if (dependency) pending.push(dependency);
      else if (!specifier.startsWith("node:") && !APPROVED_EXTERNAL_SPECIFIERS.has(specifier)) {
        throw new Error(`unapproved evaluation tooling dependency ${specifier} in ${path}`);
      }
    }
    for (const specifier of parsed.dynamicSpecifiers) {
      const dependency = localDependencyPath(
        root,
        path,
        specifier,
        contract.browserDynamicBases[path] || null
      );
      if (!dependency) throw new Error(`external dynamic evaluation dependency ${specifier} in ${path}`);
      pending.push(dependency);
    }
  }
  for (const htmlPath of contract.htmlEntrypoints) {
    const resources = deriveRuntimeResourceClosure(root, htmlPath);
    resources.allFiles.forEach(path => visited.add(path));
  }
  return Object.freeze([...visited].sort(compareStrings));
}

export function buildEvaluationToolingEvidence(repoRoot, profile) {
  const paths = deriveEvaluationToolingClosure(repoRoot, profile);
  const sourceByteHashes = paths.map(path => ({
    path,
    sha256Hex: sha256Hex(readFileSync(resolve(repoRoot, path)))
  }));
  const payload = {
    schemaVersion: 1,
    profile,
    sourceByteHashes
  };
  const evidence = Object.freeze({
    ...payload,
    revision: hashCanonical(payload)
  });
  validateEvaluationToolingEvidence(evidence, profile);
  return evidence;
}
