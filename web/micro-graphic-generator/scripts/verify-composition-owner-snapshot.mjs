import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, hashCanonical } from "../src/canonical-hash.js";
import {
  buildOwnerSnapshotManifest,
  GENERATED_MANIFEST_PATH,
  LEDGER_PATH,
  parseGeneratedEngineVersion,
  PLANNING_FIXTURE_PATH,
  renderOwnerSnapshotModule
} from "./composition-owner-manifest-lib.mjs";
import {
  runProductionPlanningObserver,
  verifyPlanningFixture,
  verifyPlanningFixtureIndependent
} from "./verify-planning-complexity.mjs";

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (!value.startsWith("--")) throw new Error(`unexpected argument ${value}`);
    if (next && !next.startsWith("--")) {
      args.set(value, next);
      index += 1;
    } else {
      args.set(value, true);
    }
  }
  return args;
}

function assertDigest(value, label) {
  if (!/^sha256:[0-9a-f]{64}$/.test(value)) throw new Error(`${label} must be a prefixed SHA-256 digest`);
}

export function validateOwnerSnapshotLedger(ledger) {
  if (ledger?.schemaVersion !== 1 || !Array.isArray(ledger.rows)) {
    throw new Error("owner snapshot ledger must use schema 1");
  }
  const versionTuples = new Set();
  let previousRow = null;
  for (const [index, row] of ledger.rows.entries()) {
    if (row?.schemaVersion !== 1 || !row.versionTuple || !Array.isArray(row.toolingSourceHashes)) {
      throw new Error(`invalid owner snapshot ledger row ${index}`);
    }
    assertDigest(row.ownerSnapshotRevision, `rows[${index}].ownerSnapshotRevision`);
    const tupleKey = canonicalJson(row.versionTuple);
    if (versionTuples.has(tupleKey)) throw new Error("owner snapshot ledger reuses a full version tuple");
    versionTuples.add(tupleKey);
    const engineVersion = row.versionTuple.compositionEngineVersion;
    if (!Number.isInteger(engineVersion) || engineVersion < 1) {
      throw new Error("composition engine version must be positive");
    }
    const paths = row.toolingSourceHashes.map(entry => entry.path);
    if (new Set(paths).size !== paths.length || paths.some((path, pathIndex) => pathIndex > 0 && paths[pathIndex - 1] >= path)) {
      throw new Error("tooling source hashes must have unique ascending paths");
    }
    row.toolingSourceHashes.forEach(entry => {
      if (!/^[0-9a-f]{64}$/.test(entry.sha256Hex)) throw new Error("invalid raw tooling byte hash");
    });
    if (previousRow) {
      const previousEngineVersion = previousRow.versionTuple.compositionEngineVersion;
      if (engineVersion < previousEngineVersion) throw new Error("composition engine version cannot decrease");
      const toolingChanged = canonicalJson(previousRow.toolingSourceHashes) !== canonicalJson(row.toolingSourceHashes);
      if (toolingChanged) {
        if (
          !row.toolingUpgrade
          || row.toolingUpgrade.fromCompositionEngineVersion !== previousEngineVersion
          || row.toolingUpgrade.toCompositionEngineVersion !== engineVersion
          || engineVersion <= previousEngineVersion
          || typeof row.toolingUpgrade.reason !== "string"
          || !row.toolingUpgrade.reason.trim()
        ) throw new Error("changed tooling requires a valid engine-version upgrade");
      } else if (row.toolingUpgrade !== null) {
        throw new Error("unchanged tooling requires toolingUpgrade null");
      }
    } else if (row.toolingUpgrade !== null) {
      throw new Error("genesis toolingUpgrade must be null");
    }
    previousRow = row;
  }
  return Object.freeze({ rowCount: ledger.rows.length, ledgerRevision: hashCanonical(ledger) });
}

export function verifyCommittedOwnerSnapshot(
  repoRoot,
  { requireProductionParity = true, productionOwnerRoot = null } = {}
) {
  const root = resolve(repoRoot);
  const planningFixturePath = resolve(root, PLANNING_FIXTURE_PATH);
  const planningFixture = JSON.parse(readFileSync(planningFixturePath, "utf8"));
  const planningResult = requireProductionParity
    ? verifyPlanningFixture(planningFixture, {
        productionObservation: runProductionPlanningObserver(planningFixturePath, {
          ownerRoot: productionOwnerRoot
        })
      })
    : verifyPlanningFixtureIndependent(planningFixture);
  const planningComplexity = planningResult.active;
  const manifest = buildOwnerSnapshotManifest({
    repoRoot: root,
    compositionEngineVersion: parseGeneratedEngineVersion(root),
    planningComplexity
  });
  const expectedSource = renderOwnerSnapshotModule(manifest);
  const actualSource = readFileSync(resolve(root, GENERATED_MANIFEST_PATH), "utf8");
  if (actualSource !== expectedSource) throw new Error("generated owner manifest bytes are stale");
  const ledger = JSON.parse(readFileSync(resolve(root, LEDGER_PATH), "utf8"));
  validateOwnerSnapshotLedger(ledger);
  const last = ledger.rows.at(-1);
  if (last) {
    if (
      canonicalJson(last.versionTuple) !== canonicalJson(manifest.versionTuple)
      || last.ownerSnapshotRevision !== manifest.ownerSnapshotRevision
    ) {
      throw new Error("owner ledger last row does not activate committed manifest");
    }
  }
  return Object.freeze({
    manifest,
    ledger,
    productionParity: planningResult.productionParity
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const baseAuthority = args.has("--base-authority");
  const bootstrapAuthorized = args.has("--bootstrap-authorized");
  const candidateActivationAuthorized = args.has("--candidate-activation-authorized");
  const trustedProductionActivation = args.has("--trusted-production-activation");
  const allowLocal = args.has("--allow-local");
  if ((baseAuthority || trustedProductionActivation) && !bootstrapAuthorized) {
    throw new Error("trusted base modes require bootstrap authorization");
  }
  if (baseAuthority && trustedProductionActivation) {
    throw new Error("base authority and trusted production activation are separate stages");
  }
  if ((baseAuthority || trustedProductionActivation) && (candidateActivationAuthorized || allowLocal)) {
    throw new Error("trusted base modes cannot execute candidate activation mode");
  }
  if (!baseAuthority && !trustedProductionActivation && !candidateActivationAuthorized && !allowLocal) {
    throw new Error("candidate verifier requires activation authorization");
  }
  const repoRoot = resolve(args.get("--repo-root") || new URL("../../..", import.meta.url).pathname);
  const result = verifyCommittedOwnerSnapshot(repoRoot, {
    requireProductionParity: !baseAuthority,
    productionOwnerRoot: trustedProductionActivation ? repoRoot : null
  });
  const mode = baseAuthority
    ? "base-authority"
    : trustedProductionActivation
      ? "trusted-production-activation"
      : "candidate-activation";
  process.stdout.write(`composition owner snapshot verified (${result.ledger.rows.length} rows, ${mode})\n`);
}
