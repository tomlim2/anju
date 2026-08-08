import { canonicalJson, hashCanonical } from "./canonical-hash.js";
import { ACTIVE_STROKE_WEIGHTS } from "./config.js";

export const MOTIF_REGISTRY_VERSION = 1;

// Manga-terminal pattern motifs. Uniform seedBits renderParams; each is drawn
// to fill the block ratio in graphics.js renderCompositionMotif.
const PATTERN_MOTIFS = [
  { id: "motif.halftone-meter", graphicType: "halftone-meter", tag: "data-table-look", factor: 0.7 },
  { id: "motif.dot-matrix", graphicType: "dot-matrix", tag: "data-table-look", factor: 0.7 },
  { id: "motif.radial-halftone", graphicType: "radial-halftone", tag: "signal-plot-look", factor: 0.7 },
  { id: "motif.stipple", graphicType: "stipple", tag: "data-table-look", factor: 0.7 },
  { id: "motif.scanlines", graphicType: "scanlines", tag: "signal-plot-look", factor: 0.7 },
  { id: "motif.speed-lines", graphicType: "speed-lines", tag: "signal-plot-look", factor: 0.65 },
  { id: "motif.chevron", graphicType: "chevron", tag: "signal-plot-look", factor: 0.65 },
  { id: "motif.perspective", graphicType: "perspective", tag: "machine-readable-mark", factor: 0.7 },
  { id: "motif.focus-lines", graphicType: "focus-lines", tag: "signal-plot-look", factor: 0.75 },
  { id: "motif.beta-flash", graphicType: "beta-flash", tag: "machine-readable-mark", factor: 0.8 },
  { id: "motif.burst-rings", graphicType: "burst-rings", tag: "signal-plot-look", factor: 0.7 },
  // technical-drawing family: matches the REV-A / CFG-01 documentation voice
  { id: "motif.crosshair", graphicType: "crosshair", tag: "machine-readable-mark", factor: 0.7 },
  { id: "motif.dimension", graphicType: "dimension", tag: "machine-readable-mark", factor: 0.7 },
  { id: "motif.graph-paper", graphicType: "graph-paper", tag: "data-table-look", factor: 0.7 },
  { id: "motif.tick-ring", graphicType: "tick-ring", tag: "signal-plot-look", factor: 0.7 }
];
const PATTERN_TYPES = new Set(PATTERN_MOTIFS.map(motif => motif.graphicType));

export const motifCalibration = Object.freeze({
  ...Object.fromEntries(PATTERN_MOTIFS.map(motif => [motif.id, {
    p95Coverage: 0.3,
    factor: motif.factor,
    reviewerIds: ["typography-01", "product-01"]
  }])),
  "motif.barcode": Object.freeze({
    p95Coverage: 0.151690943,
    factor: 1.2,
    reviewerIds: Object.freeze(["typography-01", "product-01"])
  }),
  "motif.table": Object.freeze({
    p95Coverage: 0.097302785,
    factor: 0.75,
    reviewerIds: Object.freeze(["typography-01", "product-01"])
  }),
  "motif.wave": Object.freeze({
    p95Coverage: 0.029670865,
    factor: 0.65,
    reviewerIds: Object.freeze(["typography-01", "product-01"])
  })
});

function motifRecord({ id, graphicType, role, motifTags, occupancySafetyFactor, intrinsicBySize }) {
  const calibrationPayload = motifCalibration[id];
  if (calibrationPayload.factor !== occupancySafetyFactor) {
    throw new Error(`calibration factor mismatch for ${id}`);
  }
  return Object.freeze({
    id,
    graphicType,
    form: "graphic",
    function: "data",
    role,
    motifTags: Object.freeze(motifTags),
    factual: false,
    uniqueWithinComponent: true,
    maxProminence: "secondary",
    declaredVariantCount: 2,
    p95Coverage: calibrationPayload.p95Coverage,
    calibrationReviewerIds: calibrationPayload.reviewerIds,
    occupancySafetyFactor,
    occupancyCalibrationRevision: hashCanonical({ id, ...calibrationPayload }),
    intrinsicBySize: Object.freeze(intrinsicBySize)
  });
}

export const motifRegistry = Object.freeze([
  motifRecord({
    id: "motif.barcode",
    graphicType: "barcode",
    role: "barcode",
    motifTags: ["machine-readable-mark"],
    occupancySafetyFactor: 1.2,
    intrinsicBySize: { medium: { width: 96, height: 38 }, large: { width: 144, height: 57 } }
  }),
  motifRecord({
    id: "motif.table",
    graphicType: "table",
    role: "table",
    motifTags: ["data-table-look"],
    occupancySafetyFactor: 0.75,
    intrinsicBySize: { medium: { width: 96, height: 48 }, large: { width: 144, height: 72 } }
  }),
  motifRecord({
    id: "motif.wave",
    graphicType: "wave",
    role: "wave",
    motifTags: ["signal-plot-look"],
    occupancySafetyFactor: 0.65,
    intrinsicBySize: { medium: { width: 84, height: 42 }, large: { width: 126, height: 63 } }
  }),
  ...PATTERN_MOTIFS.map(motif => motifRecord({
    id: motif.id,
    graphicType: motif.graphicType,
    role: motif.graphicType,
    motifTags: [motif.tag],
    occupancySafetyFactor: motif.factor,
    intrinsicBySize: { medium: { width: 96, height: 48 }, large: { width: 144, height: 72 } }
  }))
]);

export const motifById = new Map(motifRegistry.map(record => [record.id, record]));

