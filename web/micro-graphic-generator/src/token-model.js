import {
  ACTIVE_STROKE_WEIGHTS,
  BOLD_TOKEN_SIZES,
  COMPOSABLE_TOKEN_FUNCTIONS,
  DESIGN_TOKEN_SIZE_ORDER,
  DESIGN_TOKEN_SIZES,
  FONT_WEIGHTS,
  HEAVY_TOKEN_SIZES,
  STROKE_WEIGHTS,
  TOKEN_CONTEXTS,
  TOKEN_FORMS,
  TOKEN_FUNCTIONS,
  TYPEFACES,
  TYPOGRAPHY_INTRINSIC_FONT_SIZES
} from "./config.js";

export function normalizeDesignTokenSize(size = "medium") {
  return DESIGN_TOKEN_SIZES[size] ? size : "medium";
}

export function normalizeFontWeight(weight = "normal") {
  if (weight === "normal" || weight === FONT_WEIGHTS.normal) return "normal";
  return "bold";
}

export function fontWeightForToken(size, tokenFunction) {
  const normalizedSize = normalizeDesignTokenSize(size);
  return tokenFunction === "content" && BOLD_TOKEN_SIZES.includes(normalizedSize) ? "bold" : "normal";
}

export function fontWeightValueForToken(size, tokenFunction) {
  const normalizedSize = normalizeDesignTokenSize(size);
  const tokenWeight = fontWeightForToken(normalizedSize, tokenFunction);
  return tokenWeight === "bold" && HEAVY_TOKEN_SIZES.includes(normalizedSize)
    ? 900
    : FONT_WEIGHTS[tokenWeight];
}

export function normalizeStrokeWeight(weight = ACTIVE_STROKE_WEIGHTS[0]) {
  return ACTIVE_STROKE_WEIGHTS.includes(weight) ? weight : ACTIVE_STROKE_WEIGHTS[0];
}

export function strokeTokenAttrs(weight) {
  const normalized = normalizeStrokeWeight(weight);
  return {
    "stroke-width": STROKE_WEIGHTS[normalized],
    "data-stroke-weight": normalized
  };
}

export function tokenSizeAttrs(size = "medium") {
  const normalized = normalizeDesignTokenSize(size);
  return {
    "data-token-size": normalized,
    "data-row-mode": DESIGN_TOKEN_SIZES[normalized].rowMode
  };
}

export function tokenTaxonomyAttrs({ form, tokenFunction, role, typeface = null, context = "component" }) {
  if (!TOKEN_FORMS.includes(form)) throw new Error(`Unknown token form: ${form}`);
  if (!TOKEN_FUNCTIONS.includes(tokenFunction)) throw new Error(`Unknown token function: ${tokenFunction}`);
  if (!role) throw new Error("Token role is required");
  if (!TOKEN_CONTEXTS.includes(context)) throw new Error(`Unknown token context: ${context}`);
  if (form === "typography" && !TYPEFACES[typeface]) {
    throw new Error(`Typography token requires a known typeface: ${typeface}`);
  }

  return {
    "data-token-form": form,
    "data-token-function": tokenFunction,
    "data-token-role": role,
    "data-token-context": context,
    ...(form === "typography" ? { "data-token-typeface": typeface } : {})
  };
}

export function typographyToken(value, options) {
  const size = normalizeDesignTokenSize(options.size || "medium");
  const definition = {
    value,
    form: "typography",
    function: options.function,
    role: options.role,
    typeface: options.typeface,
    size,
    weight: fontWeightForToken(size, options.function),
    intrinsic: { fontSize: TYPOGRAPHY_INTRINSIC_FONT_SIZES[size] },
    context: options.context || "component"
  };
  tokenTaxonomyAttrs({
    form: definition.form,
    tokenFunction: definition.function,
    role: definition.role,
    typeface: definition.typeface,
    context: definition.context
  });
  return definition;
}

export function typographySizeFallbacks(size) {
  const normalizedSize = normalizeDesignTokenSize(size);
  const sizeIndex = DESIGN_TOKEN_SIZE_ORDER.indexOf(normalizedSize);
  return DESIGN_TOKEN_SIZE_ORDER.slice(0, sizeIndex + 1).reverse();
}

export function typographyTokenAtSize(item, size) {
  if (item.size === size) return item;
  return typographyToken(item.value, {
    typeface: item.typeface,
    size,
    function: item.function,
    role: item.role,
    context: item.context
  });
}

export function typographyWordKey(item) {
  if (typeof item?.value !== "string") return null;
  return item.value.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
}

export function isComposableToken(item) {
  return COMPOSABLE_TOKEN_FUNCTIONS.includes(item.function);
}
