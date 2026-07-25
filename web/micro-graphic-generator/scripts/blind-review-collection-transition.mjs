function fail(message) {
  throw new TypeError(`blindReviewCollection: ${message}`);
}

function assertCorpusIdentity(corpus) {
  if (!corpus || typeof corpus !== "object" || Array.isArray(corpus)) fail("missing corpus");
  if (typeof corpus.corpusId !== "string" || corpus.corpusId.length === 0) fail("invalid corpus ID");
  if (!/^sha256:[0-9a-f]{64}$/.test(corpus.translationErrorLedgerRevision)) {
    fail("invalid translation error ledger revision");
  }
}

export function emptyBlindReviewCollection(corpus) {
  assertCorpusIdentity(corpus);
  return {
    schemaVersion: 1,
    corpusId: corpus.corpusId,
    translationErrorLedgerRevision: corpus.translationErrorLedgerRevision,
    results: []
  };
}

export function rebaseEmptyBlindReviewCollection(collection, corpus) {
  assertCorpusIdentity(corpus);
  if (!collection || typeof collection !== "object" || Array.isArray(collection)) fail("expected object");
  const keys = Object.keys(collection).sort();
  const expectedKeys = ["corpusId", "results", "schemaVersion", "translationErrorLedgerRevision"];
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) fail("unexpected fields");
  if (collection.schemaVersion !== 1) fail("expected schema 1");
  if (typeof collection.corpusId !== "string" || collection.corpusId.length === 0) fail("invalid corpus ID");
  if (!/^sha256:[0-9a-f]{64}$/.test(collection.translationErrorLedgerRevision)) {
    fail("invalid translation error ledger revision");
  }
  if (!Array.isArray(collection.results) || collection.results.length !== 0) {
    fail("only an empty result set can be rebased");
  }
  return emptyBlindReviewCollection(corpus);
}