function deterministicBits(materializationKey, length) {
  const hex = materializationKey.slice("sha256:".length);
  let bits = "";
  for (let index = 0; bits.length < length; index += 1) {
    const nibble = Number.parseInt(hex[index % hex.length], 16);
    bits += nibble.toString(2).padStart(4, "0");
  }
  return bits.slice(0, length);
}

function renderParamsFor(record, size, materializationKey) {
  const shared = { graphicType: record.graphicType, size, stroke: ACTIVE_STROKE_WEIGHTS[0] };
  if (record.graphicType === "barcode") {
    return Object.freeze({ ...shared, value: deterministicBits(materializationKey, 12), barPattern: deterministicBits(materializationKey, 95) });
  }
  if (record.graphicType === "pseudo-qr") {
    return Object.freeze({ ...shared, moduleCount: 21, payloadBits: deterministicBits(materializationKey, 441) });
  }
  if (record.graphicType === "table") {
    return Object.freeze({ ...shared, columns: 3, rows: 4, densityKey: deterministicBits(materializationKey, 12) });
  }
  if (record.graphicType === "wave") {
    return Object.freeze({ ...shared, pointCount: 12, amplitudeKey: deterministicBits(materializationKey, 24) });
  }
  return Object.freeze({ ...shared, seedBits: deterministicBits(materializationKey, 48) });
}

export function materializeMotifCandidates({
  registry = motifRegistry,
  motifVersion = MOTIF_REGISTRY_VERSION
} = {}) {
  const sizes = ["medium", "large"];
  return Object.freeze(registry.flatMap(record => sizes.map((size, materializationOrdinal) => {
    const materializationKey = hashCanonical({
      ownerVersion: motifVersion,
      familyKey: record.id,
      materializationOrdinal
    });
    const renderParams = renderParamsFor(record, size, materializationKey);
    return Object.freeze({
      sourceKind: "motif",
      motifVersion,
      candidateId: `${record.id}:${size}`,
      motifId: record.id,
      tokenId: `graphic:${record.graphicType}:${size}`,
      materializationOrdinal,
      materializationKey,
      intrinsicBounds: Object.freeze({ ...record.intrinsicBySize[size] }),
      renderParams,
      renderParamsHash: hashCanonical(renderParams),
      occupancySafetyFactor: record.occupancySafetyFactor,
      occupancyCalibrationRevision: record.occupancyCalibrationRevision
    });
  })));
}

export function createMotifCandidateValidator({
  registry = motifRegistry,
  motifVersion = MOTIF_REGISTRY_VERSION
} = {}) {
  const registryById = new Map(registry.map(record => [record.id, record]));
  const expectedByCandidateId = new Map(materializeMotifCandidates({ registry, motifVersion })
    .map(candidate => [candidate.candidateId, candidate]));
  return function validateCandidate(candidate) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new TypeError("motif candidate must be an object");
    }
    const candidateKeys = [
      "sourceKind", "motifVersion", "candidateId", "motifId", "tokenId", "materializationOrdinal",
      "materializationKey", "intrinsicBounds", "renderParams", "renderParamsHash",
      "occupancySafetyFactor", "occupancyCalibrationRevision"
    ];
    const actualKeys = Object.keys(candidate).sort();
    if (canonicalJson(actualKeys) !== canonicalJson([...candidateKeys].sort())) {
      throw new Error("motif candidate schema mismatch");
    }
    const {
      motifId,
      renderParams,
      renderParamsHash,
      occupancySafetyFactor,
      occupancyCalibrationRevision
    } = candidate;
    if (candidate.motifVersion !== motifVersion) throw new Error("motif version mismatch");
    const record = registryById.get(motifId);
    if (!record) throw new Error(`unknown motif ${motifId}`);
    if (renderParams?.graphicType !== record.graphicType || !record.intrinsicBySize[renderParams?.size]) {
      throw new Error(`invalid render params for ${motifId}`);
    }
    const renderParamKeys = PATTERN_TYPES.has(record.graphicType)
      ? ["graphicType", "size", "stroke", "seedBits"]
      : {
          barcode: ["graphicType", "size", "stroke", "value", "barPattern"],
          "pseudo-qr": ["graphicType", "size", "stroke", "moduleCount", "payloadBits"],
          table: ["graphicType", "size", "stroke", "columns", "rows", "densityKey"],
          wave: ["graphicType", "size", "stroke", "pointCount", "amplitudeKey"]
        }[record.graphicType];
    if (!renderParamKeys) throw new Error(`unsupported motif graphic type ${record.graphicType}`);
    if (canonicalJson(Object.keys(renderParams).sort()) !== canonicalJson([...renderParamKeys].sort())) {
      throw new Error(`motif render params schema mismatch for ${motifId}`);
    }
    if (renderParams.stroke !== ACTIVE_STROKE_WEIGHTS[0]) throw new Error("motif stroke mismatch");
    if (hashCanonical(renderParams) !== renderParamsHash) throw new Error("motif render params hash mismatch");
    if (occupancySafetyFactor !== record.occupancySafetyFactor) throw new Error("motif occupancy factor mismatch");
    if (occupancyCalibrationRevision !== record.occupancyCalibrationRevision) {
      throw new Error("motif calibration revision mismatch");
    }
    const expected = expectedByCandidateId.get(candidate.candidateId);
    if (!expected || canonicalJson(candidate) !== canonicalJson(expected)) {
      throw new Error("motif candidate identity differs from active registry materialization");
    }
    return true;
  };
}

const validateActiveMotifCandidate = createMotifCandidateValidator();

export function validateMotifRenderParams(candidate) {
  return validateActiveMotifCandidate(candidate);
}
