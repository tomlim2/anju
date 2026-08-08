import { TYPOGRAPHY_INTRINSIC_FONT_SIZES } from "./config.js";
import { alignedTextX, clamp, marginSize, normalizeTokenAlign } from "./layout.js";
import { line, make, polyline, rect, textNode } from "./svg.js";
import {
  normalizeDesignTokenSize,
  strokeTokenAttrs,
  tokenSizeAttrs,
  tokenTaxonomyAttrs
} from "./token-model.js";
import { estimateTextWidth } from "./typography.js";
import { createRecordingRandomSource } from "./random.js";

export function upcChecksum(digits) {
  const sum = digits.split("").reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1),
    0
  );
  return String((10 - (sum % 10)) % 10);
}

export function upcPattern(digits) {
  const left = [
    "0001101", "0011001", "0010011", "0111101", "0100011",
    "0110001", "0101111", "0111011", "0110111", "0001011"
  ];
  const right = [
    "1110010", "1100110", "1101100", "1000010", "1011100",
    "1001110", "1010000", "1000100", "1001000", "1110100"
  ];
  const value = `${digits}${upcChecksum(digits)}`;
  const leftDigits = value.slice(0, 6);
  const rightDigits = value.slice(6, 12);
  const leftPattern = [...leftDigits].map(digit => left[Number(digit)]).join("");
  const rightPattern = [...rightDigits].map(digit => right[Number(digit)]).join("");
  return { value, pattern: `101${leftPattern}01010${rightPattern}101` };
}

