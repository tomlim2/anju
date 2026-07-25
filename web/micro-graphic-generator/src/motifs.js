import { canonicalJson, hashCanonical } from "./canonical-hash.js";
import { ACTIVE_STROKE_WEIGHTS } from "./config.js";

export const MOTIF_REGISTRY_VERSION = 1;

export const motifCalibration = Object.freeze({
  "motif.barcode": Object.freeze({
    p95Coverage: 0.151690943,
    factor: 1.2,
    reviewerIds: Object.freeze(["typography-01", "product-01"])
  }),
  "motif.pseudo-qr": Object.freeze({
    p95Coverage: 0.508943146,
    factor: 1.35,
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
    id: "motif.pseudo-qr",
    graphicType: "pseudo-qr",
    role: "pseudo-qr",
    motifTags: ["machine-readable-mark"],
    occupancySafetyFactor: 1.35,
    intrinsicBySize: { medium: { width: 48, height: 48 }, large: { width: 72, height: 72 } }
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
  })
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
  return Object.freeze({ ...shared, pointCount: 12, amplitudeKey: deterministicBits(materializationKey, 24) });
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
    const renderParamKeys = {
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
