import { EXPORT_SCALE, FONT_CSS_PATH, SVG_NS } from "./config.js";

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

export function createArtworkExporter({ art, getViewport, cssVariable, filenameSlug }) {
  function svgText() {
    const viewport = getViewport();
    const clone = art.cloneNode(true);
    clone.setAttribute("xmlns", SVG_NS);
    clone.setAttribute("width", String(viewport.width));
    clone.setAttribute("height", String(viewport.height));
    clone.style.background = cssVariable("--bg");
    const style = document.createElementNS(SVG_NS, "style");
    style.textContent = `
        @import url("${new URL(FONT_CSS_PATH, window.location.href).href}");
        svg { color: ${cssVariable("--ink")}; }
        text { dominant-baseline: auto; }
      `;
    clone.insertBefore(style, clone.firstChild);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
  }

  async function exportPng() {
    const viewport = getViewport();
    const source = svgText();
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width * EXPORT_SCALE;
    canvas.height = viewport.height * EXPORT_SCALE;
    const context = canvas.getContext("2d");
    context.fillStyle = cssVariable("--bg");
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(
      pngBlob => downloadBlob(pngBlob, `micro-graphic-${filenameSlug()}.png`),
      "image/png"
    );
  }

  function exportSvg() {
    downloadBlob(
      new Blob([svgText()], { type: "image/svg+xml;charset=utf-8" }),
      `micro-graphic-${filenameSlug()}.svg`
    );
  }

  return { exportPng, exportSvg, svgText };
}
