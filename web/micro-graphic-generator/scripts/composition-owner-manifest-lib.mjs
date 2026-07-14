import {
  existsSync,
  readFileSync,
  readdirSync
} from "node:fs";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import { canonicalJson, hashCanonical, sha256Hex } from "../src/canonical-hash.js";
import { parseStaticModuleSpecifiers } from "./static-module-specifiers.mjs";

export const OWNER_MANIFEST_SCHEMA_VERSION = 1;
export const GENERATED_MANIFEST_PATH = "web/micro-graphic-generator/src/composition-owner-snapshot.js";
export const LEDGER_PATH = "web/micro-graphic-generator/tests/fixtures/composition-owner-snapshots.json";
export const PLANNING_FIXTURE_PATH = "web/micro-graphic-generator/tests/fixtures/planning-complexity.json";
export const TOOLING_ENTRYPOINTS = Object.freeze([
  "web/micro-graphic-generator/scripts/bootstrap-verify-composition-owner-snapshot.mjs",
  "web/micro-graphic-generator/scripts/emit-composition-owner-snapshot.mjs",
  "web/micro-graphic-generator/scripts/verify-composition-owner-snapshot.mjs",
  "web/micro-graphic-generator/scripts/verify-planning-complexity.mjs"
]);
export const TOOLING_AUXILIARY_ENTRYPOINTS = Object.freeze([
  "web/micro-graphic-generator/scripts/generate-planning-complexity-fixture.mjs",
  "web/micro-graphic-generator/scripts/observe-planning-production.mjs"
]);

const CSS_URL_PATTERN = /url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi;
const CANONICAL_TOOLING_EXCLUSIONS = new Set([
  "web/micro-graphic-generator/src/canonical-hash.js",
  "web/micro-graphic-generator/src/vendor/sha256.js"
]);

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function repositoryPath(root, path) {
  const result = relative(root, resolve(root, path)).split("\\").join("/");
  if (result.startsWith("../") || result === "..") throw new Error(`path escapes repository: ${path}`);
  return result;
}

function resolveLocalImport(fromPath, specifier) {
  if (!specifier.startsWith(".")) return null;
  const joined = normalize(join(dirname(fromPath), specifier)).split("\\").join("/");
  return extname(joined) ? joined : `${joined}.js`;
}

function isExternalReference(reference) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(reference);
}

