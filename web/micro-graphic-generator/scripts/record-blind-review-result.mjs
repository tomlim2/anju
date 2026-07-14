import { randomUUID } from "node:crypto";
import { open, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lexicalUses, translationErrorLedger } from "../src/vocabulary.js";
import { activeRecipeIds } from "../src/composition-recipes.js";
import { motifRegistry } from "../src/motifs.js";
import { canonicalJson, hashCanonical } from "../src/canonical-hash.js";
import {
  buildBlindEvaluationReport,
  validateBlindCorpus,
  validateBlindReviewCollection,
  validateBlindReviewResult,
  validateReviewerQualificationSet
} from "./evaluation-model.mjs";
import { buildEvaluationToolingEvidence } from "./evaluation-tooling-evidence.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const defaultPaths = Object.freeze({
  corpus: fileURLToPath(new URL("../tests/fixtures/blind-evaluation-corpus.v1.json", import.meta.url)),
  reviews: fileURLToPath(new URL("../tests/fixtures/blind-review-results.v1.json", import.meta.url)),
  qualifications: fileURLToPath(new URL("../tests/fixtures/reviewer-qualifications.v1.json", import.meta.url)),
  report: fileURLToPath(new URL("../tests/fixtures/blind-evaluation-report.v1.json", import.meta.url))
});
const LOCK_STALE_AFTER_MS = 30_000;

function compareReviews(left, right) {
  return left.fixtureId.localeCompare(right.fixtureId) || left.reviewerId.localeCompare(right.reviewerId);
}

function resultIdentity(result) {
  return `${result.fixtureId}/${result.reviewerId}`;
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    throw error;
  }
}

