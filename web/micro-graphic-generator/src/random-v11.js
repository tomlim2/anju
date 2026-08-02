// RANDOM V1.1 — a rule-free generator family.
// Ignores the recipe/planner/validator stack entirely and draws seeded
// ink-on-paper pieces directly. Each press picks one visual family, so every
// click is a genuinely new picture while the series shares one ink language:
//   PLATE   recursive golden-section partition filled from an ink vocabulary
//   RIDGE   stacked interference ridgelines with paper occlusion
//   FLOW    streamlines advected through a seeded curl field
//   TRUCHET quarter-arc circuit tiles with inverted islands
//   ORBIT   technical orbit chart — rings, ticks, satellites, one bold chord
import { createRandomSource } from "./random.js";
import { make } from "./svg.js";

const PHI = (1 + Math.sqrt(5)) / 2;
const INK = "currentColor";
const PAPER = "var(--bg)";
const TWO_PI = Math.PI * 2;

const HANGUL_WORDS = ["신호", "흐름", "정지", "회전", "발신", "잡음"];
const HAN_GLYPHS = ["回", "波", "光", "無", "流", "空"];
const LATIN_GLYPHS = ["K", "R", "N", "A", "4", "7", "0"];

function monoLabel(x, y, text, anchor = "end", size = 10) {
  return make("text", {
    x,
    y,
    "text-anchor": anchor,
    "font-family": "Noto Sans Mono",
    "font-weight": 700,
    "font-size": size,
    fill: INK
  }, [document.createTextNode(text)]);
}

function platePath(plate) {
  return make("rect", {
    x: plate.x, y: plate.y, width: plate.width, height: plate.height,
    fill: "none", stroke: INK, "stroke-width": 1.2
  });
}

function fitPlate(viewBox, ratio, scale = 0.78) {
  let width = viewBox.width * scale;
  let height = width * ratio.h / ratio.w;
  if (height > viewBox.height * scale) {
    height = viewBox.height * scale;
    width = height * ratio.w / ratio.h;
  }
  return {
    x: viewBox.x + (viewBox.width - width) / 2,
    y: viewBox.y + (viewBox.height - height) / 2,
    width,
    height
  };
}

// ---------------------------------------------------------------------------
// family: PLATE — recursive golden-section partition

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

