import {
  GRID_BLOCK_FOOTPRINTS,
  GRID_BLOCK_POLICY_BY_FOOTPRINT,
  LAYOUT_GRID
} from "./config.js";
import { marginSize } from "./layout.js";

function footprintName(block) {
  return `${block.width}x${block.height}`;
}

export function gridBlockCells(block) {
  const cells = [];
  for (let row = block.row; row < block.row + block.height; row += 1) {
    for (let column = block.column; column < block.column + block.width; column += 1) {
      cells.push(row * LAYOUT_GRID.columns + column + 1);
    }
  }
  return cells;
}

export function footprintFits(occupied, column, row, footprint) {
  if (column + footprint.width > LAYOUT_GRID.columns || row + footprint.height > LAYOUT_GRID.rows) {
    return false;
  }
  for (let y = row; y < row + footprint.height; y += 1) {
    for (let x = column; x < column + footprint.width; x += 1) {
      if (occupied[y * LAYOUT_GRID.columns + x]) return false;
    }
  }
  return true;
}

function markFootprint(occupied, block, value) {
  gridBlockCells(block).forEach(cellNumber => {
    occupied[cellNumber - 1] = value;
  });
}

export function isXxxlargeFootprint(block) {
  return GRID_BLOCK_POLICY_BY_FOOTPRINT.get(footprintName(block))?.candidatePolicy === "maximum-typography";
}

export function isCenteredXxlargeFootprint(block) {
  return GRID_BLOCK_POLICY_BY_FOOTPRINT.get(footprintName(block))?.candidatePolicy === "centered-hero";
}

export function isOversizedSquareFootprint(block) {
  return GRID_BLOCK_POLICY_BY_FOOTPRINT.get(footprintName(block))?.candidatePolicy === "oversized-typography";
}

export function blockTypographyRotation(block) {
  return GRID_BLOCK_POLICY_BY_FOOTPRINT.get(footprintName(block))?.rotation || 0;
}

export function buildGridBlockLayout(targetCount, footprints = GRID_BLOCK_FOOTPRINTS, randomSource) {
  if (!randomSource) throw new Error("buildGridBlockLayout requires a random source");
  const occupied = Array(LAYOUT_GRID.columns * LAYOUT_GRID.rows).fill(false);
  const blocks = [];

  function search(blocksLeft) {
    const firstOpenIndex = occupied.indexOf(false);
    if (firstOpenIndex === -1) return blocksLeft === 0;
    if (blocksLeft === 0) return false;

    const remainingCells = occupied.filter(value => !value).length;
    if (remainingCells < blocksLeft || remainingCells > blocksLeft * 6) return false;

    const column = firstOpenIndex % LAYOUT_GRID.columns;
    const row = Math.floor(firstOpenIndex / LAYOUT_GRID.columns);
    const idealArea = remainingCells / blocksLeft;
    const candidates = randomSource.shuffled(footprints)
      .filter(footprint => footprintFits(occupied, column, row, footprint))
      .map(footprint => ({
        ...footprint,
        score: Math.abs(footprint.width * footprint.height - idealArea) + randomSource.random() * 2.25
      }))
      .sort((a, b) => a.score - b.score);

    for (const footprint of candidates) {
      const block = {
        column,
        row,
        width: footprint.width,
        height: footprint.height,
        area: footprint.width * footprint.height
      };
      const remainingAfter = remainingCells - block.area;
      if (remainingAfter < blocksLeft - 1 || remainingAfter > (blocksLeft - 1) * 6) continue;

      markFootprint(occupied, block, true);
      blocks.push(block);
      if (search(blocksLeft - 1)) return blocks;
      blocks.pop();
      markFootprint(occupied, block, false);
    }
    return null;
  }

  return search(targetCount);
}

export function gridMetrics(box) {
  const gap = 0;
  return {
    gap,
    columnWidth: (box.width - gap * (LAYOUT_GRID.columns - 1)) / LAYOUT_GRID.columns,
    rowHeight: (box.height - gap * (LAYOUT_GRID.rows - 1)) / LAYOUT_GRID.rows
  };
}

export function gridBlockBox(box, block) {
  const metrics = gridMetrics(box);
  return {
    x: box.x + block.column * (metrics.columnWidth + metrics.gap),
    y: box.y + block.row * (metrics.rowHeight + metrics.gap),
    width: metrics.columnWidth * block.width + metrics.gap * (block.width - 1),
    height: metrics.rowHeight * block.height + metrics.gap * (block.height - 1)
  };
}

export function blockContentBox(box, block) {
  const inset = isXxxlargeFootprint(block) || isCenteredXxlargeFootprint(block) ? 0 : Math.min(
    marginSize(box.width, box.height, "small"),
    box.width * 0.12,
    box.height * 0.12
  );
  return {
    x: box.x + inset,
    y: box.y + inset,
    width: Math.max(1, box.width - inset * 2),
    height: Math.max(1, box.height - inset * 2)
  };
}

export function blockHorizontalAlignment(block) {
  const policy = GRID_BLOCK_POLICY_BY_FOOTPRINT.get(footprintName(block));
  if (policy?.align === "center") return "center";
  if (block.width === LAYOUT_GRID.columns) return "center";
  if (block.column === 0) return "left";
  if (block.column + block.width === LAYOUT_GRID.columns) return "right";
  return "center";
}

export function blockVerticalAlignment(block) {
  const policy = GRID_BLOCK_POLICY_BY_FOOTPRINT.get(footprintName(block));
  if (policy?.verticalAlign === "middle") return "middle";
  if (block.height === LAYOUT_GRID.rows) return "middle";
  if (block.row === 0) return "top";
  if (block.row + block.height === LAYOUT_GRID.rows) return "bottom";
  return "middle";
}

