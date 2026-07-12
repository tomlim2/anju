export const SVG_NS = "http://www.w3.org/2000/svg";
export const EXPORT_SCALE = 2;
export const MIN_VIEWPORT = { width: 900, height: 620 };
export const PADDING_TOKENS = {
  small: { ratio: 0.04, min: 10, max: 24 },
  medium: { ratio: 0.075, min: 16, max: 34 },
  large: { ratio: 0.1, min: 28, max: 64 }
};
export const MARGIN_TOKENS = {
  small: { ratio: 0.018, min: 4, max: 10 },
  medium: { ratio: 0.035, min: 8, max: 18 },
  large: { ratio: 0.06, min: 14, max: 32 }
};
export const TEXT_ALIGNMENTS = { left: "start", center: "middle", right: "end" };
export const TOKEN_ALIGNMENTS = ["left", "center", "right"];
export const TOKEN_VERTICAL_ALIGNMENTS = ["top", "middle", "bottom"];
export const ALLOW_EMPTY_GRID_BLOCKS = false;
export const TOKEN_ORIENTATIONS = ["none", "whole-rotate", "glyph-sideways-stack"];

export const GRID_BLOCK_POLICIES = [
  { footprint: "1x1", width: 1, height: 1, candidatePolicy: "mixed", requestedSizes: null, allowGraphic: true, align: "edge-derived", verticalAlign: "edge-derived", rotation: 0, orientationModes: ["none"], sizeSyncScope: null, xlargeWeight: null },
  { footprint: "2x2", width: 2, height: 2, candidatePolicy: "oversized-typography", requestedSizes: ["xxlarge", "xxxlarge"], allowGraphic: false, align: "edge-derived", verticalAlign: "edge-derived", rotation: 0, orientationModes: ["none"], sizeSyncScope: null, xlargeWeight: null },
  { footprint: "1x2", width: 1, height: 2, candidatePolicy: "mixed", requestedSizes: null, allowGraphic: true, align: "edge-derived", verticalAlign: "edge-derived", rotation: 0, orientationModes: ["none"], sizeSyncScope: null, xlargeWeight: null },
  { footprint: "1x3", width: 1, height: 3, candidatePolicy: "centered-hero", requestedSizes: ["xxlarge"], allowGraphic: false, align: "center", verticalAlign: "middle", rotation: 90, orientationModes: ["whole-rotate", "glyph-sideways-stack"], englishOrientationModes: ["whole-rotate"], sizeSyncScope: "footprint:1x3", xlargeWeight: 900 },
  { footprint: "2x3", width: 2, height: 3, candidatePolicy: "maximum-typography", requestedSizes: ["xxxlarge"], allowGraphic: false, align: "center", verticalAlign: "middle", rotation: 0, orientationModes: ["none"], sizeSyncScope: null, xlargeWeight: 900 },
  { footprint: "2x1", width: 2, height: 1, candidatePolicy: "mixed", requestedSizes: null, allowGraphic: true, align: "edge-derived", verticalAlign: "edge-derived", rotation: 0, orientationModes: ["none"], sizeSyncScope: null, xlargeWeight: null },
  { footprint: "3x1", width: 3, height: 1, candidatePolicy: "centered-hero", requestedSizes: ["xxlarge"], allowGraphic: false, align: "center", verticalAlign: "middle", rotation: 0, orientationModes: ["none"], sizeSyncScope: "footprint:3x1", xlargeWeight: 900 },
  { footprint: "3x2", width: 3, height: 2, candidatePolicy: "maximum-typography", requestedSizes: ["xxxlarge"], allowGraphic: false, align: "center", verticalAlign: "middle", rotation: 0, orientationModes: ["none"], sizeSyncScope: null, xlargeWeight: 900 }
];
export const GRID_BLOCK_POLICY_BY_FOOTPRINT = new Map(
  GRID_BLOCK_POLICIES.map(policy => [policy.footprint, policy])
);
export const GRID_BLOCK_FOOTPRINTS = GRID_BLOCK_POLICIES.map(({ width, height }) => ({ width, height }));
export const CONTEXTUAL_HEAVY_XLARGE_FOOTPRINTS = new Set(
  GRID_BLOCK_POLICIES.filter(policy => policy.xlargeWeight === 900).map(policy => policy.footprint)
);
export const UNIFORM_TYPOGRAPHY_SIZE_FOOTPRINTS = new Set(
  GRID_BLOCK_POLICIES.filter(policy => policy.sizeSyncScope).map(policy => policy.footprint)
);

