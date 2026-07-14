import { TYPOGRAPHY_INTRINSIC_FONT_SIZES } from "./config.js";
import { TYPOGRAPHY_METRIC_DATA } from "./typography-metrics-data.js";

export const FONT_METRICS_VERSION = 1;

function round6(value) {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function glyphAdvance(character, metrics) {
  return /\s/u.test(character) ? metrics.spaceAdvance : metrics.averageAdvance;
}

export function measureTypography({
  text,
  typeface,
  fontWeight,
  size,
  lineHeight = 1,
  orientationMode = "none"
}) {
  if (typeof text !== "string" || text.length === 0) throw new TypeError("typography text is required");
  const metrics = TYPOGRAPHY_METRIC_DATA[typeface]?.[fontWeight];
  if (!metrics) throw new Error(`unsupported typography metric ${typeface}/${fontWeight}`);
  const fontSize = TYPOGRAPHY_INTRINSIC_FONT_SIZES[size];
  if (!fontSize) throw new Error(`unsupported typography size ${size}`);
  if (lineHeight !== 1) throw new Error("composition typography lineHeight must be 1");

  const glyphs = [...text];
  const horizontalWidth = glyphs.reduce((sum, character) => sum + glyphAdvance(character, metrics), 0) * fontSize;
  const horizontalHeight = Math.max(metrics.capHeight * fontSize, fontSize * lineHeight);
  let width = horizontalWidth;
  let height = horizontalHeight;
  if (orientationMode === "whole-rotate") {
    [width, height] = [height, width];
  } else if (orientationMode === "glyph-sideways-stack") {
    width = fontSize;
    height = glyphs.length * fontSize * lineHeight;
  } else if (orientationMode !== "none") {
    throw new Error(`unsupported orientation mode ${orientationMode}`);
  }
  return Object.freeze({ width: round6(width), height: round6(height) });
}
