import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseStaticModuleSpecifiers } from "./static-module-specifiers.mjs";

const SCRIPT_PATH = "web/micro-graphic-generator/scripts/bootstrap-verify-composition-owner-snapshot.mjs";
const LEDGER_PATH = "web/micro-graphic-generator/tests/fixtures/composition-owner-snapshots.json";
const GENERATED_MANIFEST_PATH = "web/micro-graphic-generator/src/composition-owner-snapshot.js";
const TOOLING_ENTRYPOINTS = [
  SCRIPT_PATH,
  "web/micro-graphic-generator/scripts/emit-composition-owner-snapshot.mjs",
  "web/micro-graphic-generator/scripts/verify-composition-owner-snapshot.mjs",
  "web/micro-graphic-generator/scripts/verify-planning-complexity.mjs",
  "web/micro-graphic-generator/scripts/generate-planning-complexity-fixture.mjs",
  "web/micro-graphic-generator/scripts/observe-planning-production.mjs"
];
const TOOLING_HASH_EXCLUSIONS = new Set([
  "web/micro-graphic-generator/src/canonical-hash.js",
  "web/micro-graphic-generator/src/vendor/sha256.js"
]);

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) throw new Error(`unexpected argument ${value}`);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(value, next);
      index += 1;
    } else {
      args.set(value, true);
    }
  }
  return args;
}

function repoRelative(root, path) {
  const absolute = isAbsolute(path) ? path : resolve(root, path);
  const result = relative(root, absolute).split("\\").join("/");
  if (result.startsWith("../") || result === "..") throw new Error(`path escapes repository: ${path}`);
  return result;
}

function resolveLocalImport(fromPath, specifier) {
  if (!specifier.startsWith(".")) return null;
  const joined = normalize(join(dirname(fromPath), specifier)).split("\\").join("/");
  return joined.endsWith(".js") || joined.endsWith(".mjs") ? joined : `${joined}.js`;
}

