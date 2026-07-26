// inkTop/inkBottom are em-normalized ink extents (baseline=0, up positive),
// aggregated over each role's glyph set via scripts/extract-role-ink-metrics.py.
// They let vertical placement snap a token's ink box to a block edge instead of
// using a single hardcoded ascent/descent constant across every script.
export const TYPOGRAPHY_METRIC_DATA = Object.freeze({
  english: Object.freeze({
    400: Object.freeze({ averageAdvance: 0.56, spaceAdvance: 0.28, capHeight: 0.74, inkTop: 0.79, inkBottom: -0.087 }),
    700: Object.freeze({ averageAdvance: 0.59, spaceAdvance: 0.29, capHeight: 0.75, inkTop: 0.81, inkBottom: -0.107 }),
    900: Object.freeze({ averageAdvance: 0.62, spaceAdvance: 0.3, capHeight: 0.76, inkTop: 0.837, inkBottom: -0.134 })
  }),
  korean: Object.freeze({
    400: Object.freeze({ averageAdvance: 0.96, spaceAdvance: 0.32, capHeight: 0.92, inkTop: 0.809, inkBottom: -0.081 }),
    700: Object.freeze({ averageAdvance: 0.98, spaceAdvance: 0.33, capHeight: 0.94, inkTop: 0.817, inkBottom: -0.085 }),
    900: Object.freeze({ averageAdvance: 1, spaceAdvance: 0.34, capHeight: 0.96, inkTop: 0.827, inkBottom: -0.093 })
  }),
  chinese: Object.freeze({
    400: Object.freeze({ averageAdvance: 1, spaceAdvance: 0.32, capHeight: 0.94, inkTop: 0.851, inkBottom: -0.07 }),
    700: Object.freeze({ averageAdvance: 1, spaceAdvance: 0.33, capHeight: 0.96, inkTop: 0.864, inkBottom: -0.096 }),
    900: Object.freeze({ averageAdvance: 1, spaceAdvance: 0.34, capHeight: 0.98, inkTop: 0.873, inkBottom: -0.119 })
  }),
  hanja: Object.freeze({
    400: Object.freeze({ averageAdvance: 1, spaceAdvance: 0.32, capHeight: 0.94, inkTop: 0.851, inkBottom: -0.07 }),
    700: Object.freeze({ averageAdvance: 1, spaceAdvance: 0.33, capHeight: 0.96, inkTop: 0.864, inkBottom: -0.096 }),
    900: Object.freeze({ averageAdvance: 1, spaceAdvance: 0.34, capHeight: 0.98, inkTop: 0.873, inkBottom: -0.119 })
  }),
  mono: Object.freeze({
    400: Object.freeze({ averageAdvance: 0.6, spaceAdvance: 0.6, capHeight: 0.74, inkTop: 0.726, inkBottom: -0.18 }),
    700: Object.freeze({ averageAdvance: 0.61, spaceAdvance: 0.61, capHeight: 0.75, inkTop: 0.726, inkBottom: -0.18 }),
    900: Object.freeze({ averageAdvance: 0.63, spaceAdvance: 0.63, capHeight: 0.76, inkTop: 0.725, inkBottom: -0.18 })
  })
});