async function readLockRecord(path) {
  try {
    const text = await readFile(path, "utf8");
    try {
      return JSON.parse(text);
    } catch {
      const legacyPid = Number(text.trim());
      return Number.isInteger(legacyPid) ? { pid: legacyPid, createdAt: null } : null;
    }
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function staleLock(path, now) {
  const record = await readLockRecord(path);
  let modifiedAt;
  try {
    modifiedAt = (await stat(path)).mtimeMs;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  if (record?.pid && processIsAlive(record.pid)) return false;
  const createdAt = Number.isFinite(Date.parse(record?.createdAt))
    ? Date.parse(record.createdAt)
    : modifiedAt;
  return now - createdAt >= LOCK_STALE_AFTER_MS;
}

export async function acquireReviewIngestionLock(path, {
  attempts = 1_200,
  retryDelayMs = 25,
  now = () => Date.now(),
  transactionId = randomUUID()
} = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const handle = await open(path, "wx");
      try {
        await handle.writeFile(`${canonicalJson({
          schemaVersion: 1,
          pid: process.pid,
          createdAt: new Date(now()).toISOString(),
          transactionId
        })}\n`);
        await handle.sync();
      } finally {
        await handle.close();
      }
      return Object.freeze({ path, transactionId });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (await staleLock(path, now())) {
        const quarantined = `${path}.stale.${randomUUID()}`;
        try {
          await rename(path, quarantined);
          await rm(quarantined, { force: true });
        } catch (renameError) {
          if (renameError?.code !== "ENOENT") throw renameError;
        }
        continue;
      }
      if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
  throw new Error("timed out waiting for blind review ingestion lock");
}

export async function atomicWriteJson(path, value) {
  const temporary = join(dirname(path), `.${process.pid}.${randomUUID()}.${path.split("/").at(-1)}.tmp`);
  let handle;
  try {
    handle = await open(temporary, "wx");
    await handle.writeFile(`${canonicalJson(value)}\n`);
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, path);
    const directoryHandle = await open(dirname(path), "r");
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  } finally {
    await handle?.close();
    await rm(temporary, { force: true });
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readJournal(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function createReport({
  corpus,
  collection,
  qualificationSet,
  evaluationTooling,
  activeMotifIds
}) {
  return buildBlindEvaluationReport({
    corpus,
    reviewResults: collection.results,
    translationErrorLedger,
    evaluationTooling,
    lexicalUses,
    reviewerQualificationSet: qualificationSet,
    activeRecipeIds,
    activeMotifIds
  });
}

function createJournal({
  transactionId,
  corpus,
  result,
  baseCollection,
  nextCollection,
  nextReport
}) {
  return {
    schemaVersion: 1,
    transactionId,
    corpusId: corpus.corpusId,
    resultIdentity: resultIdentity(result),
    baseCollectionRevision: hashCanonical(baseCollection),
    nextCollectionRevision: hashCanonical(nextCollection),
    nextReportRevision: hashCanonical(nextReport),
    nextCollection,
    nextReport
  };
}

function validateJournal(journal, { corpus, qualificationSet, evaluationTooling, activeMotifIds }) {
  const expectedKeys = [
    "schemaVersion", "transactionId", "corpusId", "resultIdentity",
    "baseCollectionRevision", "nextCollectionRevision", "nextReportRevision",
    "nextCollection", "nextReport"
  ].sort();
  if (
    journal?.schemaVersion !== 1
    || canonicalJson(Object.keys(journal).sort()) !== canonicalJson(expectedKeys)
    || journal.corpusId !== corpus.corpusId
  ) throw new Error("blind review ingestion journal has invalid identity");
  validateBlindReviewCollection(journal.nextCollection, corpus, { qualificationSet });
  if (hashCanonical(journal.nextCollection) !== journal.nextCollectionRevision) {
    throw new Error("blind review ingestion journal collection digest mismatch");
  }
  const derivedReport = createReport({
    corpus,
    collection: journal.nextCollection,
    qualificationSet,
    evaluationTooling,
    activeMotifIds
  });
  if (
    hashCanonical(journal.nextReport) !== journal.nextReportRevision
    || canonicalJson(journal.nextReport) !== canonicalJson(derivedReport)
  ) throw new Error("blind review ingestion journal report digest mismatch");
  return journal;
}

export async function recoverReviewIngestionTransaction({
  paths,
  corpus,
  qualificationSet,
  evaluationTooling,
  activeMotifIds
}) {
  const journalPath = `${paths.reviews}.journal`;
  const journal = await readJournal(journalPath);
  if (!journal) return null;
  validateJournal(journal, { corpus, qualificationSet, evaluationTooling, activeMotifIds });
  const collection = await readJson(paths.reviews);
  validateBlindReviewCollection(collection, corpus, { qualificationSet });
  const collectionRevision = hashCanonical(collection);
  if (collectionRevision === journal.baseCollectionRevision) {
    await atomicWriteJson(paths.reviews, journal.nextCollection);
  } else if (collectionRevision !== journal.nextCollectionRevision) {
    throw new Error("blind review ingestion journal conflicts with committed collection");
  }
  await atomicWriteJson(paths.report, journal.nextReport);
  const [committedCollection, committedReport] = await Promise.all([
    readJson(paths.reviews),
    readJson(paths.report)
  ]);
  if (
    hashCanonical(committedCollection) !== journal.nextCollectionRevision
    || hashCanonical(committedReport) !== journal.nextReportRevision
  ) throw new Error("blind review ingestion recovery did not reach journaled state");
  await rm(journalPath, { force: true });
  return journal.resultIdentity;
}

export async function ingestBlindReviewResult({
  inputPath,
  paths = defaultPaths,
  evaluationTooling = buildEvaluationToolingEvidence(repoRoot, "blind-evaluation-v1"),
  faultAfter = null
}) {
  if (faultAfter !== null && !["journal", "collection"].includes(faultAfter)) {
    throw new Error(`unknown blind ingestion fault point ${faultAfter}`);
  }
  const [corpus, qualificationSet, result] = await Promise.all([
    readJson(paths.corpus),
    readJson(paths.qualifications),
    readJson(inputPath)
  ]);
  const activeMotifIds = motifRegistry.map(record => record.id).sort();
  validateBlindCorpus(corpus, { activeRecipeIds, activeMotifIds });
  validateReviewerQualificationSet(qualificationSet);
  const pair = corpus.pairs.find(item => item.fixtureId === result.fixtureId);
  if (!pair) throw new Error(`unknown blind fixture ${result.fixtureId}`);
  validateBlindReviewResult(result, pair, {
    qualificationSet,
    translationErrorLedgerRevision: corpus.translationErrorLedgerRevision
  });

  const transactionId = randomUUID();
  const lockPath = `${paths.reviews}.lock`;
  await acquireReviewIngestionLock(lockPath, { transactionId });
  try {
    const recoveredIdentity = await recoverReviewIngestionTransaction({
      paths,
      corpus,
      qualificationSet,
      evaluationTooling,
      activeMotifIds
    });
    if (recoveredIdentity === resultIdentity(result)) {
      const recoveredReport = await readJson(paths.report);
      return Object.freeze({ result, report: recoveredReport, recovered: true });
    }
    const collection = await readJson(paths.reviews);
    validateBlindReviewCollection(collection, corpus, { qualificationSet });
    if (collection.results.some(item => resultIdentity(item) === resultIdentity(result))) {
      throw new Error(`immutable result already exists for ${resultIdentity(result)}`);
    }
    const nextCollection = {
      ...collection,
      results: [...collection.results, result].sort(compareReviews)
    };
    validateBlindReviewCollection(nextCollection, corpus, { qualificationSet });
    const nextReport = createReport({
      corpus,
      collection: nextCollection,
      qualificationSet,
      evaluationTooling,
      activeMotifIds
    });
    const journal = createJournal({
      transactionId,
      corpus,
      result,
      baseCollection: collection,
      nextCollection,
      nextReport
    });
    const journalPath = `${paths.reviews}.journal`;
    await atomicWriteJson(journalPath, journal);
    if (faultAfter === "journal") throw new Error("blind-ingestion-test-fault:journal");
    await atomicWriteJson(paths.reviews, nextCollection);
    if (faultAfter === "collection") throw new Error("blind-ingestion-test-fault:collection");
    await atomicWriteJson(paths.report, nextReport);
    const [committedCollection, committedReport] = await Promise.all([
      readJson(paths.reviews),
      readJson(paths.report)
    ]);
    if (
      canonicalJson(committedCollection) !== canonicalJson(nextCollection)
      || canonicalJson(committedReport) !== canonicalJson(nextReport)
    ) throw new Error("committed blind review transaction differs from accepted state");
    await rm(journalPath, { force: true });
    return Object.freeze({ result, report: nextReport, recovered: false });
  } finally {
    await rm(lockPath, { force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error("usage: node record-blind-review-result.mjs <review-result.json>");
  const outcome = await ingestBlindReviewResult({ inputPath });
  process.stdout.write(
    `${outcome.recovered ? "recovered" : "recorded"} ${resultIdentity(outcome.result)}; `
    + `${outcome.report.reviewerCoverage.filter(row => !row.pass).length} fixtures still need reviewer coverage\n`
  );
}
