// RANDOM V1.1 — "φ plate" generator.
// A deliberately rule-free sibling of the composition engine: it ignores the
// recipe/planner/validator stack and draws a small ink-on-paper pattern plate
// directly. Structure comes from one idea only — recursive golden-section
// partition — so every piece shares a family resemblance without a rulebook.
import { createRandomSource } from "./random.js";
import { make } from "./svg.js";

const PHI = (1 + Math.sqrt(5)) / 2;
const INK = "currentColor";
const PAPER = "var(--bg)";

const PLATE_RATIOS = [
  { w: 1, h: 1 },
  { w: 1, h: PHI },
  { w: PHI, h: 1 }
];

const HANGUL_WORDS = ["신호", "흐름", "정지", "회전", "발신", "잡음"];
const HAN_GLYPHS = ["回", "波", "光", "無", "流", "空"];
const LATIN_GLYPHS = ["K", "R", "N", "A", "4", "7", "0"];

// ---------------------------------------------------------------------------
// partition

function splitGolden(rect, flip) {
  const horizontal = rect.width >= rect.height;
  if (horizontal) {
    const a = rect.width / PHI;
    const left = { ...rect, width: flip ? rect.width - a : a };
    const right = { ...rect, x: rect.x + left.width, width: rect.width - left.width };
    return [left, right];
  }
  const a = rect.height / PHI;
  const top = { ...rect, height: flip ? rect.height - a : a };
  const bottom = { ...rect, y: rect.y + top.height, height: rect.height - top.height };
  return [top, bottom];
}

function partitionPlate(plate, splits, random) {
  const cells = [{ ...plate }];
  for (let index = 0; index < splits; index += 1) {
    cells.sort((left, right) => right.width * right.height - left.width * left.height);
    const target = cells.shift();
    cells.push(...splitGolden(target, random.chance(0.4)));
  }
  return cells;
}

// ---------------------------------------------------------------------------
// cell vocabulary — every painter draws one cell's worth of ink

function paintGlyph(group, cell, random, { inverted = false } = {}) {
  const script = random.pick(["hangul", "han", "latin"]);
  const value = script === "hangul"
    ? random.pick(HANGUL_WORDS)
    : script === "han" ? random.pick(HAN_GLYPHS) : random.pick(LATIN_GLYPHS);
  const family = script === "han" ? "Noto Sans SC" : "SUIT";
  const size = Math.min(cell.height * 0.72, (cell.width * 0.86) / Math.max(1, value.length * 0.96));
  group.appendChild(make("text", {
    x: cell.x + cell.width / 2,
    y: cell.y + cell.height / 2,
    "text-anchor": "middle",
    "dominant-baseline": "central",
    "font-family": family,
    "font-weight": 900,
    "font-size": size,
    fill: inverted ? PAPER : INK
  }, [document.createTextNode(value)]));
}

function paintRings(group, cell, random) {
  const cx = cell.x + cell.width / 2;
  const cy = cell.y + cell.height / 2;
  const maxRadius = Math.min(cell.width, cell.height) * 0.44;
  const rings = random.integer(3, 5);
  const weight = random.pick([2.4, 5, 8]);
  for (let index = 1; index <= rings; index += 1) {
    group.appendChild(make("circle", {
      cx,
      cy,
      r: maxRadius * index / rings,
      fill: "none",
      stroke: INK,
      "stroke-width": weight
    }));
  }
}

function paintDisc(group, cell, random, { inverted = false } = {}) {
  const cx = cell.x + cell.width / 2;
  const cy = cell.y + cell.height / 2;
  const radius = Math.min(cell.width, cell.height) * 0.42;
  group.appendChild(make("circle", { cx, cy, r: radius, fill: inverted ? PAPER : INK }));
  if (random.chance(0.5)) {
    group.appendChild(make("circle", {
      cx,
      cy,
      r: radius * random.range(0.12, 0.3),
      fill: inverted ? INK : PAPER
    }));
  }
}

