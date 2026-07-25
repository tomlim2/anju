import { hashCanonical, sha256Hex } from "../../src/canonical-hash.js";
import { svgStructuralFingerprint } from "../../src/svg-structural.js";

const displayUrl = "../fixtures/blind-evaluation-display.v1.json";
const qualificationUrl = "../fixtures/reviewer-qualifications.v1.json";
const sides = Object.freeze(["left", "right"]);
const baseRatings = Object.freeze([
  ["heroClarity", "Hero clarity"],
  ["semanticPlausibility", "Semantic plausibility"],
  ["legibility", "Legibility"],
  ["visualInterest", "Visual interest"]
]);
const ratingAnchors = Object.freeze({
  1: "Intent is nearly impossible to understand or use",
  2: "Major problems make it unacceptable without revision",
  3: "Intent is communicated and minimally acceptable",
  4: "Clear and stable with only minor improvement needed",
  5: "Exceptionally clear, intentional, and complete"
});
const ui = {
  previous: document.querySelector("#previous"),
  next: document.querySelector("#next"),
  fixtureIndex: document.querySelector("#fixtureIndex"),
  reviewer: document.querySelector("#reviewer"),
  status: document.querySelector("#status"),
  reviewSurface: document.querySelector("#reviewSurface"),
  notes: document.querySelector("#notes"),
  submit: document.querySelector("#submit"),
  artifacts: {
    left: document.querySelector("#leftArtifact"),
    right: document.querySelector("#rightArtifact")
  }
};
let display;
let qualificationSet;
let fixtureIndex = 0;
let firstReadBySide = { left: null, right: null };
let artifactLoadToken = 0;
let artifactsReady = false;
let activeArtifactUrls = [];

function artifactUrl(descriptor) {
  return new URL(`/${descriptor.path}`, window.location.origin).href;
}

function digestBytes(bytes) {
  return `sha256:${sha256Hex(bytes)}`;
}

function verifyDescriptorBytes(descriptor, bytes, label) {
  if (bytes.byteLength !== descriptor.byteLength) throw new Error(`${label} byte length mismatch`);
  if (digestBytes(bytes) !== descriptor.sha256) throw new Error(`${label} digest mismatch`);
}

function selectedRadio(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || null;
}

function resetForm() {
  document.querySelectorAll('input[type="radio"]').forEach(input => { input.checked = false; });
  ui.notes.value = "";
  firstReadBySide = { left: null, right: null };
  sides.forEach(side => {
    document.querySelector(`[data-first-read="${side}"]`).textContent = "No node selected";
  });
}

function ratingRow(side, key, label) {
  const row = document.createElement("div");
  row.className = "rating-row";
  const title = document.createElement("span");
  title.textContent = label;
  row.appendChild(title);
  for (let score = 1; score <= 5; score += 1) {
    const scoreLabel = document.createElement("label");
    scoreLabel.title = `${score}: ${ratingAnchors[score]}`;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = `${side}.${key}`;
    input.value = String(score);
    input.setAttribute("aria-label", `${label}, ${score} of 5: ${ratingAnchors[score]}`);
    scoreLabel.appendChild(input);
    row.appendChild(scoreLabel);
  }
  return row;
}

function renderRatingRows(fixture) {
  sides.forEach(side => {
    const target = document.querySelector(`[data-ratings="${side}"]`);
    target.replaceChildren();
    baseRatings.forEach(([key, label]) => target.appendChild(ratingRow(side, key, label)));
    fixture.evaluatedLanguages.forEach(language => {
      target.appendChild(ratingRow(side, `lexicalNaturalnessByLanguage.${language}`, `Lexical naturalness / ${language}`));
    });
    if (fixture.evaluatedLanguages.length > 1) {
      target.appendChild(ratingRow(side, "multilingualNaturalness", "Multilingual naturalness"));
    }
  });
}

function ordinalPathForNode(root, node) {
  const indices = [];
  let current = node;
  while (current && current !== root) {
    const parent = current.parentElement;
    if (!parent) throw new Error("Selected node is outside artifact root");
    indices.push([...parent.children].indexOf(current));
    current = parent;
  }
  if (current !== root) throw new Error("Selected node path has no artifact root");
  return `0.${indices.reverse().join(".")}`;
}