function resolveLocalResource(fromPath, reference) {
  if (reference.includes("&")) throw new Error(`HTML/CSS character references are forbidden: ${reference}`);
  if (isExternalReference(reference)) throw new Error(`network resource is forbidden: ${reference}`);
  if (reference.startsWith("/")) throw new Error(`absolute resource is forbidden: ${reference}`);
  const withoutQuery = reference.split(/[?#]/, 1)[0];
  return normalize(join(dirname(fromPath), withoutQuery)).split("\\").join("/");
}

function htmlStartTags(source) {
  const tags = [];
  let index = 0;
  while (index < source.length) {
    const start = source.indexOf("<", index);
    if (start < 0) break;
    if (source.startsWith("<!--", start)) {
      const end = source.indexOf("-->", start + 4);
      if (end < 0) throw new Error("unterminated HTML comment");
      index = end + 3;
      continue;
    }
    if (/^<\s*[!/]/.test(source.slice(start))) {
      const end = source.indexOf(">", start + 1);
      if (end < 0) throw new Error("unterminated HTML declaration or closing tag");
      index = end + 1;
      continue;
    }
    const nameMatch = source.slice(start + 1).match(/^\s*([A-Za-z][\w-]*)/);
    if (!nameMatch) {
      index = start + 1;
      continue;
    }
    const tagName = nameMatch[1].toLowerCase();
    const attributesStart = start + 1 + nameMatch[0].length;
    let quote = null;
    let end = attributesStart;
    for (; end < source.length; end += 1) {
      const character = source[end];
      if (quote) {
        if (character === quote) quote = null;
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        break;
      } else if (character === "<") {
        throw new Error(`malformed HTML start tag ${tagName}`);
      }
    }
    if (end >= source.length || quote) throw new Error(`unterminated HTML start tag ${tagName}`);
    tags.push({ tagName, attributeSource: source.slice(attributesStart, end) });
    index = end + 1;
  }
  return tags;
}

function parseHtmlAttributes(source, tagName) {
  const attributes = {};
  let index = 0;
  while (index < source.length) {
    while (index < source.length && /\s/.test(source[index])) index += 1;
    if (source[index] === "/") {
      index += 1;
      while (index < source.length && /\s/.test(source[index])) index += 1;
      if (index !== source.length) throw new Error(`malformed ${tagName} self-closing marker`);
      break;
    }
    if (index >= source.length) break;
    const nameMatch = source.slice(index).match(/^([:\w-]+)/);
    if (!nameMatch) throw new Error(`malformed HTML attribute in ${tagName}`);
    const name = nameMatch[1].toLowerCase();
    if (Object.hasOwn(attributes, name)) throw new Error(`duplicate HTML attribute ${name} in ${tagName}`);
    index += nameMatch[0].length;
    while (index < source.length && /\s/.test(source[index])) index += 1;
    let value = "";
    if (source[index] === "=") {
      index += 1;
      while (index < source.length && /\s/.test(source[index])) index += 1;
      const quote = source[index];
      if (quote === '"' || quote === "'") {
        const end = source.indexOf(quote, index + 1);
        if (end < 0) throw new Error(`unterminated HTML attribute ${name} in ${tagName}`);
        value = source.slice(index + 1, end);
        index = end + 1;
      } else {
        const match = source.slice(index).match(/^[^\s"'=<>`]+/);
        if (!match) throw new Error(`missing HTML attribute value ${name} in ${tagName}`);
        value = match[0];
        index += value.length;
      }
    }
    attributes[name] = value;
  }
  return attributes;
}

export function deriveStaticModuleClosure(
  root,
  entrypoints,
  { allowExternal = true, allowNodeBuiltins = false } = {}
) {
  const pending = [...entrypoints];
  const visited = new Set();
  while (pending.length > 0) {
    const path = pending.pop();
    if (visited.has(path)) continue;
    const absolute = resolve(root, path);
    if (!existsSync(absolute)) throw new Error(`missing closure source ${path}`);
    visited.add(path);
    const source = readFileSync(absolute, "utf8");
    for (const rawSpecifier of parseStaticModuleSpecifiers(source)) {
      const dependency = resolveLocalImport(path, rawSpecifier);
      if (!dependency) {
        const allowedNodeBuiltin = allowNodeBuiltins && rawSpecifier.startsWith("node:");
        if (!allowExternal && !allowedNodeBuiltin) {
          throw new Error(`non-local runtime import in ${path}: ${rawSpecifier}`);
        }
      }
      if (dependency && !visited.has(dependency)) pending.push(dependency);
    }
  }
  return [...visited].sort(compareStrings);
}

function htmlRuntimeReferences(root, htmlPath) {
  const source = readFileSync(resolve(root, htmlPath), "utf8");
  const moduleRoots = [];
  const styleRoots = [];
  const assetRoots = [];
  for (const { tagName, attributeSource } of htmlStartTags(source)) {
    const attributes = parseHtmlAttributes(attributeSource, tagName);
    if (tagName === "style") throw new Error("inline style elements are forbidden");
    if (Object.keys(attributes).some(name => name.startsWith("on")) || Object.hasOwn(attributes, "srcdoc")) {
      throw new Error(`inline executable HTML is forbidden in ${tagName}`);
    }
    if (tagName === "meta" && attributes["http-equiv"]?.toLowerCase() === "refresh") {
      throw new Error("HTML meta refresh is forbidden");
    }
    for (const attribute of ["src", "href", "poster", "data"]) {
      if (attributes[attribute] && isExternalReference(attributes[attribute])) {
        throw new Error(`network HTML resource is forbidden: ${attributes[attribute]}`);
      }
    }
    if (attributes.srcset) {
      for (const candidate of attributes.srcset.split(",")) {
        const reference = candidate.trim().split(/\s+/, 1)[0];
        if (reference && isExternalReference(reference)) {
          throw new Error(`network HTML resource is forbidden: ${reference}`);
        }
        if (reference) assetRoots.push(resolveLocalResource(htmlPath, reference));
      }
    }
    if (attributes.style && /(?:url\s*\(|@import)/i.test(attributes.style)) {
      throw new Error(`inline HTML resource reference is forbidden in ${tagName}`);
    }
    if (tagName === "base") throw new Error("HTML base elements are forbidden");
    if (tagName === "script") {
      if (!attributes.src) throw new Error("inline runtime scripts are forbidden");
      if (attributes.type !== "module") throw new Error(`runtime script must be a module: ${attributes.src}`);
      moduleRoots.push(resolveLocalResource(htmlPath, attributes.src));
    } else if (tagName === "link" && attributes.rel?.split(/\s+/).includes("stylesheet")) {
      if (!attributes.href) throw new Error("stylesheet link is missing href");
      styleRoots.push(resolveLocalResource(htmlPath, attributes.href));
    } else {
      for (const attribute of ["src", "poster", "data"]) {
        if (attributes[attribute]) assetRoots.push(resolveLocalResource(htmlPath, attributes[attribute]));
      }
      if (tagName === "link" && attributes.href) {
        assetRoots.push(resolveLocalResource(htmlPath, attributes.href));
      }
    }
  }
  if (moduleRoots.length === 0) throw new Error("index.html has no module entrypoint");
  return { moduleRoots, styleRoots, assetRoots };
}

function deriveStyleResourceClosure(root, styleRoots) {
  const pending = [...styleRoots];
  const styleFiles = new Set();
  const assetFiles = new Set();
  while (pending.length > 0) {
    const path = pending.pop();
    if (styleFiles.has(path)) continue;
    if (!existsSync(resolve(root, path))) throw new Error(`missing stylesheet ${path}`);
    styleFiles.add(path);
    const source = readFileSync(resolve(root, path), "utf8");
    if (source.includes("\\")) throw new Error(`CSS escapes are forbidden in closure source ${path}`);
    if (/@import\b/i.test(source)) throw new Error(`CSS imports are forbidden in closure source ${path}`);
    const references = [...source.matchAll(CSS_URL_PATTERN)]
      .map(match => (match[1] ?? match[2] ?? match[3]).trim());
    const unmatchedUrlSyntax = source.replace(CSS_URL_PATTERN, "");
    if (/\burl\s*\(/i.test(unmatchedUrlSyntax)) {
      throw new Error(`unsupported CSS url syntax in ${path}`);
    }
    for (const reference of references) {
      const dependency = resolveLocalResource(path, reference);
      if (!existsSync(resolve(root, dependency))) throw new Error(`missing CSS resource ${dependency}`);
      if (extname(dependency).toLowerCase() === ".css") pending.push(dependency);
      else assetFiles.add(dependency);
    }
  }
  return {
    styleFiles: [...styleFiles].sort(compareStrings),
    assetFiles: [...assetFiles].sort(compareStrings)
  };
}

export function deriveRuntimeResourceClosure(root, htmlPath = "web/micro-graphic-generator/index.html") {
  const { moduleRoots, styleRoots, assetRoots } = htmlRuntimeReferences(root, htmlPath);
  const moduleFiles = deriveStaticModuleClosure(root, moduleRoots, { allowExternal: false });
  const styles = deriveStyleResourceClosure(root, styleRoots);
  assetRoots.forEach(path => {
    if (!existsSync(resolve(root, path))) throw new Error(`missing HTML resource ${path}`);
  });
  const assetFiles = [...new Set([...styles.assetFiles, ...assetRoots])].sort(compareStrings);
  return Object.freeze({
    htmlPath,
    moduleRoots: Object.freeze([...moduleRoots].sort(compareStrings)),
    moduleFiles: Object.freeze(moduleFiles),
    styleFiles: Object.freeze(styles.styleFiles),
    assetFiles: Object.freeze(assetFiles),
    allFiles: Object.freeze([
      htmlPath,
      ...moduleFiles,
      ...styles.styleFiles,
      ...assetFiles
    ].sort(compareStrings))
  });
}

function rawByteHash(root, path) {
  return sha256Hex(readFileSync(resolve(root, repositoryPath(root, path))));
}

function hashRows(root, paths) {
  return [...paths].sort(compareStrings).map(path => Object.freeze({
    path,
    sha256Hex: rawByteHash(root, path)
  }));
}

function parseVersion(root, path, exportName) {
  const source = readFileSync(resolve(root, path), "utf8");
  const match = source.match(new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*(\\d+)`));
  if (!match) throw new Error(`cannot read ${exportName} from ${path}`);
  return Number(match[1]);
}

function listFilesRecursively(root, relativeDirectory) {
  const directory = resolve(root, relativeDirectory);
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...listFilesRecursively(root, path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort(compareStrings);
}

function assertPartition(entries) {
  const ownership = new Map();
  for (const entry of entries) {
    for (const path of [...entry.sourceFiles, ...entry.dataFiles, ...entry.assetFiles]) {
      if (ownership.has(path)) {
        throw new Error(`owner path collision: ${path} (${ownership.get(path)} / ${entry.ownerId})`);
      }
      ownership.set(path, entry.ownerId);
    }
  }
}

function semanticPayload(ownerId, context) {
  const payloads = {
    vocabulary: {
      contractRevision: 1,
      recordOwner: "lexicalUses/translationSets/translationErrorLedger",
      fixture: "composition-vocabulary.json"
    },
    recipes: {
      contractRevision: 1,
      activeRecipeIds: ["command", "status"],
      relationModes: ["directed", "avoid", "prefer", "required"]
    },
    motifs: {
      contractRevision: 1,
      activeMotifIds: ["motif.barcode", "motif.pseudo-qr", "motif.table", "motif.wave"],
      calibrationRequired: true
    },
    config: {
      contractRevision: 1,
      nodeRuntime: "v22.12.0",
      browserProfile: "playwright-1.61.1/chromium-http",
      physicalGrid: "3x3"
    },
    "canonical-hash": {
      contractRevision: 1,
      algorithm: "RFC8785-restricted/SHA-256",
      vendoredRevision: "81983c2fffac48aa69dabc260b4192ad597d2734"
    },
    "candidate-materializer": {
      contractRevision: 1,
      identityOrder: ["family", "ordinal", "materializationKey", "instanceKey", "candidateId"]
    },
    layout: {
      contractRevision: 1,
      canonicalLayoutCounts: { 2: 8, 3: 6, 4: 16, 5: 20 },
      scalePolicy: "intrinsic-no-scale"
    },
    "composition-validator": {
      contractRevision: 1,
      planSchemaVersion: 3,
      plannerResultSchemaVersion: 1,
      planningCounters: 4
    },
    planner: {
      contractRevision: 1,
      recipeArbitration: "keyed-rotation-first-viable",
      queueTiers: ["same-tuple-layout", "approved-alternate", "other-replan"]
    },
    "plan-to-export-runtime": {
      contractRevision: 1,
      runtimeRoots: context.runtimeRoots,
      selfExcludedPath: GENERATED_MANIFEST_PATH
    },
    "manifest-tooling": {
      contractRevision: 2,
      entrypoints: TOOLING_ENTRYPOINTS,
      auxiliaryEntrypoints: TOOLING_AUXILIARY_ENTRYPOINTS,
      bootstrapPolicy: "base-ref-before-candidate",
      ownershipClosure: "script-remainder",
      trustClosure: "all-static-local-dependencies"
    },
    "typography-metrics": {
      contractRevision: 1,
      fontWeights: [400, 700, 900],
      lineHeight: 1
    },
    "font-assets": {
      contractRevision: 1,
      familyAssetByteHashes: context.fontBinaryHashes
    },
  };
  return payloads[ownerId];
}

function makeEntry(root, definition, versionTuple, context) {
  const versionValue = versionTuple[definition.versionField];
  const sourceByteHashes = hashRows(root, definition.sourceFiles);
  const dataByteHashes = hashRows(root, definition.dataFiles);
  const assetByteHashes = hashRows(root, definition.assetFiles);
  const contentRevision = hashCanonical({
    ownerId: definition.ownerId,
    versionField: definition.versionField,
    versionValue,
    semanticPayload: semanticPayload(definition.ownerId, context),
    sourceByteHashes,
    dataByteHashes,
    assetByteHashes
  });
  return Object.freeze({
    ownerId: definition.ownerId,
    versionField: definition.versionField,
    versionValue,
    sourceFiles: Object.freeze([...definition.sourceFiles].sort(compareStrings)),
    dataFiles: Object.freeze([...definition.dataFiles].sort(compareStrings)),
    assetFiles: Object.freeze([...definition.assetFiles].sort(compareStrings)),
    contentRevision
  });
}

function deriveCompleteToolingClosure(root) {
  return deriveStaticModuleClosure(root, [
    ...TOOLING_ENTRYPOINTS,
    ...TOOLING_AUXILIARY_ENTRYPOINTS
  ], { allowExternal: false, allowNodeBuiltins: true });
}

export function deriveToolingSourceHashes(root) {
  const closure = deriveCompleteToolingClosure(root);
  const ownedClosure = closure.filter(path =>
    path.startsWith("web/micro-graphic-generator/scripts/")
  );
  return Object.freeze(hashRows(root, ownedClosure));
}

export function deriveToolingTrustClosureHashes(root) {
  return deriveToolingSourceHashes(root);
}

export function buildOwnerSnapshotManifest({
  repoRoot,
  compositionEngineVersion,
  planningComplexity
}) {
  const root = resolve(repoRoot);
  if (!Number.isInteger(compositionEngineVersion) || compositionEngineVersion < 1) {
    throw new Error("compositionEngineVersion must be a positive integer");
  }
  const fontFiles = listFilesRecursively(root, "web/micro-graphic-generator/fonts");
  const fontBinaryFiles = fontFiles.filter(path => [".ttf", ".woff2"].includes(extname(path)));
  const fontDataFiles = fontFiles.filter(path => path.endsWith("fonts.css"));
  const fontLicenseFiles = fontFiles.filter(path => path.endsWith(".txt"));
  const fontBinaryHashes = hashRows(root, fontBinaryFiles);
  const fontAssetRevision = hashCanonical(fontBinaryHashes);
  const versionTuple = Object.freeze({
    vocabularyVersion: parseVersion(root, "web/micro-graphic-generator/src/vocabulary.js", "VOCABULARY_VERSION"),
    recipeVersion: parseVersion(root, "web/micro-graphic-generator/src/composition-recipes.js", "RECIPE_REGISTRY_VERSION"),
    motifVersion: parseVersion(root, "web/micro-graphic-generator/src/motifs.js", "MOTIF_REGISTRY_VERSION"),
    configVersion: parseVersion(root, "web/micro-graphic-generator/src/config.js", "COMPOSITION_POLICY_VERSION"),
    compositionEngineVersion,
    fontMetricsVersion: parseVersion(root, "web/micro-graphic-generator/src/typography-metrics.js", "FONT_METRICS_VERSION"),
    fontAssetRevision
  });

  const runtimeResources = deriveRuntimeResourceClosure(root);
  const runtimeRoots = runtimeResources.moduleRoots;
  const runtimeClosure = runtimeResources.moduleFiles;
  const definitions = [
    {
      ownerId: "vocabulary",
      versionField: "vocabularyVersion",
      sourceFiles: ["web/micro-graphic-generator/src/vocabulary.js"],
      dataFiles: ["web/micro-graphic-generator/tests/fixtures/composition-vocabulary.json"],
      assetFiles: []
    },
    {
      ownerId: "recipes",
      versionField: "recipeVersion",
      sourceFiles: ["web/micro-graphic-generator/src/composition-recipes.js"],
      dataFiles: [],
      assetFiles: []
    },
    {
      ownerId: "motifs",
      versionField: "motifVersion",
      sourceFiles: [
        "web/micro-graphic-generator/src/motifs.js",
        "web/micro-graphic-generator/scripts/generate-motif-calibration.mjs"
      ],
      dataFiles: ["web/micro-graphic-generator/tests/fixtures/motif-occupancy-calibration.json"],
      assetFiles: []
    },
    {
      ownerId: "config",
      versionField: "configVersion",
      sourceFiles: ["web/micro-graphic-generator/src/config.js"],
      dataFiles: [".github/workflows/micro-graphic-generator.yml", ".node-version", "package.json", "package-lock.json"],
      assetFiles: []
    },
    {
      ownerId: "canonical-hash",
      versionField: "compositionEngineVersion",
      sourceFiles: [
        "web/micro-graphic-generator/src/canonical-hash.js",
        "web/micro-graphic-generator/src/vendor/sha256.js"
      ],
      dataFiles: [
        "web/micro-graphic-generator/src/vendor/sha256.LICENSE.txt",
        "web/micro-graphic-generator/tests/fixtures/canonical-hash-vectors.json"
      ],
      assetFiles: []
    },
    {
      ownerId: "candidate-materializer",
      versionField: "compositionEngineVersion",
      sourceFiles: ["web/micro-graphic-generator/src/token-library.js"],
      dataFiles: [],
      assetFiles: []
    },
    {
      ownerId: "layout",
      versionField: "compositionEngineVersion",
      sourceFiles: [
        "web/micro-graphic-generator/src/grid-layout.js",
        "web/micro-graphic-generator/src/layout.js"
      ],
      dataFiles: [],
      assetFiles: []
    },
    {
      ownerId: "composition-validator",
      versionField: "compositionEngineVersion",
      sourceFiles: [
        "web/micro-graphic-generator/src/composition-model.js",
        "web/micro-graphic-generator/src/composition-plan-validator.js"
      ],
      dataFiles: [],
      assetFiles: []
    },
    {
      ownerId: "planner",
      versionField: "compositionEngineVersion",
      sourceFiles: [
        "web/micro-graphic-generator/src/composition-planner.js",
        "web/micro-graphic-generator/src/random.js"
      ],
      dataFiles: [],
      assetFiles: []
    },
    {
      ownerId: "typography-metrics",
      versionField: "fontMetricsVersion",
      sourceFiles: [
        "web/micro-graphic-generator/src/typography-metrics-data.js",
        "web/micro-graphic-generator/src/typography-metrics.js"
      ],
      dataFiles: ["web/micro-graphic-generator/tests/fixtures/typography-metrics.json"],
      assetFiles: []
    },
    {
      ownerId: "font-assets",
      versionField: "fontAssetRevision",
      sourceFiles: [],
      dataFiles: fontDataFiles,
      assetFiles: [...fontBinaryFiles, ...fontLicenseFiles].sort(compareStrings)
    },
    {
      ownerId: "manifest-tooling",
      versionField: "compositionEngineVersion",
      sourceFiles: deriveToolingSourceHashes(root).map(entry => entry.path),
      dataFiles: [PLANNING_FIXTURE_PATH],
      assetFiles: []
    }
  ];
  const upstreamSources = new Set(definitions.flatMap(definition => definition.sourceFiles));
  const runtimeRemainder = runtimeClosure.filter(path =>
    path !== GENERATED_MANIFEST_PATH && !upstreamSources.has(path)
  );
  definitions.push({
    ownerId: "plan-to-export-runtime",
    versionField: "compositionEngineVersion",
    sourceFiles: runtimeRemainder,
    dataFiles: [runtimeResources.htmlPath, ...runtimeResources.styleFiles.filter(path => !fontDataFiles.includes(path))],
    assetFiles: []
  });
  definitions.sort((left, right) => compareStrings(left.ownerId, right.ownerId));

  for (const definition of definitions) {
    for (const path of [...definition.sourceFiles, ...definition.dataFiles, ...definition.assetFiles]) {
      if (!existsSync(resolve(root, path))) throw new Error(`owner path does not exist: ${path}`);
    }
  }
  const context = { runtimeRoots, fontBinaryHashes };
  const entries = definitions.map(definition => makeEntry(root, definition, versionTuple, context));
  assertPartition(entries);
  const runtimeOwnership = new Map(entries.flatMap(entry => [
    ...entry.sourceFiles,
    ...entry.dataFiles,
    ...entry.assetFiles
  ].map(path => [path, entry.ownerId])));
  for (const path of runtimeResources.allFiles.filter(path => path !== GENERATED_MANIFEST_PATH)) {
    if (!runtimeOwnership.has(path)) throw new Error(`runtime closure path has no owner: ${path}`);
  }
  const manifestPayload = {
    schemaVersion: OWNER_MANIFEST_SCHEMA_VERSION,
    versionTuple,
    entries,
    planningComplexityCertificates: planningComplexity.certificates
  };
  return Object.freeze({
    ...manifestPayload,
    ownerSnapshotRevision: hashCanonical(manifestPayload)
  });
}

export function renderOwnerSnapshotModule(manifest) {
  const manifestLiteral = canonicalJson(manifest);
  return `// Generated by emit-composition-owner-snapshot.mjs. Do not edit manually.
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const COMPOSITION_ENGINE_VERSION = ${manifest.versionTuple.compositionEngineVersion};
export const FONT_ASSET_REVISION = "${manifest.versionTuple.fontAssetRevision}";
export const OWNER_SNAPSHOT_MANIFEST = deepFreeze(${manifestLiteral});
export const OWNER_SNAPSHOT_REVISION = OWNER_SNAPSHOT_MANIFEST.ownerSnapshotRevision;
`;
}

export function parseGeneratedEngineVersion(root) {
  const source = readFileSync(resolve(root, GENERATED_MANIFEST_PATH), "utf8");
  const match = source.match(/export const COMPOSITION_ENGINE_VERSION = (\d+);/);
  if (!match) throw new Error("generated owner module is missing engine version");
  return Number(match[1]);
}