function paintQuarterArc(group, cell, random, { inverted = false } = {}) {
  const corner = random.integer(0, 3);
  const cx = corner % 2 === 0 ? cell.x : cell.x + cell.width;
  const cy = corner < 2 ? cell.y : cell.y + cell.height;
  const radius = Math.min(cell.width, cell.height);
  const sx = corner % 2 === 0 ? cx + radius : cx - radius;
  const ey = corner < 2 ? cy + radius : cy - radius;
  const sweep = (corner === 0 || corner === 3) ? 1 : 0;
  const ink = inverted ? PAPER : INK;
  if (random.chance(0.45)) {
    group.appendChild(make("path", {
      d: `M ${cx} ${cy} L ${sx} ${cy} A ${radius} ${radius} 0 0 ${sweep} ${cx} ${ey} Z`,
      fill: ink
    }));
  } else {
    group.appendChild(make("path", {
      d: `M ${sx} ${cy} A ${radius} ${radius} 0 0 ${sweep} ${cx} ${ey}`,
      fill: "none",
      stroke: ink,
      "stroke-width": random.pick([5, 8, 12])
    }));
  }
}

function paintDotFade(group, cell, random) {
  const across = random.chance(0.5);
  const columns = Math.max(4, Math.round(cell.width / 22));
  const rows = Math.max(4, Math.round(cell.height / 22));
  const stepX = cell.width / columns;
  const stepY = cell.height / rows;
  const flip = random.chance(0.5);
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const progress = across ? column / (columns - 1 || 1) : row / (rows - 1 || 1);
      const strength = flip ? 1 - progress : progress;
      const radius = Math.min(stepX, stepY) * 0.42 * (0.15 + strength * 0.85);
      group.appendChild(make("circle", {
        cx: cell.x + column * stepX + stepX / 2,
        cy: cell.y + row * stepY + stepY / 2,
        r: radius,
        fill: INK
      }));
    }
  }
}

function paintStripes(group, cell, random, { inverted = false } = {}) {
  const horizontal = cell.width < cell.height;
  const length = horizontal ? cell.height : cell.width;
  const bars = random.integer(3, 6);
  const period = length / bars;
  const duty = random.range(0.34, 0.62);
  const ink = inverted ? PAPER : INK;
  for (let index = 0; index < bars; index += 1) {
    const start = index * period;
    const thickness = period * duty;
    group.appendChild(horizontal
      ? make("rect", { x: cell.x, y: cell.y + start, width: cell.width, height: thickness, fill: ink })
      : make("rect", { x: cell.x + start, y: cell.y, width: thickness, height: cell.height, fill: ink }));
  }
}

function paintRuler(group, cell, random) {
  const alongTop = cell.width >= cell.height;
  const ticks = Math.max(5, Math.round((alongTop ? cell.width : cell.height) / 18));
  const step = (alongTop ? cell.width : cell.height) / ticks;
  for (let index = 0; index <= ticks; index += 1) {
    const major = index % 5 === 0;
    const reach = (alongTop ? cell.height : cell.width) * (major ? 0.34 : 0.16);
    group.appendChild(alongTop
      ? make("line", {
        x1: cell.x + index * step, y1: cell.y,
        x2: cell.x + index * step, y2: cell.y + reach,
        stroke: INK, "stroke-width": major ? 2.4 : 1.2
      })
      : make("line", {
        x1: cell.x, y1: cell.y + index * step,
        x2: cell.x + reach, y2: cell.y + index * step,
        stroke: INK, "stroke-width": major ? 2.4 : 1.2
      }));
  }
  group.appendChild(make("text", {
    x: cell.x + cell.width - 4,
    y: cell.y + cell.height - 6,
    "text-anchor": "end",
    "font-family": "Noto Sans Mono",
    "font-weight": 700,
    "font-size": 10,
    fill: INK
  }, [document.createTextNode(String(random.integer(0, 999)).padStart(3, "0"))]));
}