function assertSanitizedReviewSvg(root, descriptor, label) {
  if (root.localName !== "svg") throw new Error(`${label} has no SVG root`);
  const components = [...root.querySelectorAll('svg[data-review-component="true"]')];
  if (components.length !== 1) throw new Error(`${label} review component mismatch`);
  const allowedDataAttributes = new Set([
    "data-review-component", "data-message-slot", "data-lexical-use", "data-visible-text"
  ]);
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      if (attribute.name.startsWith("data-") && !allowedDataAttributes.has(attribute.name)) {
        throw new Error(`${label} exposes non-review metadata`);
      }
    }
  }
  const lexicalNodes = [...root.querySelectorAll("[data-message-slot][data-lexical-use]")];
  if (lexicalNodes.length === 0 || lexicalNodes.some(node =>
    !/^review-node-\d{3}$/.test(node.getAttribute("data-message-slot") || "")
    || !/^review-lexical-\d{3}$/.test(node.getAttribute("data-lexical-use") || "")
  )) throw new Error(`${label} has a non-opaque lexical identity`);
  const fingerprint = svgStructuralFingerprint(components[0]);
  if (fingerprint !== descriptor.fingerprint) throw new Error(`${label} structural fingerprint mismatch`);
}

async function verifiedArtifact(side, fixture, token) {
  const [svgResponse, pngResponse] = await Promise.all([
    fetch(artifactUrl(fixture[side].svg), { cache: "no-store" }),
    fetch(artifactUrl(fixture[side].png), { cache: "no-store" })
  ]);
  if (!svgResponse.ok || !pngResponse.ok) throw new Error(`${side} frozen artifact unavailable`);
  const [svgBuffer, pngBuffer] = await Promise.all([svgResponse.arrayBuffer(), pngResponse.arrayBuffer()]);
  if (token !== artifactLoadToken) throw new Error("Superseded artifact load");
  const svgBytes = new Uint8Array(svgBuffer);
  const pngBytes = new Uint8Array(pngBuffer);
  verifyDescriptorBytes(fixture[side].svg, svgBytes, `${side} SVG`);
  verifyDescriptorBytes(fixture[side].png, pngBytes, `${side} PNG`);
  const svgText = new TextDecoder("utf-8", { fatal: true }).decode(svgBytes);
  const documentNode = new DOMParser().parseFromString(svgText, "image/svg+xml");
  if (documentNode.querySelector("parsererror")) throw new Error(`${side} SVG parse failure`);
  assertSanitizedReviewSvg(documentNode.documentElement, {
    fingerprint: fixture[side].fingerprint
  }, `${side} SVG`);
  return URL.createObjectURL(new Blob([svgBytes], { type: "image/svg+xml" }));
}

function mountVerifiedArtifact(side, fixture, url, token) {
  const previous = ui.artifacts[side];
  const object = document.createElement("object");
  object.id = `${side}Artifact`;
  object.className = "artifact-frame";
  object.type = "image/svg+xml";
  object.setAttribute("aria-label", `${side === "left" ? "Left" : "Right"} composition`);
  return new Promise((resolve, reject) => {
    object.onload = () => {
      if (token !== artifactLoadToken) return reject(new Error("Superseded artifact load"));
      const documentNode = object.contentDocument;
      if (!documentNode) return reject(new Error(`${side} artifact document unavailable`));
      documentNode.documentElement.addEventListener("click", event => {
        if (!artifactsReady || token !== artifactLoadToken) return;
        const node = event.target.closest?.("[data-message-slot][data-lexical-use]");
        if (!node) return;
        const slotInstanceId = node.getAttribute("data-message-slot");
        const lexicalUseId = node.getAttribute("data-lexical-use");
        const rootToNodeOrdinalPath = ordinalPathForNode(documentNode.documentElement, node);
        const artifactSha256 = fixture[side].svg.sha256;
        firstReadBySide[side] = {
          slotInstanceId,
          lexicalUseId,
          nodeFingerprint: hashCanonical({
            artifactSha256,
            rootToNodeOrdinalPath,
            slotInstanceId,
            lexicalUseId
          }),
          visibleText: (node.getAttribute("data-visible-text") || node.textContent || "").trim()
        };
        document.querySelector(`[data-first-read="${side}"]`).textContent = firstReadBySide[side].visibleText;
      });
      resolve();
    };
    object.onerror = () => reject(new Error(`${side} artifact display failed`));
    object.data = url;
    previous.replaceWith(object);
    ui.artifacts[side] = object;
  });
}

