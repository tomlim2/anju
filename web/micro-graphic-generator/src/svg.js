import { FONT_WEIGHTS, SVG_NS } from "./config.js";
import { sha256Hex, utf8Bytes } from "./canonical-hash.js";
export {
  deriveSvgStructuralProjection,
  svgStructuralFingerprint
} from "./svg-structural.js";
import {
  fontWeightForToken,
  fontWeightValueForToken,
  normalizeDesignTokenSize,
  normalizeFontWeight,
  strokeTokenAttrs,
  tokenSizeAttrs,
  tokenTaxonomyAttrs
} from "./token-model.js";
import {
  estimateTextWidth,
  fitTextSize,
  resolveTextAlignment,
  resolveTypeface
} from "./typography.js";
import { svgStructuralFingerprint } from "./svg-structural.js";

export function make(tag, attrs = {}, children = []) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value !== undefined && value !== null) element.setAttribute(key, value);
  });
  children.forEach(child => element.appendChild(child));
  return element;
}

export function textNode(x, y, text, attrs = {}) {
  const fontSize = fitTextSize(text, attrs);
  const tokenSize = attrs.tokenSize ? normalizeDesignTokenSize(attrs.tokenSize) : null;
  const tokenWeight = tokenSize
    ? fontWeightForToken(tokenSize, attrs.tokenFunction)
    : normalizeFontWeight(attrs.weight);
  const fontWeight = attrs.fontWeightOverride ?? (tokenSize
    ? fontWeightValueForToken(tokenSize, attrs.tokenFunction)
    : FONT_WEIGHTS[tokenWeight]);
  const taxonomyAttrs = tokenSize ? tokenTaxonomyAttrs({
    form: "typography",
    tokenFunction: attrs.tokenFunction,
    role: attrs.tokenRole,
    typeface: attrs.typeface,
    context: attrs.tokenContext || "component"
  }) : {};
  const element = make("text", {
    x,
    y,
    fill: "currentColor",
    "font-family": resolveTypeface(text, attrs),
    "font-size": fontSize,
    "font-weight": fontWeight,
    "line-height": 1,
    "letter-spacing": attrs.tracking || 0,
    "text-anchor": resolveTextAlignment(attrs),
    "writing-mode": attrs.writingMode,
    "text-orientation": attrs.textOrientation,
    "dominant-baseline": attrs.dominantBaseline,
    opacity: attrs.opacity ?? 1,
    transform: attrs.transform || "",
    ...(tokenSize ? tokenSizeAttrs(tokenSize) : {}),
    ...(tokenSize ? { "data-token-weight": tokenWeight } : {}),
    ...taxonomyAttrs
  });
  if (attrs.maxWidth) {
    const fittedWidth = estimateTextWidth(text, fontSize, attrs.tracking || 0);
    if (fittedWidth > attrs.maxWidth) {
      element.setAttribute("textLength", attrs.maxWidth);
      element.setAttribute("lengthAdjust", "spacingAndGlyphs");
    }
  }
  element.textContent = text;
  return element;
}

export function line(x1, y1, x2, y2, attrs = {}) {
  return make("line", {
    x1,
    y1,
    x2,
    y2,
    stroke: "currentColor",
    ...strokeTokenAttrs(attrs.strokeWeight),
    "stroke-dasharray": attrs.dash || "",
    "stroke-linecap": "square",
    opacity: attrs.opacity ?? 1
  });
}

export function rect(x, y, width, height, attrs = {}) {
  const hasStroke = attrs.stroke !== false;
  return make("rect", {
    x,
    y,
    width,
    height,
    fill: attrs.fill || "none",
    stroke: hasStroke ? "currentColor" : "none",
    ...(hasStroke ? strokeTokenAttrs(attrs.strokeWeight) : {}),
    "stroke-dasharray": attrs.dash || "",
    opacity: attrs.opacity ?? 1,
    transform: attrs.transform || ""
  });
}

export function polyline(points, attrs = {}) {
  return make("polyline", {
    points: points.map(point => point.join(",")).join(" "),
    fill: "none",
    stroke: "currentColor",
    ...strokeTokenAttrs(attrs.strokeWeight),
    "stroke-dasharray": attrs.dash || "",
    opacity: attrs.opacity ?? 1
  });
}

export function artifactByteDigest(value) {
  const bytes = typeof value === "string" ? utf8Bytes(value) : value;
  return `sha256:${sha256Hex(bytes)}`;
}
