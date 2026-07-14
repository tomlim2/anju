import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../src/canonical-hash.js";
import {
  buildOwnerSnapshotManifest,
  deriveToolingTrustClosureHashes,
  GENERATED_MANIFEST_PATH,
  LEDGER_PATH,
  PLANNING_FIXTURE_PATH,
  renderOwnerSnapshotModule
} from "./composition-owner-manifest-lib.mjs";
import {
  runProductionPlanningObserver,
  verifyPlanningFixture
} from "./verify-planning-complexity.mjs";

function valueAfter(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

export function emitOwnerSnapshot({
  repoRoot,
  compositionEngineVersion,
  write = false,
  appendLedger = false,
  upgradeReason = null
}) {
  const planningFixturePath = resolve(repoRoot, PLANNING_FIXTURE_PATH);
  const planningFixture = JSON.parse(readFileSync(planningFixturePath, "utf8"));
  const productionObservation = runProductionPlanningObserver(planningFixturePath);
  const planningComplexity = verifyPlanningFixture(planningFixture, {
    productionObservation
  }).active;
  const manifest = buildOwnerSnapshotManifest({
    repoRoot,
    compositionEngineVersion,
    planningComplexity
  });
  if (write) {
    writeFileSync(resolve(repoRoot, GENERATED_MANIFEST_PATH), renderOwnerSnapshotModule(manifest));
  }
  if (appendLedger) {
    if (!write) throw new Error("--append-ledger requires --write");
    const ledgerPath = resolve(repoRoot, LEDGER_PATH);
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
    const last = ledger.rows.at(-1) || null;
    if (last && canonicalJson(last.versionTuple) === canonicalJson(manifest.versionTuple)) {
      if (last.ownerSnapshotRevision !== manifest.ownerSnapshotRevision) {
        throw new Error("full version tuple cannot be reused for changed owner content");
      }
      return manifest;
    }
    const toolingSourceHashes = deriveToolingTrustClosureHashes(repoRoot);
    const toolingChanged = Boolean(last)
      && canonicalJson(last.toolingSourceHashes) !== canonicalJson(toolingSourceHashes);
    const toolingUpgrade = toolingChanged
      ? {
          fromCompositionEngineVersion: last.versionTuple.compositionEngineVersion,
          toCompositionEngineVersion: compositionEngineVersion,
          reason: upgradeReason?.trim() || ""
        }
      : null;
    if (toolingChanged && (
      !toolingUpgrade.reason
      || toolingUpgrade.toCompositionEngineVersion <= toolingUpgrade.fromCompositionEngineVersion
    )) {
      throw new Error("ledger append requires a higher engine version and upgrade reason");
    }
    ledger.rows.push({
      schemaVersion: 1,
      versionTuple: manifest.versionTuple,
      ownerSnapshotRevision: manifest.ownerSnapshotRevision,
      toolingSourceHashes,
      toolingUpgrade
    });
    writeFileSync(ledgerPath, `${canonicalJson(ledger)}\n`);
  }
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repoRoot = resolve(valueAfter(process.argv, "--repo-root") || new URL("../../..", import.meta.url).pathname);
  const compositionEngineVersion = Number(valueAfter(process.argv, "--engine-version"));
  const manifest = emitOwnerSnapshot({
    repoRoot,
    compositionEngineVersion,
    write: process.argv.includes("--write"),
    appendLedger: process.argv.includes("--append-ledger"),
    upgradeReason: valueAfter(process.argv, "--upgrade-reason")
  });
  process.stdout.write(`${manifest.ownerSnapshotRevision}\n`);
}