function clearArtifact(side) {
  const previous = ui.artifacts[side];
  const placeholder = document.createElement("div");
  placeholder.id = `${side}Artifact`;
  placeholder.className = "artifact-frame";
  placeholder.setAttribute("aria-label", `${side === "left" ? "Left" : "Right"} composition`);
  previous.replaceWith(placeholder);
  ui.artifacts[side] = placeholder;
}

function qualifiedReviewers(fixture, notAfter = new Date().toISOString()) {
  const cutoff = Date.parse(notAfter);
  if (
    !Number.isFinite(cutoff)
    || !Number.isFinite(Date.parse(qualificationSet.verifiedAt))
    || Date.parse(qualificationSet.verifiedAt) > cutoff
  ) return [];
  return qualificationSet.reviewers.filter(reviewer => {
    return fixture.evaluatedLanguages.every(language => reviewer.qualifications.some(qualification =>
      qualification.language === language
      && Number.isFinite(Date.parse(qualification.verifiedAt))
      && Date.parse(qualification.verifiedAt) <= cutoff
    ));
  });
}

function renderReviewerOptions(fixture) {
  const previous = ui.reviewer.value;
  const reviewers = qualifiedReviewers(fixture);
  ui.reviewer.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = reviewers.length ? "Select reviewer" : "No qualified reviewer";
  ui.reviewer.appendChild(placeholder);
  reviewers.forEach(reviewer => {
    const option = document.createElement("option");
    option.value = reviewer.reviewerId;
    option.textContent = reviewer.reviewerId;
    ui.reviewer.appendChild(option);
  });
  if (reviewers.some(reviewer => reviewer.reviewerId === previous)) ui.reviewer.value = previous;
  ui.submit.disabled = true;
}

function setReviewControlsEnabled(enabled) {
  document.querySelectorAll("#reviewSurface input, #reviewSurface textarea, #reviewSurface button, #reviewer")
    .forEach(control => { control.disabled = !enabled; });
  ui.previous.disabled = !enabled || fixtureIndex === 0;
  ui.next.disabled = !enabled || fixtureIndex === display.fixtures.length - 1;
  ui.submit.disabled = !enabled || qualifiedReviewers(display.fixtures[fixtureIndex]).length === 0;
}

async function renderFixture() {
  const token = ++artifactLoadToken;
  const fixture = display.fixtures[fixtureIndex];
  artifactsReady = false;
  activeArtifactUrls.forEach(URL.revokeObjectURL);
  activeArtifactUrls = [];
  resetForm();
  renderRatingRows(fixture);
  renderReviewerOptions(fixture);
  ui.fixtureIndex.textContent = `${fixtureIndex + 1} / ${display.fixtures.length}`;
  ui.status.textContent = `Verifying ${fixture.fixtureId}`;
  setReviewControlsEnabled(false);
  try {
    const verification = await Promise.allSettled(
      sides.map(side => verifiedArtifact(side, fixture, token))
    );
    const verifiedUrls = verification
      .filter(result => result.status === "fulfilled")
      .map(result => result.value);
    const rejected = verification.find(result => result.status === "rejected");
    if (rejected) {
      verifiedUrls.forEach(URL.revokeObjectURL);
      throw rejected.reason;
    }
    const urls = verifiedUrls;
    if (token !== artifactLoadToken) {
      urls.forEach(URL.revokeObjectURL);
      return;
    }
    activeArtifactUrls = urls;
    await Promise.all(sides.map((side, index) => mountVerifiedArtifact(side, fixture, urls[index], token)));
    if (token !== artifactLoadToken) return;
    artifactsReady = true;
    setReviewControlsEnabled(true);
    ui.status.textContent = `${fixture.fixtureId} / ${fixture.evaluatedLanguages.join(", ")}`;
  } catch (error) {
    if (token !== artifactLoadToken) return;
    activeArtifactUrls.forEach(URL.revokeObjectURL);
    activeArtifactUrls = [];
    sides.forEach(clearArtifact);
    setReviewControlsEnabled(false);
    ui.status.textContent = error.message;
  }
}

