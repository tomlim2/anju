import { TYPOGRAPHY_INTRINSIC_FONT_SIZES } from "./config.js";
import { alignedTextX, clamp, marginSize, normalizeTokenAlign } from "./layout.js";
import { line, make, polyline, rect, textNode } from "./svg.js";
import {
  normalizeDesignTokenSize,
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
    target.appendChild(polyline(points));
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
  throw new Error(`Unknown composition motif: ${renderParams.graphicType}`);
}

export function renderCompositionMotif(group, intrinsicBounds, renderParams) {
  const width = intrinsicBounds.width;
  const height = intrinsicBounds.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("composition motif requires positive intrinsic bounds");
  }
  group.appendChild(rect(0, 0, width, height, { fill: "transparent", stroke: false, opacity: 0 }));

  if (renderParams.graphicType === "barcode") {
    const captionHeight = TYPOGRAPHY_INTRINSIC_FONT_SIZES.small + 2;
    const barHeight = Math.max(1, height - captionHeight);
    const quiet = width * 0.04;
    const moduleWidth = (width - quiet * 2) / renderParams.barPattern.length;
    [...renderParams.barPattern].forEach((bit, index) => {
      if (bit !== "1") return;
      group.appendChild(rect(
        quiet + index * moduleWidth,
        0,
        Math.max(0.5, moduleWidth),
        barHeight,
        { fill: "currentColor", stroke: false }
      ));
    });
    group.appendChild(textNode(width / 2, height, renderParams.value, {
      size: TYPOGRAPHY_INTRINSIC_FONT_SIZES.small,
      tokenSize: "small",
      tokenFunction: "data",
      tokenRole: "barcode-caption",
      tokenContext: "primitive-detail",
      typeface: "mono",
      align: "center",
      fontWeightOverride: 400
    }));
  } else if (renderParams.graphicType === "pseudo-qr") {
    const stepX = width / renderParams.moduleCount;
    const stepY = height / renderParams.moduleCount;
    for (let row = 0; row < renderParams.moduleCount; row += 1) {
      for (let column = 0; column < renderParams.moduleCount; column += 1) {
        const index = row * renderParams.moduleCount + column;
        if (!finderModule(row, column, renderParams.moduleCount) && !bitAt(renderParams.payloadBits, index)) continue;
        group.appendChild(rect(
          column * stepX,
          row * stepY,
          Math.max(0.5, stepX * 0.9),
          Math.max(0.5, stepY * 0.9),
          { fill: "currentColor", stroke: false }
        ));
      }
    }
  } else if (renderParams.graphicType === "table") {
    const cellWidth = width / renderParams.columns;
    const cellHeight = height / renderParams.rows;
    group.appendChild(rect(0, 0, width, height));
    for (let column = 1; column < renderParams.columns; column += 1) {
      group.appendChild(line(column * cellWidth, 0, column * cellWidth, height));
    }
    for (let row = 1; row < renderParams.rows; row += 1) {
      group.appendChild(line(0, row * cellHeight, width, row * cellHeight));
    }
    for (let row = 0; row < renderParams.rows; row += 1) {
      for (let column = 0; column < renderParams.columns; column += 1) {
        const index = row * renderParams.columns + column;
        if (!bitAt(renderParams.densityKey, index)) continue;
        group.appendChild(rect(
          column * cellWidth + cellWidth * 0.18,
          row * cellHeight + cellHeight * 0.28,
          cellWidth * 0.52,
          Math.max(1, cellHeight * 0.16),
          { fill: "currentColor", stroke: false }
        ));
      }
    }
  } else if (renderParams.graphicType === "wave") {
    const points = [];
    for (let index = 0; index < renderParams.pointCount; index += 1) {
      const fraction = renderParams.pointCount === 1 ? 0 : index / (renderParams.pointCount - 1);
      const sample = Number.parseInt(renderParams.amplitudeKey.slice((index * 2) % renderParams.amplitudeKey.length, ((index * 2) % renderParams.amplitudeKey.length) + 2).padEnd(2, "0"), 2) / 3;
      const signed = sample * 2 - 1;
      points.push([fraction * width, height * (0.5 + signed * 0.34)]);
    }
    for (let index = 1; index < 4; index += 1) {
      group.appendChild(line(0, height * index / 4, width, height * index / 4, { dash: "2 8", opacity: 0.25 }));
    }
    group.appendChild(polyline(points));
  } else {
    throw new Error(`Unknown composition motif: ${renderParams.graphicType}`);
  }

  const telemetry = motifRenderTelemetry(renderParams);
  group.setAttribute("data-motif-primitive-count", String(telemetry.primitiveCount));
  group.setAttribute("data-motif-density", String(Math.round(telemetry.density * 1_000_000) / 1_000_000));
  return group;
}
