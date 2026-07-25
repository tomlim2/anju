import { EXPORT_SCALE, FONT_CSS_PATH, SVG_NS } from "./config.js";
import { artifactByteDigest, svgStructuralFingerprint } from "./svg.js";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function createArtworkExporter({
  art,
  getViewport,
  cssVariable,
  filenameSlug,
  getExportState = () => ({ exportEligible: true })
}) {
  function assertExportEligible(state) {
    if (!state?.exportEligible) throw new Error("No accepted composition is available for export");
  }

  function captureExportSnapshot() {
    const exportState = Object.freeze({ ...getExportState() });
    assertExportEligible(exportState);
    const viewport = Object.freeze({ ...getViewport() });
    const background = cssVariable("--bg");
    const ink = cssVariable("--ink");
    const filename = `micro-graphic-${filenameSlug()}`;
    const clone = art.cloneNode(true);
    const sourceComponent = art.querySelector("svg[data-component]") || art;
    const cloneComponent = clone.querySelector("svg[data-component]") || clone;
    const sourcePlanId = sourceComponent.getAttribute?.("data-plan-id") || null;
    if (exportState.planId !== undefined && exportState.planId !== sourcePlanId) {
      throw new Error("Export target identity differs from the accepted display state");
    }
    clone.setAttribute("xmlns", SVG_NS);
    clone.setAttribute("width", String(viewport.width));
    clone.setAttribute("height", String(viewport.height));
    clone.style.background = background;
    clone.style.setProperty("--bg", background);
    clone.style.setProperty("--ink", ink);
    const style = document.createElementNS(SVG_NS, "style");
    style.textContent = `
        @import url("${new URL(FONT_CSS_PATH, window.location.href).href}");
        svg { color: var(--ink); }
      `;
    clone.insertBefore(style, clone.firstChild);
    const text = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
    return Object.freeze({
      text,
      viewport,
      background,
      ink,
      filename,
      planId: sourcePlanId,
      byteDigest: artifactByteDigest(text),
      structuralFingerprint: svgStructuralFingerprint(cloneComponent)
    });
  }

  function svgText() {
    return captureExportSnapshot().text;
  }

  async function exportPng() {
    const snapshot = captureExportSnapshot();
    const blob = new Blob([snapshot.text], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    let canvas;
    try {
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      await image.decode();
      canvas = document.createElement("canvas");
      canvas.width = snapshot.viewport.width * EXPORT_SCALE;
      canvas.height = snapshot.viewport.height * EXPORT_SCALE;
      const context = canvas.getContext("2d");
      context.fillStyle = snapshot.background;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    } finally {
      URL.revokeObjectURL(url);
    }
    const pngBlob = await new Promise((resolve, reject) => canvas.toBlob(
      blobValue => blobValue ? resolve(blobValue) : reject(new Error("PNG encoding failed")),
      "image/png"
    ));
    downloadBlob(pngBlob, `${snapshot.filename}.png`);
    return Object.freeze({
      byteDigest: artifactByteDigest(new Uint8Array(await pngBlob.arrayBuffer())),
      size: pngBlob.size,
      mimeType: pngBlob.type,
      planId: snapshot.planId,
      filename: `${snapshot.filename}.png`
    });
  }

  function exportSvg() {
    const artifact = svgArtifact();
    downloadBlob(new Blob([artifact.text], { type: "image/svg+xml;charset=utf-8" }), artifact.filename);
    return artifact;
  }

  function svgArtifact() {
    const snapshot = captureExportSnapshot();
    return Object.freeze({
      text: snapshot.text,
      byteDigest: snapshot.byteDigest,
      structuralFingerprint: snapshot.structuralFingerprint,
      mimeType: "image/svg+xml;charset=utf-8",
      planId: snapshot.planId,
      filename: `${snapshot.filename}.svg`
    });
  }

  return { exportPng, exportSvg, svgText, svgArtifact };
}
