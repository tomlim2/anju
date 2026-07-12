import { MARGIN_TOKENS, PADDING_TOKENS, TOKEN_ALIGNMENTS } from "./config.js";

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function fitComponentBox(containerW, containerH, ratio, scale = 0.72) {
  const maxW = containerW * scale;
  const maxH = containerH * scale;
  let boxW = maxW;
  let boxH = boxW * ratio.height / ratio.width;

  if (boxH > maxH) {
    boxH = maxH;
    boxW = boxH * ratio.width / ratio.height;
  }

  return {
    x: (containerW - boxW) / 2,
    y: (containerH - boxH) / 2,
    width: boxW,
    height: boxH
  };
}

export function paddingSize(width, height, size = "medium") {
  const token = PADDING_TOKENS[size] || PADDING_TOKENS.medium;
  const edge = Math.min(width, height);
  const cap = Math.max(4, edge * 0.24);
  return Math.min(cap, clamp(edge * token.ratio, token.min, token.max));
}

export function marginSize(width, height, size = "medium") {
  const token = MARGIN_TOKENS[size] || MARGIN_TOKENS.medium;
  const edge = Math.min(width, height);
  const cap = Math.max(2, edge * 0.28);
  return Math.min(cap, clamp(edge * token.ratio, token.min, token.max));
}

export function normalizeTokenAlign(align = "left") {
  return TOKEN_ALIGNMENTS.includes(align) ? align : "left";
}

export function alignedBoxX(box, tokenWidth, align = "left") {
  const safeWidth = Math.min(tokenWidth, box.width);
  const normalized = normalizeTokenAlign(align);
  if (normalized === "center") return box.x + (box.width - safeWidth) / 2;
  if (normalized === "right") return box.x + box.width - safeWidth;
  return box.x;
}

export function alignedTextX(box, align = "left") {
  const normalized = normalizeTokenAlign(align);
  if (normalized === "center") return box.x + box.width / 2;
  if (normalized === "right") return box.x + box.width;
  return box.x;
}

export function smallTokenPairZones(zone, rightWidth) {
  const gap = marginSize(zone.width, zone.height, "medium");
  const rightW = clamp(rightWidth, Math.min(48, zone.width * 0.36), zone.width * 0.46);
  return {
    left: {
      x: zone.x,
      y: zone.y,
      width: Math.max(1, zone.width - rightW - gap),
      height: zone.height
    },
    right: {
      x: zone.x + zone.width - rightW,
      y: zone.y,
      width: rightW,
      height: zone.height
    },
    gap
  };
}

export function paddedBox(x, y, width, height, size = "medium") {
  const pad = paddingSize(width, height, size);
  return {
    x: x + pad,
    y: y + pad,
    width: Math.max(1, width - pad * 2),
    height: Math.max(1, height - pad * 2),
    pad
  };
}

export function contentZones(x, y, width, height) {
  const box = paddedBox(x, y, width, height, "medium");
  const gap = marginSize(box.width, box.height, "medium");
  const headerH = clamp(box.height * 0.1, 22, 38);
  const labelH = clamp(box.height * 0.085, 18, 32);
  const subH = clamp(box.height * 0.09, 18, 30);
  const detailH = clamp(box.height * 0.3, 64, Math.min(150, box.height * 0.38));

  const header = { x: box.x, y: box.y, width: box.width, height: headerH };
  const label = { x: box.x, y: header.y + header.height + gap, width: box.width, height: labelH };
  const detail = { x: box.x, y: box.y + box.height - detailH, width: box.width, height: detailH };
  const sub = { x: box.x, y: detail.y - gap - subH, width: box.width, height: subH };
  const mainY = label.y + label.height + gap;
  const main = {
    x: box.x,
    y: mainY,
    width: box.width,
    height: Math.max(28, sub.y - gap - mainY)
  };

  return { box, gap, header, label, main, sub, detail };
}
