import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../src/canonical-hash.js";
import { buildActivePlanningRelease } from "./planning-release-snapshot-lib.mjs";
import {
  derivePlanningCertificatePayloads,
  evaluateActivePlanningSnapshot
} from "./verify-planning-complexity.mjs";

function valueAfter(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
}

export function generatePlanningComplexityFixture({ fixturePath, write = false }) {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  const { snapshotInput } = buildActivePlanningRelease();
  const expectedCertificates = derivePlanningCertificatePayloads(snapshotInput);
  const activeSnapshot = {
    ...snapshotInput,
    expectedCertificates
  };
  evaluateActivePlanningSnapshot(activeSnapshot);
  const nextFixture = {
    ...fixture,
    schemaVersion: 2,
    oracleContractVersion: 2,
    activeSnapshot
  };
  if (write) writeFileSync(fixturePath, `${canonicalJson(nextFixture)}\n`);
  return nextFixture;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fixturePath = resolve(valueAfter(process.argv, "--fixture") || new URL(
    "../tests/fixtures/planning-complexity.json",
    import.meta.url
  ).pathname);
  const result = generatePlanningComplexityFixture({
    fixturePath,
    write: process.argv.includes("--write")
  });
  process.stdout.write(`planning fixture generated (${result.activeSnapshot.candidates.length} candidates)\n`);
}