function toolingClosure(entrypoints, readSource, sourceExists) {
  const pending = entrypoints.filter(sourceExists);
  const visited = new Set();
  while (pending.length > 0) {
    const path = pending.pop();
    if (visited.has(path)) continue;
    visited.add(path);
    const source = readSource(path).toString("utf8");
    if (path !== SCRIPT_PATH && /(?:node:crypto|from\s+["']crypto["'])/.test(source)) {
      throw new Error(`bootstrap dependency imports crypto directly: ${path}`);
    }
    for (const specifier of parseStaticModuleSpecifiers(source)) {
      const dependency = resolveLocalImport(path, specifier);
      if (!dependency && !specifier.startsWith("node:")) {
        throw new Error(`external tooling dependency is forbidden in ${path}: ${specifier}`);
      }
      if (dependency && !visited.has(dependency)) {
        if (!sourceExists(dependency)) throw new Error(`missing tooling dependency ${dependency}`);
        pending.push(dependency);
      }
    }
  }
  return [...visited].sort();
}

function hashRows(paths, readSource) {
  return paths.map(path => ({
    path,
    sha256Hex: createHash("sha256").update(readSource(path)).digest("hex")
  }));
}

function assertHashRows(actual, expected, label) {
  if (!Array.isArray(expected) || expected.length !== actual.length) {
    throw new Error(`${label} tooling hash count mismatch`);
  }
  for (let index = 0; index < actual.length; index += 1) {
    if (expected[index]?.path !== actual[index].path || expected[index]?.sha256Hex !== actual[index].sha256Hex) {
      throw new Error(`${label} tooling hash mismatch at ${actual[index].path}`);
    }
  }
}

function sameHashRows(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((entry, index) =>
      entry.path === right[index]?.path && entry.sha256Hex === right[index]?.sha256Hex
    );
}

function assertLedgerShape(ledger, label) {
  if (ledger?.schemaVersion !== 1 || !Array.isArray(ledger.rows)) {
    throw new Error(`${label} ledger must use schema 1`);
  }
  for (const [index, row] of ledger.rows.entries()) {
    if (row?.schemaVersion !== 1 || !row.versionTuple || typeof row.ownerSnapshotRevision !== "string") {
      throw new Error(`${label} ledger row ${index} has invalid shape`);
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(row.ownerSnapshotRevision)) {
      throw new Error(`${label} ledger row ${index} has invalid owner revision`);
    }
    if (!Array.isArray(row.toolingSourceHashes)) {
      throw new Error(`${label} ledger row ${index} is missing tooling hashes`);
    }
  }
}

function sameRawRecord(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseGeneratedManifest(source, label) {
  const text = source.toString("utf8");
  const match = text.match(
    /export const OWNER_SNAPSHOT_MANIFEST = deepFreeze\((\{.*\})\);\nexport const OWNER_SNAPSHOT_REVISION/s
  );
  if (!match) throw new Error(`${label} generated owner manifest is unreadable`);
  const manifest = JSON.parse(match[1]);
  if (manifest?.schemaVersion !== 1 || !manifest.versionTuple || !Array.isArray(manifest.entries)) {
    throw new Error(`${label} generated owner manifest has invalid shape`);
  }
  return manifest;
}

function assertManifestEntryIndex(manifest, label) {
  const index = new Map();
  for (const entry of manifest.entries) {
    if (
      !entry
      || typeof entry.ownerId !== "string"
      || typeof entry.versionField !== "string"
      || typeof entry.contentRevision !== "string"
      || !Object.hasOwn(manifest.versionTuple, entry.versionField)
      || !sameRawRecord(entry.versionValue, manifest.versionTuple[entry.versionField])
    ) throw new Error(`${label} owner manifest entry has invalid version binding`);
    if (index.has(entry.ownerId)) throw new Error(`${label} owner manifest repeats ${entry.ownerId}`);
    index.set(entry.ownerId, entry);
  }
  return index;
}

export function verifyOwnerVersionTransition({ baseManifest, candidateManifest }) {
  const candidateByOwner = assertManifestEntryIndex(candidateManifest, "candidate");
  if (!baseManifest) return Object.freeze({ changedOwnerIds: Object.freeze([]), genesis: true });
  const baseByOwner = assertManifestEntryIndex(baseManifest, "base");
  const baseOwnerIds = [...baseByOwner.keys()].sort();
  const candidateOwnerIds = [...candidateByOwner.keys()].sort();
  if (!sameRawRecord(baseOwnerIds, candidateOwnerIds)) {
    throw new Error("candidate owner manifest changed the exact owner set");
  }
  const changedOwnerIds = [];
  for (const ownerId of baseOwnerIds) {
    const before = baseByOwner.get(ownerId);
    const after = candidateByOwner.get(ownerId);
    if (before.versionField !== after.versionField) {
      throw new Error(`candidate owner ${ownerId} changed its version field`);
    }
    if (before.contentRevision === after.contentRevision) continue;
    if (sameRawRecord(before.versionValue, after.versionValue)) {
      throw new Error(`candidate owner ${ownerId} changed content without changing ${after.versionField}`);
    }
    if (
      Number.isInteger(before.versionValue)
      && Number.isInteger(after.versionValue)
      && after.versionValue <= before.versionValue
    ) {
      throw new Error(`candidate owner ${ownerId} did not increase ${after.versionField}`);
    }
    changedOwnerIds.push(ownerId);
  }
  return Object.freeze({
    changedOwnerIds: Object.freeze(changedOwnerIds),
    genesis: false
  });
}

function readCandidateLedger(candidateRoot) {
  return JSON.parse(readFileSync(resolve(candidateRoot, LEDGER_PATH), "utf8"));
}

function readBaseFile(repoRoot, baseRef, path) {
  return execFileSync("git", ["show", `${baseRef}:${path}`], {
    cwd: repoRoot,
    encoding: null,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function baseFileExists(repoRoot, baseRef, path) {
  const output = execFileSync("git", [
    "ls-tree",
    "-z",
    "--full-tree",
    baseRef,
    "--",
    path
  ], {
    cwd: repoRoot,
    encoding: null,
    stdio: ["ignore", "pipe", "pipe"]
  });
  return output.length > 0;
}

export function verifyLedgerTransition({ baseLedger, candidateLedger, candidateHashes }) {
  assertLedgerShape(candidateLedger, "candidate");
  if (!baseLedger) {
    if (candidateLedger.rows.length > 1) throw new Error("genesis ledger may contain at most one row");
    if (candidateLedger.rows.length === 1) {
      const row = candidateLedger.rows[0];
      if (row.toolingUpgrade !== null) throw new Error("genesis row toolingUpgrade must be null");
      assertHashRows(candidateHashes, row.toolingSourceHashes, "genesis");
    }
    return;
  }

  assertLedgerShape(baseLedger, "base");
  if (candidateLedger.rows.length < baseLedger.rows.length) throw new Error("candidate ledger removed base rows");
  if (candidateLedger.rows.length > baseLedger.rows.length + 1) throw new Error("candidate ledger may append one row");
  baseLedger.rows.forEach((row, index) => {
    if (!sameRawRecord(row, candidateLedger.rows[index])) {
      throw new Error(`candidate ledger rewrote base row ${index}`);
    }
  });

  const baseLast = baseLedger.rows.at(-1) || null;
  const candidateLast = candidateLedger.rows.at(-1) || null;
  if (!candidateLast) {
    if (candidateHashes.length !== 0) throw new Error("empty ledger cannot activate tooling");
    return;
  }
  assertHashRows(candidateHashes, candidateLast.toolingSourceHashes, "candidate");

  if (candidateLedger.rows.length === baseLedger.rows.length) {
    if (!baseLast) throw new Error("tooling activation requires a genesis row");
    assertHashRows(candidateHashes, baseLast.toolingSourceHashes, "unchanged");
    return;
  }

  if (!baseLast) throw new Error("non-genesis append requires a base ledger row");
  const toolingChanged = !sameHashRows(baseLast.toolingSourceHashes, candidateLast.toolingSourceHashes);
  const upgrade = candidateLast.toolingUpgrade;
  const from = baseLast.versionTuple.compositionEngineVersion;
  const to = candidateLast.versionTuple.compositionEngineVersion;
  if (!toolingChanged) {
    if (upgrade !== null) throw new Error("unchanged tooling requires toolingUpgrade null");
    if (!Number.isInteger(to) || to < from) throw new Error("composition engine version cannot decrease");
  } else {
    if (!upgrade || typeof upgrade.reason !== "string" || upgrade.reason.trim() === "") {
      throw new Error("tooling mutation requires a recorded upgrade");
    }
    if (
      upgrade.fromCompositionEngineVersion !== from
      || upgrade.toCompositionEngineVersion !== to
      || !Number.isInteger(to)
      || to <= from
    ) {
      throw new Error("recorded tooling upgrade version mismatch");
    }
  }
}

function executeBaseVerifier({ repoRoot, baseRef, candidateRoot, mode }) {
  const entrypoint = "web/micro-graphic-generator/scripts/verify-composition-owner-snapshot.mjs";
  if (!baseFileExists(repoRoot, baseRef, entrypoint)) {
    throw new Error(`trusted base is missing ${entrypoint}`);
  }
  const readBase = path => readBaseFile(repoRoot, baseRef, path);
  const existsBase = path => baseFileExists(repoRoot, baseRef, path);
  const closure = toolingClosure([entrypoint], readBase, existsBase);
  const temporaryRoot = mkdtempSync(join(tmpdir(), "composition-owner-base-"));
  try {
    for (const path of closure) {
      const target = resolve(temporaryRoot, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readBase(path));
    }
    if (!["base-authority", "trusted-production-activation"].includes(mode)) {
      throw new Error(`unknown base verification mode ${mode}`);
    }
    execFileSync(process.execPath, [
      resolve(temporaryRoot, entrypoint),
      "--repo-root",
      candidateRoot,
      "--bootstrap-authorized",
      `--${mode}`
    ], { cwd: temporaryRoot, stdio: "inherit" });
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function executeCandidateVerifier(candidateRoot) {
  const entrypoint = resolve(
    candidateRoot,
    "web/micro-graphic-generator/scripts/verify-composition-owner-snapshot.mjs"
  );
  if (!existsSync(entrypoint)) throw new Error("candidate owner verifier is missing");
  execFileSync(process.execPath, [
    entrypoint,
    "--repo-root",
    candidateRoot,
    "--candidate-activation-authorized"
  ], { cwd: candidateRoot, stdio: "inherit" });
}

export function runVerificationStages({
  hasBaseRef,
  allowGenesis,
  verifyBase,
  verifyTrustedProduction,
  verifyCandidate
}) {
  if (
    typeof verifyBase !== "function"
    || typeof verifyTrustedProduction !== "function"
    || typeof verifyCandidate !== "function"
  ) {
    throw new TypeError("verification stage callbacks are required");
  }
  if (hasBaseRef) {
    verifyBase();
    verifyTrustedProduction();
    verifyCandidate();
    return Object.freeze([
      "base-authority",
      "trusted-production-activation",
      "candidate-activation"
    ]);
  }
  if (allowGenesis) {
    verifyCandidate();
    return Object.freeze(["candidate-activation"]);
  }
  return Object.freeze([]);
}

export function bootstrapVerify({
  repoRoot,
  candidateRoot = repoRoot,
  baseRef = null,
  allowGenesis = false
}) {
  const normalizedRepoRoot = resolve(repoRoot);
  const normalizedCandidateRoot = resolve(candidateRoot);
  const readCandidate = path => readFileSync(resolve(normalizedCandidateRoot, repoRelative(normalizedCandidateRoot, path)));
  const candidateExists = path => existsSync(resolve(normalizedCandidateRoot, repoRelative(normalizedCandidateRoot, path)));
  const candidateClosure = toolingClosure(TOOLING_ENTRYPOINTS, readCandidate, candidateExists);
  const candidateHashes = hashRows(
    candidateClosure.filter(path =>
      path.startsWith("web/micro-graphic-generator/scripts/")
      && !TOOLING_HASH_EXCLUSIONS.has(path)
    ),
    readCandidate
  );
  const candidateLedger = readCandidateLedger(normalizedCandidateRoot);

  if (!baseRef && !allowGenesis) {
    throw new Error("owner bootstrap requires a trusted base ref; genesis must be explicitly authorized");
  }
  if (baseRef) {
    execFileSync("git", ["rev-parse", "--verify", `${baseRef}^{commit}`], {
      cwd: normalizedRepoRoot,
      stdio: ["ignore", "ignore", "pipe"]
    });
  }
  let baseLedger = null;
  let baseManifest = null;
  if (baseRef) {
    if (!baseFileExists(normalizedRepoRoot, baseRef, SCRIPT_PATH)) {
      throw new Error(`trusted base is missing ${SCRIPT_PATH}`);
    }
    if (!baseFileExists(normalizedRepoRoot, baseRef, LEDGER_PATH)) {
      throw new Error(`trusted base is missing ${LEDGER_PATH}`);
    }
    baseLedger = JSON.parse(readBaseFile(normalizedRepoRoot, baseRef, LEDGER_PATH).toString("utf8"));
    if (baseFileExists(normalizedRepoRoot, baseRef, GENERATED_MANIFEST_PATH)) {
      baseManifest = parseGeneratedManifest(
        readBaseFile(normalizedRepoRoot, baseRef, GENERATED_MANIFEST_PATH),
        "base"
      );
    }
  }
  verifyLedgerTransition({ baseLedger, candidateLedger, candidateHashes });
  runVerificationStages({
    hasBaseRef: Boolean(baseRef),
    allowGenesis,
    verifyBase: () => executeBaseVerifier({
      repoRoot: normalizedRepoRoot,
      baseRef,
      candidateRoot: normalizedCandidateRoot,
      mode: "base-authority"
    }),
    verifyTrustedProduction: () => executeBaseVerifier({
      repoRoot: normalizedRepoRoot,
      baseRef,
      candidateRoot: normalizedCandidateRoot,
      mode: "trusted-production-activation"
    }),
    verifyCandidate: () => {
      const candidateManifest = parseGeneratedManifest(
        readCandidate(GENERATED_MANIFEST_PATH),
        "candidate"
      );
      verifyOwnerVersionTransition({ baseManifest, candidateManifest });
      executeCandidateVerifier(normalizedCandidateRoot);
    }
  });
  return Object.freeze({ candidateHashes: Object.freeze(candidateHashes), genesis: baseLedger === null });
}

if (
  process.argv[1]
  && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(args.get("--repo-root") || new URL("../../..", import.meta.url).pathname);
  const candidateRoot = resolve(args.get("--candidate-root") || repoRoot);
  const baseRefValue = args.get("--base-ref");
  const baseRef = typeof baseRefValue === "string" && !/^0+$/.test(baseRefValue) ? baseRefValue : null;
  const result = bootstrapVerify({
    repoRoot,
    candidateRoot,
    baseRef,
    allowGenesis: args.has("--allow-genesis")
  });
  process.stdout.write(`composition owner bootstrap verified (${result.genesis ? "genesis" : "base-ref"})\n`);
}