export const DESIGN_TOKEN_SIZES = {
  small: { rowMode: "pairable", maxPerRow: 2 },
  medium: { rowMode: "single", maxPerRow: 1 },
  large: { rowMode: "exclusive", maxPerRow: 1 },
  xlarge: { rowMode: "exclusive", maxPerRow: 1 },
  xxlarge: { rowMode: "exclusive", maxPerRow: 1 },
  xxxlarge: { rowMode: "exclusive", maxPerRow: 1 }
};
export const DESIGN_TOKEN_SIZE_ORDER = Object.keys(DESIGN_TOKEN_SIZES);
export const TYPOGRAPHY_INTRINSIC_FONT_SIZES = { small: 8, medium: 16, large: 32, xlarge: 64, xxlarge: 128, xxxlarge: 256 };
export const GRAPHIC_TOKEN_SIZES = ["medium", "large"];
export const GRAPHIC_SIZE_SCALE = { medium: 1, large: 1.5 };
export const MAJOR_TOKEN_RULES = { minSize: "large", maxPerLayout: 1 };
export const TOKEN_FORMS = ["typography", "graphic"];
export const TOKEN_FUNCTIONS = ["content", "data", "symbol", "sign"];
export const TOKEN_CONTEXTS = ["component", "primitive-detail", "catalog-ui"];
export const COMPOSABLE_TOKEN_FUNCTIONS = ["content", "data", "symbol"];
export const FONT_WEIGHTS = { normal: 400, bold: 700 };
export const BOLD_TOKEN_SIZES = ["large", "xlarge", "xxlarge", "xxxlarge"];
export const HEAVY_TOKEN_SIZES = ["xxlarge", "xxxlarge"];
export const STROKE_WEIGHTS = { thin: 1.2, thick: 2.4 };
export const ACTIVE_STROKE_WEIGHTS = ["thin"];
export const TOKEN_CATALOG_SECTION_TITLE = { size: 12, height: 32 };
export const COMPOSITION_RULE_GROUPS = [
  {
    label: "TAXONOMY",
    rules: [
      "FORM  TYPOGRAPHY / GRAPHIC",
      "FUNCTION  CONTENT / DATA / SYMBOL / SIGN",
      "CONTEXT  COMPONENT / PRIMITIVE / CATALOG",
      "TYPE  REQUIRES TYPEFACE",
      "BOLD  LARGE / XL / XXL / XXXL CONTENT ONLY",
      "XL@3X1/1X3/3X2/2X3 + XXL/XXXL  WEIGHT 900",
      "SIZE  S 8 / M 16 / L 32 / XL 64 / XXL 128 / XXXL 256",
      "GRAPHIC  MEDIUM / LARGE ONLY"
    ]
  },
  {
    label: "PLACEMENT",
    rules: [
      "SMALL  MAX 2 PER ROW",
      "MEDIUM+  1 PER ROW",
      "LARGE+  MAX 1 PER COMPONENT",
      "ALIGN  LEFT / CENTER / RIGHT",
      "GRID  3X3 / RECT BLOCK PACKING",
      "BLOCK  1X1 TO 3X2 / 1 TOKEN EACH",
      "2X2  XXL / XXXL START",
      "3X1 / 1X3  CENTER MIDDLE / XXL START / 2 VERTICAL MODES",
      "2X3 / 3X2  CENTER MIDDLE / XXXL START",
      "OVERFLOW  NEXT SMALLER SIZE / SCALE 1",
      "SMALLEST FAIL  CELL INDEX FALLBACK",
      "TOKEN  POSITION ONLY / INTRINSIC SIZE",
      "STROKE  THIN ACTIVE / THICK RESERVED",
      "SPIN  NONE / SUBTLE / MEDIUM"
    ]
  },
  {
    label: "COMPOSE",
    rules: [
      "USE  CONTENT / DATA / SYMBOL",
      "SIGN  COMPLETE / EXCLUDED",
      "EMPTY  HIDDEN FROM COMBINATION LIST",
      "COMBINATION  2+ CATEGORIES",
      "SAMPLE  1 PER CATEGORY / SEED",
      "RANDOM  SAMPLES CHANGE / RULES STAY"
    ]
  }
];
export const SPIN_TOKENS = { none: 0, subtle: 1.2, medium: 2.8 };
export const FONT_CSS_PATH = "./fonts/fonts.css";
export const TYPEFACES = {
  english: "\"SUIT\", \"Noto Sans\", Arial, sans-serif",
  mono: "\"Noto Sans Mono\", \"SFMono-Regular\", Menlo, Monaco, Consolas, monospace",
  korean: "\"SUIT\", \"Noto Sans KR\", \"Apple SD Gothic Neo\", sans-serif",
  hanja: "\"Glow Sans SC\", \"Noto Sans SC\", \"Noto Sans KR\", sans-serif",
  chinese: "\"Glow Sans SC\", \"Noto Sans SC\", \"Noto Sans KR\", sans-serif",
  ui: "\"SUIT\", \"Noto Sans\", \"Noto Sans KR\", \"Noto Sans SC\", \"Apple SD Gothic Neo\", sans-serif"
};
export const componentBorderModes = ["stroke", "no-stroke", "corner-stroke"];
export const LAYOUT_GRID = { columns: 3, rows: 3 };
export const GRID_PRIMARY_CHANCE = 1;
export const UNIQUE_GRID_TOKEN_ROLES = ["barcode", "pseudo-qr"];