function paintDiagonal(group, cell, random) {
  const rising = random.chance(0.5);
  const x1 = cell.x;
  const x2 = cell.x + cell.width;
  const y1 = rising ? cell.y + cell.height : cell.y;
  const y2 = rising ? cell.y : cell.y + cell.height;
  group.appendChild(make("line", { x1, y1, x2, y2, stroke: INK, "stroke-width": random.pick([5, 9]) }));
  if (random.chance(0.5)) {
    const offset = Math.min(cell.width, cell.height) * 0.14;
    group.appendChild(make("line", {
      x1: x1 + offset, y1: y1 + (rising ? -offset : offset),
      x2: x2 + offset, y2: y2 + (rising ? -offset : offset),
      stroke: INK, "stroke-width": 1.2
    }));
  }
}

// ---------------------------------------------------------------------------
// plate assembly

function paintInverted(group, cell, random) {
  group.appendChild(make("rect", {
    x: cell.x, y: cell.y, width: cell.width, height: cell.height, fill: INK
  }));
  const knockout = random.pick([paintGlyph, paintDisc, paintQuarterArc, paintStripes]);
  knockout(group, insetCell(cell, 0), random, { inverted: true });
}

function insetCell(cell, amount) {
  return {
    x: cell.x + amount,
    y: cell.y + amount,
    width: Math.max(1, cell.width - amount * 2),
    height: Math.max(1, cell.height - amount * 2)
  };
}

export function renderRandomV11(art, seed, viewBox) {
  const random = createRandomSource(seed);
  const ratio = random.pick(PLATE_RATIOS);
  const scale = 0.78;
  let plateWidth = viewBox.width * scale;
  let plateHeight = plateWidth * ratio.h / ratio.w;
  if (plateHeight > viewBox.height * scale) {
    plateHeight = viewBox.height * scale;
    plateWidth = plateHeight * ratio.w / ratio.h;
  }
  const plate = {
    x: viewBox.x + (viewBox.width - plateWidth) / 2,
    y: viewBox.y + (viewBox.height - plateHeight) / 2,
    width: plateWidth,
    height: plateHeight
  };

  const group = make("g", { "data-random-v11": "plate" });
  group.appendChild(make("rect", {
    x: plate.x, y: plate.y, width: plate.width, height: plate.height, fill: PAPER
  }));

  const cells = partitionPlate(plate, random.integer(4, 7), random);

  // The largest cell anchors the piece; inversions are rationed so the plate
  // keeps one clear focal point instead of turning into a checkerboard.
  let inversionsLeft = random.integer(1, 2);
  const painters = [paintGlyph, paintRings, paintDisc, paintQuarterArc, paintDotFade, paintStripes, paintRuler, paintDiagonal];
  cells.sort((left, right) => right.width * right.height - left.width * left.height);
  cells.forEach((cell, index) => {
    const inner = insetCell(cell, Math.min(cell.width, cell.height) * 0.08);
    if (index === 0) {
      if (random.chance(0.45) && inversionsLeft > 0) {
        inversionsLeft -= 1;
        paintInverted(group, cell, random);
      } else {
        random.pick([paintGlyph, paintDisc, paintQuarterArc])(group, inner, random);
      }
      return;
    }
    if (inversionsLeft > 0 && random.chance(0.22)) {
      inversionsLeft -= 1;
      paintInverted(group, cell, random);
      return;
    }
    if (random.chance(0.14)) return; // deliberate paper — negative space is vocabulary too
    random.pick(painters)(group, inner, random);
  });

  // One hairline pulled across the whole plate ties the fragments together.
  if (random.chance(0.6) && cells.length > 1) {
    const edge = cells[random.integer(1, cells.length - 1)];
    const vertical = random.chance(0.5);
    group.appendChild(vertical
      ? make("line", { x1: edge.x, y1: plate.y, x2: edge.x, y2: plate.y + plate.height, stroke: INK, "stroke-width": 1.2 })
      : make("line", { x1: plate.x, y1: edge.y, x2: plate.x + plate.width, y2: edge.y, stroke: INK, "stroke-width": 1.2 }));
  }

  group.appendChild(make("rect", {
    x: plate.x, y: plate.y, width: plate.width, height: plate.height,
    fill: "none", stroke: INK, "stroke-width": 1.2
  }));

  art.replaceChildren(group);
  return { cellCount: cells.length, ratio: ratio.w === ratio.h ? "1:1" : ratio.w > 1 ? "φ:1" : "1:φ" };
}