export function layoutGridBlockPosition(box, block) {
  const align = blockHorizontalAlignment(block);
  const verticalAlign = blockVerticalAlignment(block);
  const horizontalAnchorRatio = { left: 0, center: 0.5, right: 1 }[align];
  const verticalAnchorRatio = { top: 0, middle: 0.5, bottom: 1 }[verticalAlign];
  return {
    x: box.x + box.width * horizontalAnchorRatio,
    y: box.y + box.height * verticalAnchorRatio,
    align,
    verticalAlign,
    rotation: blockTypographyRotation(block)
  };
}

export function alignedBoxY(position, tokenHeight) {
  const alignOffset = { top: 0, middle: 0.5, bottom: 1 }[position.verticalAlign];
  return position.y - tokenHeight * alignOffset;
}

export function gridTokenFits(bounds, availableBox) {
  const boundaryTolerance = 0.25;
  return bounds.x >= availableBox.x - boundaryTolerance &&
    bounds.y >= availableBox.y - boundaryTolerance &&
    bounds.x + bounds.width <= availableBox.x + availableBox.width + boundaryTolerance &&
    bounds.y + bounds.height <= availableBox.y + availableBox.height + boundaryTolerance;
}

export function uniformTypographyGroupKey(footprint, requestedSize) {
  return `${footprint}:${requestedSize}`;
}

export const COMPOSITION_BASE_PARTITIONS = Object.freeze({
  2: Object.freeze([[1, 2, 3, 4, 5, 6], [7, 8, 9]]),
  3: Object.freeze([[1, 2, 3], [4, 5, 6], [7, 8, 9]]),
  4: Object.freeze([[1, 2, 4, 5], [3], [6], [7, 8, 9]]),
  5: Object.freeze([[1, 2, 4, 5], [3], [6], [7, 8], [9]])
});

function transformCell(cell, transformIndex) {
  const row = Math.floor((cell - 1) / 3);
  const column = (cell - 1) % 3;
  const transforms = [
    [row, column],
    [column, 2 - row],
    [2 - row, 2 - column],
    [2 - column, row],
    [row, 2 - column],
    [2 - row, column],
    [column, row],
    [2 - column, 2 - row]
  ];
  const [nextRow, nextColumn] = transforms[transformIndex];
  return nextRow * 3 + nextColumn + 1;
}

function blockFromCells(cells, slotInstanceId) {
  const sortedCells = [...cells].sort((a, b) => a - b);
  const rows = sortedCells.map(cell => Math.floor((cell - 1) / 3));
  const columns = sortedCells.map(cell => (cell - 1) % 3);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minColumn = Math.min(...columns);
  const maxColumn = Math.max(...columns);
  const width = maxColumn - minColumn + 1;
  const height = maxRow - minRow + 1;
  if (width * height !== sortedCells.length) throw new Error("composition block must be rectangular");
  return Object.freeze({
    footprint: `${width}x${height}`,
    cells: Object.freeze(sortedCells),
    slotInstanceId
  });
}

export function enumerateCanonicalLayouts(slotInstanceIds) {
  if (!Array.isArray(slotInstanceIds) || slotInstanceIds.length < 2 || slotInstanceIds.length > 5) {
    throw new TypeError("canonical layouts require 2-5 slot instance IDs");
  }
  if (new Set(slotInstanceIds).size !== slotInstanceIds.length) {
    throw new Error("canonical layout slot IDs must be unique");
  }
  const base = COMPOSITION_BASE_PARTITIONS[slotInstanceIds.length];
  const partitions = new Map();
  for (let transformIndex = 0; transformIndex < 4; transformIndex += 1) {
    const transformed = base
      .map(cells => cells.map(cell => transformCell(cell, transformIndex)).sort((a, b) => a - b))
      .sort((left, right) => left[0] - right[0] || left.length - right.length);
    const partitionKey = transformed.map(cells => cells.join(".")).join("|");
    partitions.set(partitionKey, transformed);
  }

  const layouts = [];
  for (const [partitionKey, partition] of [...partitions.entries()].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0
  )) {
    for (let offset = 0; offset < slotInstanceIds.length; offset += 1) {
      const blocks = partition.map((cells, blockIndex) => blockFromCells(
        cells,
        slotInstanceIds[(blockIndex + offset) % slotInstanceIds.length]
      ));
      layouts.push(Object.freeze({
        layoutKey: `layout:${slotInstanceIds.length}:${partitionKey}:${offset}`,
        blocks: Object.freeze(blocks)
      }));
    }
  }
  return Object.freeze(layouts);
}

export function compositionBlockGeometry(safeBox, cells) {
  if (!Array.isArray(cells) || cells.length === 0) throw new TypeError("composition block cells are required");
  const rows = cells.map(cell => Math.floor((cell - 1) / 3));
  const columns = cells.map(cell => (cell - 1) % 3);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minColumn = Math.min(...columns);
  const maxColumn = Math.max(...columns);
  const block = {
    row: minRow,
    column: minColumn,
    width: maxColumn - minColumn + 1,
    height: maxRow - minRow + 1
  };
  if (block.width * block.height !== cells.length) throw new Error("composition cells are not rectangular");
  const outerBox = gridBlockBox(safeBox, block);
  return Object.freeze({
    block: Object.freeze({ ...block, cells: Object.freeze([...cells].sort((a, b) => a - b)) }),
    outerBox: Object.freeze(outerBox),
    contentBox: Object.freeze(blockContentBox(outerBox, block)),
    alignment: blockHorizontalAlignment(block),
    verticalAlignment: blockVerticalAlignment(block)
  });
}