function insetCell(cell, amount) {
  return {
    x: cell.x + amount,
    y: cell.y + amount,
    width: Math.max(1, cell.width - amount * 2),
    height: Math.max(1, cell.height - amount * 2)
  };
}

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
      cx, cy, r: maxRadius * index / rings,
      fill: "none", stroke: INK, "stroke-width": weight
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
      cx, cy, r: radius * random.range(0.12, 0.3), fill: inverted ? INK : PAPER
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
      fill: "none", stroke: ink, "stroke-width": random.pick([5, 8, 12])
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
      group.appendChild(make("circle", {
        cx: cell.x + column * stepX + stepX / 2,
        cy: cell.y + row * stepY + stepY / 2,
        r: Math.min(stepX, stepY) * 0.42 * (0.15 + strength * 0.85),
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
  group.appendChild(monoLabel(
    cell.x + cell.width - 4,
    cell.y + cell.height - 6,
    String(random.integer(0, 999)).padStart(3, "0")
  ));
}

function paintDiagonal(group, cell, random) {
  const rising = random.chance(0.5);
  const x1 = cell.x;
  const x2 = cell.x + cell.width;
  const y1 = rising ? cell.y + cell.height : cell.y;
  const y2 = rising ? cell.y : cell.y + cell.height;
  group.appendChild(make("line", { x1, y1, x2, y2, stroke: INK, "stroke-width": random.pick([5, 9]) }));
}

function paintInverted(group, cell, random) {
  group.appendChild(make("rect", {
    x: cell.x, y: cell.y, width: cell.width, height: cell.height, fill: INK
  }));
  random.pick([paintGlyph, paintDisc, paintQuarterArc, paintStripes])(group, cell, random, { inverted: true });
}

function renderPlate(group, viewBox, random) {
  const plate = fitPlate(viewBox, random.pick([{ w: 1, h: 1 }, { w: 1, h: PHI }, { w: PHI, h: 1 }]));
  group.appendChild(make("rect", {
    x: plate.x, y: plate.y, width: plate.width, height: plate.height, fill: PAPER
  }));
  const cells = partitionPlate(plate, random.integer(4, 7), random);
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
  group.appendChild(platePath(plate));
  return `PLATE / ${cells.length} CELLS`;
}

// ---------------------------------------------------------------------------
// family: RIDGE — stacked interference ridgelines with paper occlusion

function renderRidge(group, viewBox, random) {
  const plate = fitPlate(viewBox, random.pick([{ w: 1, h: 1 }, { w: PHI, h: 1 }, { w: 1, h: PHI }]), 0.8);
  group.appendChild(make("rect", {
    x: plate.x, y: plate.y, width: plate.width, height: plate.height, fill: PAPER
  }));
  const rows = random.integer(26, 46);
  const samples = 130;
  const margin = plate.width * 0.06;
  const bumps = Array.from({ length: random.integer(2, 4) }, () => ({
    center: random.range(0.2, 0.8),
    width: random.range(0.05, 0.16),
    height: random.range(0.5, 1)
  }));
  const waves = Array.from({ length: 2 }, () => ({
    frequency: random.range(2, 7),
    phase: random.range(0, TWO_PI),
    amplitude: random.range(0.04, 0.14)
  }));
  const amplitude = plate.height / rows * random.range(3.5, 7);
  const rowStep = plate.height / (rows + 1);
  for (let row = 0; row < rows; row += 1) {
    // envelope keeps the storm in the middle rows and calm at both ends
    const envelope = Math.sin((row / (rows - 1)) * Math.PI) ** 2;
    const baseY = plate.y + rowStep * (row + 1);
    const points = [];
    for (let index = 0; index <= samples; index += 1) {
      const t = index / samples;
      const x = plate.x + margin + t * (plate.width - margin * 2);
      let lift = 0;
      for (const bump of bumps) {
        const distance = (t - bump.center) / bump.width;
        lift += bump.height * Math.exp(-distance * distance);
      }
      for (const wave of waves) {
        lift += wave.amplitude * Math.sin(t * wave.frequency * TWO_PI + wave.phase + row * 0.25);
      }
      // per-point jitter keeps the line hand-drawn instead of mathematical
      lift += random.range(-0.02, 0.02);
      points.push([x, baseY - Math.max(-0.2, lift) * amplitude * envelope]);
    }
    const top = points.map(point => point.join(",")).join(" ");
    const first = points[0];
    const last = points[points.length - 1];
    // paper fill occludes the rows behind — the classic pulsar trick
    group.appendChild(make("polygon", {
      points: `${top} ${last[0]},${plate.y + plate.height} ${first[0]},${plate.y + plate.height}`,
      fill: PAPER,
      stroke: "none"
    }));
    group.appendChild(make("polyline", {
      points: top,
      fill: "none",
      stroke: INK,
      "stroke-width": 1.6,
      "stroke-linejoin": "round"
    }));
  }
  if (random.chance(0.5)) {
    group.appendChild(monoLabel(plate.x + plate.width - 8, plate.y + plate.height - 10,
      `CH-${String(random.integer(0, 99)).padStart(2, "0")}`));
  }
  group.appendChild(platePath(plate));
  return `RIDGE / ${rows} ROWS`;
}

// ---------------------------------------------------------------------------
// family: FLOW — streamlines through a seeded curl field

function renderFlow(group, viewBox, random) {
  const plate = fitPlate(viewBox, random.pick([{ w: 1, h: 1 }, { w: PHI, h: 1 }]), 0.8);
  group.appendChild(make("rect", {
    x: plate.x, y: plate.y, width: plate.width, height: plate.height, fill: PAPER
  }));
  // angle field: bilinear interpolation over a coarse grid of seeded headings,
  // plus a swirl around a seeded pole so the lines have somewhere to go
  const grid = 5;
  const headings = Array.from({ length: (grid + 1) * (grid + 1) }, () => random.range(0, TWO_PI));
  const pole = {
    x: random.range(0.25, 0.75),
    y: random.range(0.25, 0.75),
    spin: random.pick([-1, 1]) * random.range(0.8, 1.8)
  };
  function fieldAngle(nx, ny) {
    const gx = Math.min(grid - 0.0001, nx * grid);
    const gy = Math.min(grid - 0.0001, ny * grid);
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const at = (x, y) => headings[y * (grid + 1) + x];
    const base = at(x0, y0) * (1 - fx) * (1 - fy)
      + at(x0 + 1, y0) * fx * (1 - fy)
      + at(x0, y0 + 1) * (1 - fx) * fy
      + at(x0 + 1, y0 + 1) * fx * fy;
    const swirl = Math.atan2(ny - pole.y, nx - pole.x) + Math.PI / 2 * pole.spin;
    return base * 0.45 + swirl * 0.55;
  }
  const lines = random.integer(140, 220);
  const stepLength = Math.min(plate.width, plate.height) / 90;
  for (let index = 0; index < lines; index += 1) {
    let nx = random.range(0.02, 0.98);
    let ny = random.range(0.02, 0.98);
    const points = [];
    const steps = random.integer(14, 44);
    for (let step = 0; step < steps; step += 1) {
      points.push([plate.x + nx * plate.width, plate.y + ny * plate.height]);
      const angle = fieldAngle(nx, ny);
      nx += Math.cos(angle) * stepLength / plate.width;
      ny += Math.sin(angle) * stepLength / plate.height;
      if (nx < 0.01 || nx > 0.99 || ny < 0.01 || ny > 0.99) break;
    }
    if (points.length < 3) continue;
    group.appendChild(make("polyline", {
      points: points.map(point => `${point[0]},${point[1]}`).join(" "),
      fill: "none",
      stroke: INK,
      "stroke-width": random.pick([1.2, 1.2, 2.4, 4]),
      "stroke-linecap": "round"
    }));
  }
  // the pole made visible: one solid disc holds the composition down
  if (random.chance(0.7)) {
    group.appendChild(make("circle", {
      cx: plate.x + pole.x * plate.width,
      cy: plate.y + pole.y * plate.height,
      r: Math.min(plate.width, plate.height) * random.range(0.04, 0.09),
      fill: INK
    }));
  }
  group.appendChild(platePath(plate));
  return `FLOW / ${lines} LINES`;
}

// ---------------------------------------------------------------------------
// family: TRUCHET — quarter-arc circuit tiles

function renderTruchet(group, viewBox, random) {
  const plate = fitPlate(viewBox, { w: 1, h: 1 }, 0.8);
  group.appendChild(make("rect", {
    x: plate.x, y: plate.y, width: plate.width, height: plate.height, fill: PAPER
  }));
  const tiles = random.integer(7, 12);
  const size = plate.width / tiles;
  const weight = random.pick([size * 0.16, size * 0.28]);
  for (let row = 0; row < tiles; row += 1) {
    for (let column = 0; column < tiles; column += 1) {
      const x = plate.x + column * size;
      const y = plate.y + row * size;
      if (random.chance(0.06)) {
        // inverted island: solid tile with a paper arc punched through
        group.appendChild(make("rect", { x, y, width: size, height: size, fill: INK }));
        const flip = random.chance(0.5);
        group.appendChild(make("path", {
          d: flip
            ? `M ${x + size / 2} ${y} A ${size / 2} ${size / 2} 0 0 1 ${x + size} ${y + size / 2}`
            : `M ${x} ${y + size / 2} A ${size / 2} ${size / 2} 0 0 1 ${x + size / 2} ${y}`,
          fill: "none", stroke: PAPER, "stroke-width": weight
        }));
        continue;
      }
      const flip = random.chance(0.5);
      const radius = size / 2;
      const arcs = flip
        ? [
          `M ${x + radius} ${y} A ${radius} ${radius} 0 0 0 ${x} ${y + radius}`,
          `M ${x + size} ${y + radius} A ${radius} ${radius} 0 0 0 ${x + radius} ${y + size}`
        ]
        : [
          `M ${x + radius} ${y} A ${radius} ${radius} 0 0 1 ${x + size} ${y + radius}`,
          `M ${x} ${y + radius} A ${radius} ${radius} 0 0 1 ${x + radius} ${y + size}`
        ];
      for (const d of arcs) {
        group.appendChild(make("path", { d, fill: "none", stroke: INK, "stroke-width": weight }));
      }
    }
  }
  group.appendChild(platePath(plate));
  return `TRUCHET / ${tiles}x${tiles}`;
}

// ---------------------------------------------------------------------------
// family: ORBIT — technical orbit chart

function renderOrbit(group, viewBox, random) {
  const plate = fitPlate(viewBox, { w: 1, h: 1 }, 0.8);
  group.appendChild(make("rect", {
    x: plate.x, y: plate.y, width: plate.width, height: plate.height, fill: PAPER
  }));
  const cx = plate.x + plate.width / 2;
  const cy = plate.y + plate.height / 2;
  const maxRadius = Math.min(plate.width, plate.height) * 0.44;
  const rings = random.integer(5, 8);
  for (let index = 1; index <= rings; index += 1) {
    const radius = maxRadius * index / rings;
    const style = random.pick(["thin", "thick", "dashed", "ticks", "dotted"]);
    if (style === "ticks") {
      const count = 12 + index * 6;
      for (let tick = 0; tick < count; tick += 1) {
        const angle = tick / count * TWO_PI;
        const reach = maxRadius / rings * 0.28;
        group.appendChild(make("line", {
          x1: cx + Math.cos(angle) * (radius - reach),
          y1: cy + Math.sin(angle) * (radius - reach),
          x2: cx + Math.cos(angle) * radius,
          y2: cy + Math.sin(angle) * radius,
          stroke: INK, "stroke-width": 1.2
        }));
      }
    } else if (style === "dotted") {
      const count = 10 + index * 8;
      for (let dot = 0; dot < count; dot += 1) {
        const angle = dot / count * TWO_PI;
        group.appendChild(make("circle", {
          cx: cx + Math.cos(angle) * radius,
          cy: cy + Math.sin(angle) * radius,
          r: 1.6,
          fill: INK
        }));
      }
    } else {
      group.appendChild(make("circle", {
        cx, cy, r: radius,
        fill: "none",
        stroke: INK,
        "stroke-width": style === "thick" ? 5 : 1.2,
        "stroke-dasharray": style === "dashed" ? "2 8" : null
      }));
    }
  }
  const satellites = random.integer(1, 3);
  for (let index = 0; index < satellites; index += 1) {
    const radius = maxRadius * random.integer(2, rings) / rings;
    const angle = random.range(0, TWO_PI);
    const sx = cx + Math.cos(angle) * radius;
    const sy = cy + Math.sin(angle) * radius;
    group.appendChild(make("circle", { cx: sx, cy: sy, r: random.range(5, 11), fill: INK }));
    if (random.chance(0.6)) {
      group.appendChild(monoLabel(sx + 14, sy + 4,
        `S${String(random.integer(1, 99)).padStart(2, "0")}`, "start"));
    }
  }
  if (random.chance(0.6)) {
    const angle = random.range(0, TWO_PI);
    group.appendChild(make("line", {
      x1: cx - Math.cos(angle) * maxRadius,
      y1: cy - Math.sin(angle) * maxRadius,
      x2: cx + Math.cos(angle) * maxRadius,
      y2: cy + Math.sin(angle) * maxRadius,
      stroke: INK, "stroke-width": random.pick([5, 9])
    }));
  }
  if (random.chance(0.5)) {
    group.appendChild(make("circle", { cx, cy, r: maxRadius * 0.05, fill: INK }));
  }
  group.appendChild(platePath(plate));
  return `ORBIT / ${rings} RINGS`;
}

// ---------------------------------------------------------------------------

const FAMILIES = [renderPlate, renderRidge, renderFlow, renderTruchet, renderOrbit];

export function renderRandomV11(art, seed, viewBox) {
  const random = createRandomSource(seed);
  const group = make("g", { "data-random-v11": "piece" });
  const label = random.pick(FAMILIES)(group, viewBox, random);
  art.replaceChildren(group);
  return { label };
}