function ratingsForSide(side, fixture) {
  const result = {};
  for (const [key] of baseRatings) {
    const value = selectedRadio(`${side}.${key}`);
    if (!value) throw new Error(`Missing ${side} ${key}`);
    result[key] = Number(value);
  }
  result.lexicalNaturalnessByLanguage = {};
  fixture.evaluatedLanguages.forEach(language => {
    const value = selectedRadio(`${side}.lexicalNaturalnessByLanguage.${language}`);
    if (!value) throw new Error(`Missing ${side} ${language} naturalness`);
    result.lexicalNaturalnessByLanguage[language] = Number(value);
  });
  if (fixture.evaluatedLanguages.length > 1) {
    const value = selectedRadio(`${side}.multilingualNaturalness`);
    if (!value) throw new Error(`Missing ${side} multilingual naturalness`);
    result.multilingualNaturalness = Number(value);
  }
  return result;
}

function selectedReviewer(fixture, submittedAt) {
  return qualifiedReviewers(fixture, submittedAt)
    .find(reviewer => reviewer.reviewerId === ui.reviewer.value) || null;
}

function resultForFixture() {
  const fixture = display.fixtures[fixtureIndex];
  if (!artifactsReady) throw new Error("Artifacts are not verified");
  const submittedAt = new Date().toISOString();
  const reviewer = selectedReviewer(fixture, submittedAt);
  if (!reviewer) throw new Error("Reviewer qualification is not valid at submission time");
  if (!firstReadBySide.left || !firstReadBySide.right) throw new Error("Select the first-read node on both sides");
  const firstAttentionSide = selectedRadio("firstAttentionSide");
  const preferenceSide = selectedRadio("preferenceSide");
  if (!firstAttentionSide || !preferenceSide) throw new Error("Complete both pair ratings");
  return {
    schemaVersion: 1,
    fixtureId: fixture.fixtureId,
    reviewerId: reviewer.reviewerId,
    translationErrorLedgerRevision: display.translationErrorLedgerRevision,
    qualificationSnapshot: reviewer.qualifications.filter(qualification =>
      fixture.evaluatedLanguages.includes(qualification.language)
    ),
    artifactHashes: {
      left: fixture.left.svg.sha256,
      right: fixture.right.svg.sha256
    },
    ratingsBySide: {
      left: ratingsForSide("left", fixture),
      right: ratingsForSide("right", fixture)
    },
    firstReadBySide,
    firstAttentionSide,
    preferenceSide,
    submittedAt,
    notes: ui.notes.value.trim() || null
  };
}

function downloadResult(result) {
  const blob = new Blob([`${JSON.stringify(result, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${result.fixtureId}.${result.reviewerId}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

ui.previous.addEventListener("click", () => {
  fixtureIndex = Math.max(0, fixtureIndex - 1);
  void renderFixture();
});
ui.next.addEventListener("click", () => {
  fixtureIndex = Math.min(display.fixtures.length - 1, fixtureIndex + 1);
  void renderFixture();
});
ui.submit.addEventListener("click", () => {
  try {
    downloadResult(resultForFixture());
    ui.status.textContent = "Review exported";
  } catch (error) {
    ui.status.textContent = error.message;
  }
});

try {
  [display, qualificationSet] = await Promise.all([
    fetch(displayUrl).then(response => response.ok ? response.json() : Promise.reject(new Error("Display manifest unavailable"))),
    fetch(qualificationUrl).then(response => response.ok ? response.json() : Promise.reject(new Error("Qualification set unavailable")))
  ]);
  if (!Array.isArray(display.fixtures) || display.fixtures.length === 0) throw new Error("No frozen fixtures");
  if (!Array.isArray(qualificationSet.reviewers)) throw new Error("Invalid qualification set");
  ui.reviewSurface.hidden = false;
  await renderFixture();
} catch (error) {
  ui.status.textContent = error.message;
}