export function recordGraphicRandomValues(item, randomSource) {
  const recording = createRecordingRandomSource(randomSource);
  const { range, integer, pick, chance } = recording;

  if (item.graphicType === "barcode") {
    const digits = Array.from({ length: 11 }, () => String(integer(0, 9))).join("");
    const { pattern } = upcPattern(digits);
    const guardRanges = [[0, 2], [45, 49], [92, 94]];
    for (let index = 0; index < pattern.length; index += 1) {
      if (pattern[index] !== "1") continue;
      const isGuard = guardRanges.some(([start, end]) => index >= start && index <= end);
      if (!isGuard) range(0.84, 1);
      range(0.86, 1.06);
      if (!isGuard) range(0.82, 0.96);
    }
  } else if (item.graphicType === "pseudo-qr") {
    const cells = 15;
    for (let row = 0; row < cells; row += 1) {
      for (let column = 0; column < cells; column += 1) {
        const finder =
          (row < 5 && column < 5) ||
          (row < 5 && column >= cells - 5) ||
          (row >= cells - 5 && column < 5);
        const ring = finder && (row === 0 || column === 0 || row === 4 || column === 4 || row === 1 && column === 1 || row === 2 && column === 2 || row === 3 && column === 3);
        if (!ring) chance(0.42);
      }
    }
  } else if (item.graphicType === "table") {
    const maxRows = clamp(Math.floor((item.intrinsic?.height || 120) / 24), 2, 5);
    const rows = integer(Math.min(3, maxRows), maxRows);
    for (let index = 0; index < rows; index += 1) {
      pick([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      integer(10, 99);
      pick([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      integer(1, 99);
      chance(0.5);
    }
  } else if (item.graphicType === "wave") {
    for (let index = 0; index <= 14; index += 1) {
      range(0.9, 1.4);
      range(0.18, 0.42);
      range(-8, 8);
    }
  } else if (item.graphicType === "metadata-badge") {
    chance(0.45);
  }

  return recording.values;
}

export function createGraphicPrimitives({ randomSource, visualTokens }) {
  const { range: randomRange, integer, pick, chance } = randomSource;

  function spinTransform(x, y, width, height, angle = 0) {
    if (!angle) return "";
    return `rotate(${angle.toFixed(2)} ${(x + width / 2).toFixed(2)} ${(y + height / 2).toFixed(2)})`;
  }

  function designTokenGroup(parent, x, y, width, height, attrs = {}) {
    const tokenSize = normalizeDesignTokenSize(attrs.tokenSize || "medium");
    const transform = spinTransform(x, y, width, height, attrs.spin || 0);
    const group = make("g", {
      ...tokenSizeAttrs(tokenSize),
      ...tokenTaxonomyAttrs({
        form: attrs.form || "graphic",
        tokenFunction: attrs.tokenFunction,
        role: attrs.tokenRole,
        typeface: attrs.typeface,
        context: attrs.tokenContext || "component"
      }),
      transform
    });
    parent.appendChild(group);
    return group;
  }

  function graphicTokenGroup(parent, tokenFunction, tokenRole, tokenContext = "primitive-detail", tokenSize = "medium") {
    const group = make("g", {
      ...tokenTaxonomyAttrs({
        form: "graphic",
        tokenFunction,
        role: tokenRole,
        context: tokenContext
      }),
      ...tokenSizeAttrs(tokenSize)
    });
    parent.appendChild(group);
    return group;
  }

  function label(group, x, y, width, value = pick(visualTokens.englishKeywords), fill = false, options = {}) {
    const tokenSize = normalizeDesignTokenSize(options.tokenSize || "medium");
    const tokenFunction = options.tokenFunction || "sign";
    const tokenRole = options.tokenRole || "section-label";
    const tokenContext = options.tokenContext || "component";
    const target = designTokenGroup(group, x, y, width, 28, {
      tokenSize,
      spin: options.spin || 0,
      form: "graphic",
      tokenFunction,
      tokenRole,
      tokenContext
    });
    const margin = marginSize(width, 28, "small");
    const align = normalizeTokenAlign(options.align || "left");
    const textBox = { x: x + margin, y, width: Math.max(1, width - margin * 2), height: 28 };
    const textX = alignedTextX(textBox, align);
    if (fill) {
      target.appendChild(rect(x, y, width, 28, { fill: "currentColor", stroke: false, opacity: 0.96 }));
      const text = textNode(textX, y + 20, value, { size: 15, align, tokenSize, tokenFunction, tokenRole, tokenContext, transform: "", opacity: 1, typeface: "english", maxWidth: textBox.width });
      text.setAttribute("fill", "var(--bg)");
      target.appendChild(text);
    } else {
      target.appendChild(rect(x, y, width, 28));
      target.appendChild(textNode(textX, y + 20, value, { size: 15, align, tokenSize, tokenFunction, tokenRole, tokenContext, typeface: "english", maxWidth: textBox.width }));
    }
  }

  function microBadgeWidth(value) {
    return Math.max(48, estimateTextWidth(value, 11) + marginSize(80, 21, "small") * 2);
  }

  function microBadge(group, x, y, value, options = {}) {
    const width = microBadgeWidth(value);
    const margin = marginSize(width, 21, "small");
    const tokenSize = normalizeDesignTokenSize(options.tokenSize || "medium");
    const target = designTokenGroup(group, x, y, width, 21, {
      tokenSize,
      spin: options.spin || 0,
      form: "graphic",
      tokenFunction: "sign",
      tokenRole: "metadata-badge",
      tokenContext: options.tokenContext || "component"
    });
    const badgeRect = rect(x, y, width, 21, { fill: chance(0.45) ? "currentColor" : "none" });
    target.appendChild(badgeRect);
    const text = textNode(x + width / 2, y + 15, value, { size: 11, align: "center", tokenSize: "small", tokenFunction: "data", tokenRole: "revision", tokenContext: options.tokenContext || "component", typeface: "mono", maxWidth: width - margin * 2 });
    if (badgeRect.getAttribute("fill") === "currentColor") text.setAttribute("fill", "var(--bg)");
    target.appendChild(text);
  }

  function barcodeDigits(length = 12) {
    return Array.from({ length }, () => String(integer(0, 9))).join("");
  }

  function barcode(group, x, y, width, height, options = {}) {
    if (width <= 0 || height <= 0) return;
    const barcodeTokenSize = normalizeDesignTokenSize(options.tokenSize || "medium");
    const captionTokenSize = "small";
    const captionFontSize = TYPOGRAPHY_INTRINSIC_FONT_SIZES[captionTokenSize];
    const target = graphicTokenGroup(group, "data", "barcode", options.tokenContext || "primitive-detail", barcodeTokenSize);
    const digits = options.digits || barcodeDigits(11);
    const { value, pattern } = upcPattern(digits);
    const captionH = options.caption === false || height < 34 ? 0 : captionFontSize;
    const quiet = marginSize(width, height, "large");
    const availableW = Math.max(1, width - quiet * 2);
    const moduleW = availableW / pattern.length;
    const captionGap = captionH ? marginSize(width, height, "small") * 0.35 : 0;
    const barH = Math.max(6, height - captionH - captionGap);
    const guardRanges = [[0, 2], [45, 49], [92, 94]];

    for (let index = 0; index < pattern.length; index += 1) {
      if (pattern[index] !== "1") continue;
      const isGuard = guardRanges.some(([start, end]) => index >= start && index <= end);
      const barX = x + quiet + index * moduleW;
      const barY = y + (isGuard ? 0 : Math.max(0, barH * 0.06));
      const renderedHeight = isGuard
        ? Math.min(height - captionH * 0.35, barH + captionH * 0.45)
        : barH * randomRange(0.84, 1);
      target.appendChild(rect(barX, barY, Math.max(0.7, moduleW * randomRange(0.86, 1.06)), renderedHeight, {
        fill: "currentColor",
        stroke: false,
        opacity: isGuard ? 0.98 : randomRange(0.82, 0.96)
      }));
    }

    if (captionH) {
      const captionY = y + height - 1;
      const first = value[0];
      const leftDigits = value.slice(1, 6);
      const rightDigits = value.slice(6, 11);
      const last = value[11];
      const context = options.tokenContext || "primitive-detail";
      target.appendChild(textNode(x, captionY, first, { size: captionFontSize, tokenSize: captionTokenSize, tokenFunction: "data", tokenRole: "barcode-caption", tokenContext: context, typeface: "mono" }));
      target.appendChild(textNode(x + quiet + availableW * 0.29, captionY, leftDigits, { size: captionFontSize, tokenSize: captionTokenSize, tokenFunction: "data", tokenRole: "barcode-caption", tokenContext: context, align: "center", typeface: "mono" }));
      target.appendChild(textNode(x + quiet + availableW * 0.72, captionY, rightDigits, { size: captionFontSize, tokenSize: captionTokenSize, tokenFunction: "data", tokenRole: "barcode-caption", tokenContext: context, align: "center", typeface: "mono" }));
      target.appendChild(textNode(x + width, captionY, last, { size: captionFontSize, tokenSize: captionTokenSize, tokenFunction: "data", tokenRole: "barcode-caption", tokenContext: context, align: "right", typeface: "mono" }));
    }
  }

  function pseudoQr(group, x, y, size, cells = 15, options = {}) {
    if (size <= 0) return;
    const target = graphicTokenGroup(group, "data", "pseudo-qr", options.tokenContext || "primitive-detail", options.tokenSize || "medium");
    const step = size / cells;
    target.appendChild(rect(x, y, size, size, { fill: "transparent", stroke: false }));
    for (let row = 0; row < cells; row += 1) {
      for (let column = 0; column < cells; column += 1) {
        const finder =
          (row < 5 && column < 5) ||
          (row < 5 && column >= cells - 5) ||
          (row >= cells - 5 && column < 5);
        const ring = finder && (row === 0 || column === 0 || row === 4 || column === 4 || row === 1 && column === 1 || row === 2 && column === 2 || row === 3 && column === 3);
        if (ring || chance(0.42)) {
          target.appendChild(rect(x + column * step, y + row * step, step * 0.9, step * 0.9, { fill: "currentColor", stroke: false }));
        }
      }
    }
  }

  function miniTable(group, x, y, width, options = {}) {
    if (width <= 0) return;
    const target = graphicTokenGroup(group, "data", "table", options.tokenContext || "primitive-detail", options.tokenSize || "medium");
    const rowH = 24;
    const maxRows = clamp(Math.floor((options.maxHeight || rowH * 5) / rowH), 2, 5);
    const rows = integer(Math.min(3, maxRows), maxRows);
    const height = rows * rowH;
    const cellMargin = marginSize(width, height, "small");
    const leftCellWidth = Math.max(10, width * 0.48 - cellMargin * 2);
    const rightCellWidth = Math.max(10, width * 0.52 - cellMargin * 2);
    target.appendChild(rect(x, y, width, height));
    target.appendChild(line(x + width * 0.48, y, x + width * 0.48, y + height));
    for (let index = 1; index < rows; index += 1) target.appendChild(line(x, y + index * rowH, x + width, y + index * rowH));
    for (let index = 0; index < rows; index += 1) {
      const context = options.tokenContext || "primitive-detail";
      target.appendChild(textNode(x + cellMargin, y + 17 + index * rowH, `${pick(visualTokens.tableFieldLabels)} ${integer(10, 99)}`, { size: 11, tokenSize: "small", tokenFunction: "data", tokenRole: "table-cell", tokenContext: context, typeface: "mono", maxWidth: leftCellWidth }));
      target.appendChild(textNode(x + width * 0.48 + cellMargin, y + 17 + index * rowH, `${pick(visualTokens.tableFieldLabels)} ${integer(1, 99)}${chance(0.5) ? "%" : ""}`, { size: 11, tokenSize: "small", tokenFunction: "data", tokenRole: "table-cell", tokenContext: context, typeface: "mono", maxWidth: rightCellWidth }));
    }
  }

  function wave(group, x, y, width, height, options = {}) {
    if (width <= 0 || height <= 0) return;
    const target = graphicTokenGroup(group, "data", "wave", options.tokenContext || "primitive-detail", options.tokenSize || "medium");
    const points = [];
    const steps = 14;
    for (let index = 0; index <= steps; index += 1) {
      const pointY = y + height / 2 + Math.sin(index * randomRange(0.9, 1.4)) * height * randomRange(0.18, 0.42) + randomRange(-8, 8);
      points.push([x + width * (index / steps), clamp(pointY, y, y + height)]);
    }
    target.appendChild(rect(x, y, width, height, { opacity: 0.75 }));
    for (let index = 1; index < 4; index += 1) {
      target.appendChild(line(x, y + height * (index / 4), x + width, y + height * (index / 4), { dash: "2 9", opacity: 0.45 }));
    }
    target.appendChild(polyline(points, { strokeWeight: "thick" }));
  }

  return { label, microBadgeWidth, microBadge, barcode, pseudoQr, miniTable, wave };
}

function bitAt(bits, index) {
  return bits[index % bits.length] === "1";
}

function finderModule(row, column, count) {
  const origins = [[0, 0], [0, count - 7], [count - 7, 0]];
  return origins.some(([originRow, originColumn]) => {
    const localRow = row - originRow;
    const localColumn = column - originColumn;
    if (localRow < 0 || localRow > 6 || localColumn < 0 || localColumn > 6) return false;
    return localRow === 0 || localRow === 6 || localColumn === 0 || localColumn === 6
      || (localRow >= 2 && localRow <= 4 && localColumn >= 2 && localColumn <= 4);
  });
}

export function motifRenderTelemetry(renderParams) {
  if (renderParams.graphicType === "barcode") {
    const painted = [...renderParams.barPattern].filter(bit => bit === "1").length;
    return Object.freeze({ primitiveCount: painted + 1, density: painted / renderParams.barPattern.length });
  }
  if (renderParams.graphicType === "pseudo-qr") {
    let painted = 0;
    for (let row = 0; row < renderParams.moduleCount; row += 1) {
      for (let column = 0; column < renderParams.moduleCount; column += 1) {
        if (finderModule(row, column, renderParams.moduleCount) || bitAt(renderParams.payloadBits, row * renderParams.moduleCount + column)) painted += 1;
      }
    }
    return Object.freeze({ primitiveCount: painted, density: painted / (renderParams.moduleCount ** 2) });
  }
  if (renderParams.graphicType === "table") {
    const cellCount = renderParams.columns * renderParams.rows;
    const filled = Array.from({ length: cellCount }, (_, index) => bitAt(renderParams.densityKey, index)).filter(Boolean).length;
    return Object.freeze({ primitiveCount: renderParams.columns + renderParams.rows + filled, density: filled / cellCount });
  }
  if (renderParams.graphicType === "wave") {
    return Object.freeze({ primitiveCount: renderParams.pointCount + 3, density: 0.18 });
  }
  if (renderParams.seedBits) {
    return Object.freeze({ primitiveCount: 16, density: 0.2 });
  }
  throw new Error(`Unknown composition motif: ${renderParams.graphicType}`);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromBits(bits) {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < bits.length; index += 1) {
    hash ^= bits.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function motifDot(cx, cy, radius) {
  return make("circle", { cx, cy, r: radius, fill: "currentColor", stroke: "none" });
}

function fillPolygon(points) {
  return make("polygon", {
    points: points.map(point => `${point[0].toFixed(2)},${point[1].toFixed(2)}`).join(" "),
    fill: "currentColor",
    stroke: "none"
  });
}

function rayEdge(cx, cy, angle, width, height) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (width - cx) / dx);
  else if (dx < -1e-9) t = Math.min(t, (0 - cx) / dx);
  if (dy > 1e-9) t = Math.min(t, (height - cy) / dy);
  else if (dy < -1e-9) t = Math.min(t, (0 - cy) / dy);
  return [cx + dx * t, cy + dy * t];
}

// Manga-terminal pattern drawers; each fills the (0,0,width,height) block box.
const MOTIF_PATTERN_DRAWERS = {
  "halftone-meter"(group, width, height) {
    const cols = Math.max(8, Math.round(width / 22));
    const rows = Math.max(4, Math.round(height / 22));
    const cw = width / cols;
    const ch = height / rows;
    const base = Math.min(cw, ch) * 0.5;
    for (let cx = 0; cx < cols; cx += 1) {
      const density = cols === 1 ? 1 : cx / (cols - 1);
      for (let cy = 0; cy < rows; cy += 1) {
        group.appendChild(motifDot(cx * cw + cw / 2, cy * ch + ch / 2, base * (0.15 + density * 0.85)));
      }
    }
  },
  "radial-halftone"(group, width, height, random, anchor) {
    // Circular motifs keep a true circle: the ring span follows the short side
    // only, never stretching to the block's aspect.
    const { cx, cy } = anchoredCircleCenter(width, height, Math.min(width, height) / 2, anchor);
    const rings = 9;
    const step = Math.min(width, height) / 2 / rings;
    // outermost dot edge must land on the short-side boundary, not its centre
    const outerDotRadius = step * 0.5 * 1.04;
    const span = Math.max(step, Math.min(width, height) / 2 - outerDotRadius);
    for (let ri = 1; ri <= rings; ri += 1) {
      const ringRadius = span * ri / rings;
      const count = Math.max(6, Math.round((2 * Math.PI * ringRadius) / step));
      const radius = step * 0.5 * (0.22 + ri / rings * 0.82);
      for (let k = 0; k < count; k += 1) {
        const a = k / count * Math.PI * 2 + ri * 0.2;
        group.appendChild(motifDot(cx + Math.cos(a) * ringRadius, cy + Math.sin(a) * ringRadius, radius));
      }
    }
  },
  "dot-matrix"(group, width, height, random) {
    const cols = Math.max(6, Math.round(width / 26));
    const rows = Math.max(4, Math.round(height / 26));
    const cw = width / cols;
    const ch = height / rows;
    const s = Math.min(cw, ch) * 0.6;
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        const px = cx * cw + (cw - s) / 2;
        const py = cy * ch + (ch - s) / 2;
        group.appendChild(random() < 0.5
          ? rect(px, py, s, s, { fill: "currentColor", stroke: false })
          : rect(px, py, s, s, { strokeWeight: "thin" }));
      }
    }
  },
  stipple(group, width, height, random) {
    const count = Math.round(width * height / 190);
    for (let i = 0; i < count; i += 1) {
      const px = random() * width;
      const py = random() * height;
      if (random() < (px / width) * 0.9 + 0.05) {
        const radius = 0.7 + random() * 1.5;
        group.appendChild(motifDot(
          clamp(px, radius, width - radius),
          clamp(py, radius, height - radius),
          radius
        ));
      }
    }
  },
  scanlines(group, width, height, random) {
    let cy = 0;
    while (cy < height) {
      const thickness = 0.6 + random() * 2.6;
      // the trailing band is cropped at the boundary instead of spilling past it
      const drawn = Math.min(thickness, height - cy);
      if (drawn > 0.05) group.appendChild(rect(0, cy, width, drawn, { fill: "currentColor", stroke: false }));
      cy += thickness + 1.4 + random() * 3.2;
    }
  },
  "speed-lines"(group, width, height, random) {
    const count = Math.max(8, Math.round(height / 14));
    for (let i = 0; i < count; i += 1) {
      const ly = (i + 0.5) * (height / count) + (random() - 0.5) * 4;
      const length = width * (0.35 + random() * 0.6);
      const fromRight = random() < 0.5;
      group.appendChild(line(fromRight ? width - length : 0, ly, fromRight ? width : length, ly, { strokeWeight: "thick" }));
    }
  },
  chevron(group, width, height) {
    const rows = Math.max(4, Math.round(height / 28));
    const rh = height / rows;
    const cw = Math.max(14, width / 12);
    for (let ri = 0; ri < rows; ri += 1) {
      const cy = ri * rh + rh / 2;
      for (let cx = 0; cx < width - cw; cx += cw * 0.9) {
        group.appendChild(polyline([[cx, cy + rh * 0.26], [cx + cw / 2, cy - rh * 0.26], [cx + cw, cy + rh * 0.26]], { strokeWeight: "thick" }));
      }
    }
  },
  perspective(group, width, height) {
    // one-point tunnel: reaches all four corners so it fills the grid cell
    const vx = width / 2;
    const vy = height / 2;
    const anchors = [
      [0, 0], [width, 0], [width, height], [0, height],
      [width / 2, 0], [width, height / 2], [width / 2, height], [0, height / 2]
    ];
    anchors.forEach(point => group.appendChild(line(point[0], point[1], vx, vy, { strokeWeight: "thick" })));
    const depth = 6;
    for (let i = 1; i < depth; i += 1) {
      const t = i / depth;
      group.appendChild(rect(vx * t, vy * t, width * (1 - t), height * (1 - t), { strokeWeight: "thin" }));
    }
  },
  "focus-lines"(group, width, height, random) {
    const cx = width * (0.4 + random() * 0.2);
    const cy = height * (0.4 + random() * 0.2);
    const count = 34;
    const clear = Math.min(width, height) * 0.1;
    for (let i = 0; i < count; i += 1) {
      const a = i / count * Math.PI * 2 + (random() - 0.5) * 0.12;
      const edge = rayEdge(cx, cy, a, width, height);
      group.appendChild(line(cx + Math.cos(a) * clear, cy + Math.sin(a) * clear, edge[0], edge[1], { strokeWeight: "thick" }));
    }
  },
  "beta-flash"(group, width, height, random) {
    const cx = width / 2;
    const cy = height / 2;
    const spikes = 22;
    const innerR = Math.min(width, height) * 0.08;
    for (let i = 0; i < spikes; i += 1) {
      const a = i / spikes * Math.PI * 2;
      const reach = Math.min(1, 0.6 + (i % 2 ? 0.4 : 0.12) + random() * 0.05);
      const edge = rayEdge(cx, cy, a, width, height);
      const ex = cx + (edge[0] - cx) * reach;
      const ey = cy + (edge[1] - cy) * reach;
      const e = 0.06;
      group.appendChild(fillPolygon([
        [cx + Math.cos(a - e) * innerR, cy + Math.sin(a - e) * innerR],
        [ex, ey],
        [cx + Math.cos(a + e) * innerR, cy + Math.sin(a + e) * innerR]
      ]));
    }
  },
  "burst-rings"(group, width, height, random, anchor) {
    // Rings stay true circles sized by the short side.
    const rings = 4;
    const maxRadius = Math.min(width, height) / 2;
    const { cx, cy } = anchoredCircleCenter(width, height, maxRadius, anchor);
    for (let i = 1; i <= rings; i += 1) {
      const ringRadius = maxRadius * i / rings;
      const spikes = 16 + i * 4;
      const points = [];
      for (let k = 0; k < spikes; k += 1) {
        const a = k / spikes * Math.PI * 2;
        const scale = Math.min(1, (k % 2 ? 1 : 0.85) * (1 + (random() - 0.5) * 0.05));
        points.push([cx + Math.cos(a) * ringRadius * scale, cy + Math.sin(a) * ringRadius * scale]);
      }
      points.push(points[0]);
      group.appendChild(polyline(points, { strokeWeight: "thick" }));
    }
  }
};

// Circular motifs shrink to the block's short side, so in elongated blocks the
// leftover space matters: the ring center follows the block's edge-derived
// alignment (same rule typography uses) instead of always floating centered.
function anchoredCircleCenter(width, height, maxRadius, anchor) {
  const alignment = anchor?.alignment || "center";
  const vertical = anchor?.verticalAlignment || "middle";
  return {
    cx: alignment === "left" ? maxRadius : alignment === "right" ? width - maxRadius : width / 2,
    cy: vertical === "top" ? maxRadius : vertical === "bottom" ? height - maxRadius : height / 2
  };
}

export function renderCompositionMotif(group, intrinsicBounds, renderParams, anchor = null) {
  const width = intrinsicBounds.width;
  const height = intrinsicBounds.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("composition motif requires positive intrinsic bounds");
  }
  group.appendChild(rect(0, 0, width, height, { fill: "transparent", stroke: false, opacity: 0 }));

  if (renderParams.graphicType === "barcode") {
    // line-screen: vertical bars with per-bit thickness
    const bars = Math.max(10, Math.round(width / 6));
    const step = width / bars;
    for (let index = 0; index < bars; index += 1) {
      const thickness = step * (bitAt(renderParams.barPattern, index) ? 0.82 : 0.34);
      group.appendChild(rect(index * step + (step - thickness) / 2, 0, Math.max(0.5, thickness), height, { fill: "currentColor", stroke: false }));
    }
  } else if (renderParams.graphicType === "pseudo-qr") {
    // dot-matrix field from payload bits
    const modules = renderParams.moduleCount;
    const stepX = width / modules;
    const stepY = height / modules;
    for (let row = 0; row < modules; row += 1) {
      for (let column = 0; column < modules; column += 1) {
        if (!bitAt(renderParams.payloadBits, row * modules + column)) continue;
        group.appendChild(rect(column * stepX, row * stepY, Math.max(0.5, stepX * 0.82), Math.max(0.5, stepY * 0.82), { fill: "currentColor", stroke: false }));
      }
    }
  } else if (renderParams.graphicType === "table") {
    // diagonal hatch field
    const gap = Math.max(5, Math.min(width, height) / 8);
    for (let offset = 0; offset <= width + height; offset += gap) {
      group.appendChild(line(Math.min(offset, width), Math.max(0, offset - width), Math.max(0, offset - height), Math.min(offset, height)));
    }
    group.appendChild(rect(0, 0, width, height));
  } else if (renderParams.graphicType === "wave") {
    // Concentric rings stay true circles sized by the short side — circular
    // motifs never stretch to the block's aspect.
    const rings = Math.max(3, renderParams.pointCount >> 1);
    const maxRadius = Math.min(width, height) / 2;
    const { cx, cy } = anchoredCircleCenter(width, height, maxRadius, anchor);
    for (let index = 1; index <= rings; index += 1) {
      group.appendChild(make("circle", {
        cx,
        cy,
        r: maxRadius * index / rings,
        fill: "none",
        stroke: "currentColor",
        ...strokeTokenAttrs("thick")
      }));
    }
  } else if (MOTIF_PATTERN_DRAWERS[renderParams.graphicType]) {
    MOTIF_PATTERN_DRAWERS[renderParams.graphicType](group, width, height, mulberry32(seedFromBits(renderParams.seedBits)), anchor);
  } else {
    throw new Error(`Unknown composition motif: ${renderParams.graphicType}`);
  }

  const telemetry = motifRenderTelemetry(renderParams);
  group.setAttribute("data-motif-primitive-count", String(telemetry.primitiveCount));
  group.setAttribute("data-motif-density", String(Math.round(telemetry.density * 1_000_000) / 1_000_000));
  return group;
}
