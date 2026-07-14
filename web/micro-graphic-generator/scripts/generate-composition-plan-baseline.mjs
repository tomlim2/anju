import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildCompositionPlanBaseline } from "./composition-plan-baseline-lib.mjs";
import { assertRuntimeConformance } from "../tests/runtime-conformance.mjs";

const fixturePath = fileURLToPath(new URL("../tests/fixtures/composition-plan-baseline.json", import.meta.url));
const write = process.argv.includes("--write");

assertRuntimeConformance();

const serialized = `${JSON.stringify(buildCompositionPlanBaseline(), null, 2)}\n`;
if (write) {
  await writeFile(fixturePath, serialized);
} else {
  const existing = await readFile(fixturePath, "utf8");
  if (existing !== serialized) throw new Error("composition plan baseline is stale; run with --write");
}
process.stdout.write(`${write ? "wrote" : "verified"} ${fixturePath}\n`);
