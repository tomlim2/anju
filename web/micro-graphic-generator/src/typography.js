import { TEXT_ALIGNMENTS, TYPEFACES, TYPOGRAPHY_INTRINSIC_FONT_SIZES } from "./config.js";
import { fontWeightForToken, fontWeightValueForToken } from "./token-model.js";

export function hasHangul(value) {
  return /[가-힣]/.test(value);
}

export function hasHanja(value) {
  return /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(value);
}

export function resolveTypeface(text, attrs = {}) {
  if (attrs.typeface && TYPEFACES[attrs.typeface]) return TYPEFACES[attrs.typeface];
  if (attrs.mono) return TYPEFACES.mono;
  if (attrs.hanja || hasHanja(text)) return TYPEFACES.hanja;
  if (attrs.ko || hasHangul(text)) return TYPEFACES.korean;
  return TYPEFACES.english;
}

export function estimateTextWidth(text, size, tracking = 0) {
  const value = String(text);
  const units = [...value].reduce((sum, char) => {
    if (/\s/.test(char)) return sum + 0.34;
    if (/[가-힣\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(char)) return sum + 1.02;
    if (/[MW@#%]/.test(char)) return sum + 0.82;
    if (/[A-Z0-9]/.test(char)) return sum + 0.64;
    if (/[a-z]/.test(char)) return sum + 0.56;
    if (/[.,:;'"!?/\\|()[\]{}<>-]/.test(char)) return sum + 0.38;
    return sum + 0.62;
  }, 0);
  return units * size + Math.max(0, value.length - 1) * tracking;
}

export function estimateTextHeight(text, size) {
  const hasCjk = /[가-힣\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(String(text));
  return size * (hasCjk ? 1.14 : 1.02);
}

export function fitTextSize(text, attrs = {}) {
  const size = attrs.size || 18;
  if (!attrs.maxWidth && !attrs.maxHeight) return size;
  const estimatedWidth = estimateTextWidth(text, size, attrs.tracking || 0);
  const estimatedHeight = estimateTextHeight(text, size);
  const widthRatio = attrs.maxWidth ? attrs.maxWidth / estimatedWidth : 1;
  const heightRatio = attrs.maxHeight ? attrs.maxHeight / estimatedHeight : 1;
  const fitRatio = Math.min(1, widthRatio, heightRatio);
  if (fitRatio >= 1) return size;
  const minSize = attrs.minSize || Math.max(8, size * 0.48);
  return Math.max(minSize, size * fitRatio);
}

export function resolveTextAlignment(attrs = {}) {
  return TEXT_ALIGNMENTS[attrs.align] || TEXT_ALIGNMENTS.left;
}

export function resolveTypographyStyle({ token, orientationMode = "none", actualSize = token.size, forceHeavyXlarge = false }) {
  const tokenWeight = fontWeightForToken(actualSize, token.function);
  const baseWeight = fontWeightValueForToken(actualSize, token.function);
  return {
    typefaceRole: token.typeface,
    fontFamily: resolveTypeface(token.value, { typeface: token.typeface }),
    fontSize: TYPOGRAPHY_INTRINSIC_FONT_SIZES[actualSize],
    tokenWeight,
    fontWeight: forceHeavyXlarge && actualSize === "xlarge" ? 900 : baseWeight,
    lineHeight: 1,
    orientationMode,
    rotation: orientationMode === "whole-rotate" ? 90 : 0
  };
}

export function createTypographyMeasurer(measureContext = null) {
  function typographyMetrics(item, align = "left") {
    const fontSize = item.intrinsic.fontSize;
    const estimatedWidth = estimateTextWidth(item.value, fontSize);
    const estimatedHeight = estimateTextHeight(item.value, fontSize);
    const alignOffset = { left: 0, center: 0.5, right: 1 }[align] ?? 0;
    const fallbackLeft = estimatedWidth * alignOffset;

    if (!measureContext) {
      return {
        left: fallbackLeft,
        right: estimatedWidth - fallbackLeft,
        ascent: estimatedHeight * 0.8,
        descent: estimatedHeight * 0.2
      };
    }

    measureContext.font = `${fontWeightValueForToken(item.size, item.function)} ${fontSize}px ${resolveTypeface(item.value, { typeface: item.typeface })}`;
    measureContext.textAlign = align;
    measureContext.textBaseline = "alphabetic";
    const metrics = measureContext.measureText(item.value);
    return {
      left: Number.isFinite(metrics.actualBoundingBoxLeft) ? metrics.actualBoundingBoxLeft : fallbackLeft,
      right: Number.isFinite(metrics.actualBoundingBoxRight) ? metrics.actualBoundingBoxRight : estimatedWidth - fallbackLeft,
      ascent: Number.isFinite(metrics.actualBoundingBoxAscent) ? metrics.actualBoundingBoxAscent : estimatedHeight * 0.8,
      descent: Number.isFinite(metrics.actualBoundingBoxDescent) ? metrics.actualBoundingBoxDescent : estimatedHeight * 0.2
    };
  }

  function orientedTypographyDimensions(item, rotation = 0) {
    const metrics = typographyMetrics(item);
    const width = metrics.left + metrics.right;
    const height = metrics.ascent + metrics.descent;
    return rotation === 90 ? { width: height, height: width } : { width, height };
  }

  function typographyBaselineY(position, item, metrics = typographyMetrics(item, position.align)) {
    if (position.verticalAlign === "top") return position.y + metrics.ascent;
    if (position.verticalAlign === "bottom") return position.y - metrics.descent;
    return position.y + (metrics.ascent - metrics.descent) * 0.5;
  }

  function measuredTypographyBox(position, item) {
    const metrics = typographyMetrics(item, position.align);
    const baselineY = typographyBaselineY(position, item, metrics);
    const corners = [
      { x: position.x - metrics.left, y: baselineY - metrics.ascent },
      { x: position.x + metrics.right, y: baselineY - metrics.ascent },
      { x: position.x + metrics.right, y: baselineY + metrics.descent },
      { x: position.x - metrics.left, y: baselineY + metrics.descent }
    ];
    const radians = (position.rotation || 0) * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const rotated = corners.map(point => {
      const dx = point.x - position.x;
      const dy = point.y - position.y;
      return {
        x: position.x + dx * cos - dy * sin,
        y: position.y + dx * sin + dy * cos
      };
    });
    const xs = rotated.map(point => point.x);
    const ys = rotated.map(point => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return {
      x,
      y,
      width: Math.max(...xs) - x,
      height: Math.max(...ys) - y
    };
  }

  return { typographyMetrics, orientedTypographyDimensions, typographyBaselineY, measuredTypographyBox };
}
