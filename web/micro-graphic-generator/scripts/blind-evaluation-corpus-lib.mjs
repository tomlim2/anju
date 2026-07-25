import { hashCanonical } from "../src/canonical-hash.js";

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function rowStratumId(row) {
  if (typeof row.stratumId === "string") return row.stratumId;
  if (row.stratum) {
    return `${row.stratum.recipeId}/${row.stratum.heroLanguage}/${row.stratum.heroScript}`;
  }
  throw new Error("blind presentation row has no stratum identity");
}

function rowVisualCellId(row) {
  if (Object.prototype.hasOwnProperty.call(row, "visualCellId")) return row.visualCellId;
  if (row.visualHierarchyCell === null) return null;
  if (row.visualHierarchyCell) {
    return `${row.visualHierarchyCell.motifId}/${row.visualHierarchyCell.heroFinalizationClass}`;
  }
  throw new Error("blind presentation row has no visual-cell identity");
}

function presentationGroupId(row) {
  return rowVisualCellId(row) || `linguistic/${rowStratumId(row)}`;
}

function maximumRun(rows, idForRow) {
  let previous = null;
  let current = 0;
  let maximum = 0;
  for (const row of rows) {
    const id = idForRow(row);
    current = id === previous ? current + 1 : 1;
    previous = id;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

export function blindPresentationRunSummary(rows) {
  return Object.freeze({
    maximumGroupRun: maximumRun(rows, presentationGroupId),
    maximumStratumRun: maximumRun(rows, rowStratumId)
  });
}

function presentationBuckets(rows) {
  const buckets = new Map();
  for (const row of rows) {
    const groupId = presentationGroupId(row);
    const stratumId = rowStratumId(row);
    const key = `${groupId}\u0000${stratumId}`;
    if (!buckets.has(key)) buckets.set(key, { key, groupId, stratumId, rows: [], remaining: 0 });
    buckets.get(key).rows.push({
      row,
      orderKey: hashCanonical({ schemaVersion: 1, purpose: "blind-presentation-order", seed: row.seed })
    });
  }
  return [...buckets.values()]
    .map(bucket => {
      bucket.rows.sort((left, right) =>
        compareStrings(left.orderKey, right.orderKey) || left.row.seed - right.row.seed
      );
      bucket.remaining = bucket.rows.length;
      return bucket;
    })
    .sort((left, right) => compareStrings(left.key, right.key));
}

function remainingCountBy(buckets, field) {
  const counts = new Map();
  buckets.forEach(bucket => increment(counts, bucket[field], bucket.remaining));
  return counts;
}

function categoryCapacity(categoryId, remainingTotal, lastId, lastRun, maximumRunLength) {
  const otherRemaining = remainingTotal;
  const initialCapacity = categoryId === lastId
    ? maximumRunLength - lastRun
    : maximumRunLength;
  return initialCapacity + maximumRunLength * otherRemaining;
}

function categoriesRemainSchedulable(counts, remainingTotal, lastId, lastRun, maximumRunLength) {
  for (const [categoryId, count] of counts) {
    const otherRemaining = remainingTotal - count;
    if (count > categoryCapacity(
      categoryId,
      otherRemaining,
      lastId,
      lastRun,
      maximumRunLength
    )) return false;
  }
  return true;
}

function maximumCategoryPressure(counts, remainingTotal, lastId, lastRun, maximumRunLength) {
  let maximum = 0;
  for (const [categoryId, count] of counts) {
    if (count === 0) continue;
    const capacity = categoryCapacity(
      categoryId,
      remainingTotal - count,
      lastId,
      lastRun,
      maximumRunLength
    );
    maximum = Math.max(maximum, capacity > 0 ? count / capacity : Number.POSITIVE_INFINITY);
  }
  return maximum;
}

export function interleaveBlindPresentation(rows, { maximumRunLength = 2 } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new TypeError("blind presentation interleave requires rows");
  }
  if (!Number.isInteger(maximumRunLength) || maximumRunLength < 1) {
    throw new TypeError("maximum presentation run must be a positive integer");
  }
  assertUniqueSeeds(rows);
  const buckets = presentationBuckets(rows);
  const groupRemaining = remainingCountBy(buckets, "groupId");
  const stratumRemaining = remainingCountBy(buckets, "stratumId");
  const ordered = [];
  const failedStates = new Set();

  function visit(remainingTotal, lastGroupId, groupRun, lastStratumId, stratumRun) {
    if (remainingTotal === 0) return true;
    const stateKey = `${buckets.map(bucket => bucket.remaining).join(",")}`
      + `|${lastGroupId || ""}:${groupRun}|${lastStratumId || ""}:${stratumRun}`;
    if (failedStates.has(stateKey)) return false;
    const candidates = [];
    for (const bucket of buckets) {
      if (bucket.remaining === 0) continue;
      if (bucket.groupId === lastGroupId && groupRun === maximumRunLength) continue;
      if (bucket.stratumId === lastStratumId && stratumRun === maximumRunLength) continue;
      const nextGroupRun = bucket.groupId === lastGroupId ? groupRun + 1 : 1;
      const nextStratumRun = bucket.stratumId === lastStratumId ? stratumRun + 1 : 1;
      bucket.remaining -= 1;
      increment(groupRemaining, bucket.groupId, -1);
      increment(stratumRemaining, bucket.stratumId, -1);
      const nextTotal = remainingTotal - 1;
      const schedulable = categoriesRemainSchedulable(
        groupRemaining,
        nextTotal,
        bucket.groupId,
        nextGroupRun,
        maximumRunLength
      ) && categoriesRemainSchedulable(
        stratumRemaining,
        nextTotal,
        bucket.stratumId,
        nextStratumRun,
        maximumRunLength
      );
      const pressure = schedulable
        ? Math.max(
            maximumCategoryPressure(
              groupRemaining,
              nextTotal,
              bucket.groupId,
              nextGroupRun,
              maximumRunLength
            ),
            maximumCategoryPressure(
              stratumRemaining,
              nextTotal,
              bucket.stratumId,
              nextStratumRun,
              maximumRunLength
            )
          )
        : Number.POSITIVE_INFINITY;
      increment(stratumRemaining, bucket.stratumId);
      increment(groupRemaining, bucket.groupId);
      bucket.remaining += 1;
      if (!schedulable) continue;
      const rowIndex = bucket.rows.length - bucket.remaining;
      candidates.push({
        bucket,
        nextGroupRun,
        nextStratumRun,
        pressure,
        rowEntry: bucket.rows[rowIndex]
      });
    }
    candidates.sort((left, right) =>
      right.pressure - left.pressure
      || right.bucket.remaining - left.bucket.remaining
      || compareStrings(left.rowEntry.orderKey, right.rowEntry.orderKey)
      || left.rowEntry.row.seed - right.rowEntry.row.seed
    );
    for (const candidate of candidates) {
      candidate.bucket.remaining -= 1;
      increment(groupRemaining, candidate.bucket.groupId, -1);
      increment(stratumRemaining, candidate.bucket.stratumId, -1);
      ordered.push(candidate.rowEntry.row);
      if (visit(
        remainingTotal - 1,
        candidate.bucket.groupId,
        candidate.nextGroupRun,
        candidate.bucket.stratumId,
        candidate.nextStratumRun
      )) return true;
      ordered.pop();
      increment(stratumRemaining, candidate.bucket.stratumId);
      increment(groupRemaining, candidate.bucket.groupId);
      candidate.bucket.remaining += 1;
    }
    failedStates.add(stateKey);
    return false;
  }
  if (!visit(rows.length, null, 0, null, 0)) {
    throw new Error("unable to interleave blind presentation within the run limit");
  }
  const runs = blindPresentationRunSummary(ordered);
  if (runs.maximumGroupRun > maximumRunLength || runs.maximumStratumRun > maximumRunLength) {
    throw new Error("blind presentation interleave exceeded its run limit");
  }
  return ordered;
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function combinationsOfCount(size, count) {
  const combinations = [];
  function visit(start, selected) {
    if (selected.length === count) {
      combinations.push(selected);
      return;
    }
    const remaining = count - selected.length;
    for (let index = start; index <= size - remaining; index += 1) {
      visit(index + 1, [...selected, index]);
    }
  }
  visit(0, []);
  return combinations;
}

function counterbalancedIndexSets(size) {
  if (!Number.isInteger(size) || size < 1 || size > 10) {
    throw new Error("side-balance groups must contain 1-10 pairs");
  }
  const counts = new Set([Math.floor(size / 2), Math.ceil(size / 2)]);
  return [...counts].flatMap(count => combinationsOfCount(size, count));
}

function rowDimensionIndices(row) {
  return [row.stratumIndex, row.ratioIndex, row.overallIndex];
}

function addRowToVector(vector, row) {
  for (const index of rowDimensionIndices(row)) {
    if (index === undefined) throw new Error("counterbalance row has an unknown dimension");
    vector[index] += 1;
  }
}

function groupCountsWithOverall(rows, stratumIds, ratioIds) {
  return [
    ...groupCounts(rows, stratumIds, "stratumId"),
    ...groupCounts(rows, ratioIds, "ratio"),
    rows.length
  ];
}

function preparedRows(selectedRows, stratumIds, ratioIds) {
  const stratumIndex = new Map(stratumIds.map((id, index) => [id, index]));
  const ratioIndex = new Map(ratioIds.map((id, index) => [id, stratumIds.length + index]));
  const overallIndex = stratumIds.length + ratioIds.length;
  return selectedRows.map(row => ({
    ...row,
    stratumIndex: stratumIndex.get(row.stratumId),
    ratioIndex: ratioIndex.get(row.ratio),
    overallIndex
  }));
}

function assertUniqueSeeds(rows) {
  const seeds = new Set();
  for (const row of rows) {
    if (seeds.has(row.seed)) throw new Error(`duplicate blind seed ${row.seed}`);
    seeds.add(row.seed);
  }
}

function sideBalanceGroups(prepared, balanceCellIds) {
  return balanceCellIds.map(cellId => {
    const rows = prepared.filter(row => row.sideBalanceCellId === cellId);
    if (rows.length === 0) throw new Error(`${cellId} has no side-balance rows`);
    return { cellId, rows };
  });
}

function remainingOptionBounds(cells, dimensions) {
  const minimum = Array(cells.length + 1);
  const maximum = Array(cells.length + 1);
  minimum[cells.length] = Array(dimensions).fill(0);
  maximum[cells.length] = Array(dimensions).fill(0);
  for (let index = cells.length - 1; index >= 0; index -= 1) {
    minimum[index] = Array.from({ length: dimensions }, (_, dimension) =>
      Math.min(...cells[index].options.map(option => option.vector[dimension]))
      + minimum[index + 1][dimension]
    );
    maximum[index] = Array.from({ length: dimensions }, (_, dimension) =>
      Math.max(...cells[index].options.map(option => option.vector[dimension]))
      + maximum[index + 1][dimension]
    );
  }
  return { minimum, maximum };
}

function selectedSideMap(cells, choices) {
  const sideBySeed = new Map();
  cells.forEach((cell, cellIndex) => {
    const left = new Set(choices[cellIndex]);
    cell.rows.forEach((row, rowIndex) => sideBySeed.set(row.seed, left.has(rowIndex) ? "left" : "right"));
  });
  return sideBySeed;
}

function stableCellOptions(rows, dimensions) {
  const optionsByVector = new Map();
  for (const leftIndices of counterbalancedIndexSets(rows.length)) {
    const vector = Array(dimensions).fill(0);
    for (const rowIndex of leftIndices) addRowToVector(vector, rows[rowIndex]);
    const key = vectorKey(vector);
    if (!optionsByVector.has(key)) optionsByVector.set(key, { vector, leftIndices });
  }
  return [...optionsByVector.values()].sort((left, right) =>
    compareStrings(vectorKey(left.vector), vectorKey(right.vector))
  );
}

function fillCellOptions(cells, dimensions) {
  return cells.map(cell => ({
    ...cell,
    options: stableCellOptions(cell.rows, dimensions)
  }));
}

function groupIdsForBalance(stratumIds, ratioIds) {
  return [...stratumIds, ...ratioIds, "overall"];
}

function normalizedBalanceCellIds(selectedRows, balanceCellIds) {
  if (balanceCellIds) return balanceCellIds;
  return [...new Set(selectedRows.map(row => row.sideBalanceCellId))].sort(compareStrings);
}

function assertCompleteCellPartition(rows, cells) {
  const partitioned = cells.flatMap(cell => cell.rows);
  if (partitioned.length !== rows.length || new Set(partitioned.map(row => row.seed)).size !== rows.length) {
    throw new Error("side-balance cells do not partition the selected rows");
  }
}

function ensureSideBalanceCell(row) {
  if (typeof row.sideBalanceCellId !== "string" || row.sideBalanceCellId.length === 0) {
    throw new Error(`seed ${row.seed} has no side-balance cell`);
  }
  return row;
}

function prepareBalance(selectedRows, stratumIds, balanceCellIds) {
  assertUniqueSeeds(selectedRows);
  selectedRows.forEach(ensureSideBalanceCell);
  const ratioIds = [...new Set(selectedRows.map(row => row.ratio))].sort(compareStrings);
  const groupIds = groupIdsForBalance(stratumIds, ratioIds);
  const prepared = preparedRows(selectedRows, stratumIds, ratioIds);
  const ids = normalizedBalanceCellIds(selectedRows, balanceCellIds);
  const cells = fillCellOptions(sideBalanceGroups(prepared, ids), groupIds.length);
  assertCompleteCellPartition(prepared, cells);
  return {
    ratioIds,
    groupIds,
    prepared,
    cells,
    totalCounts: groupCountsWithOverall(prepared, stratumIds, ratioIds)
  };
}

function optionCompletionScore(vector, remainingBounds, bounds) {
  return vector.reduce((score, value, dimension) => {
    const projected = value
      + (remainingBounds.minimum[dimension] + remainingBounds.maximum[dimension]) / 2;
    const target = (bounds.lower[dimension] + bounds.upper[dimension]) / 2;
    return score + Math.abs(projected - target);
  }, 0);
}

function resolveBalanceChoices(cells, dimensions, bounds) {
  const remaining = remainingOptionBounds(cells, dimensions);
  const initialVector = Array(dimensions).fill(0);

  function visit(cellIndex, vector, choices) {
    if (cellIndex === cells.length) {
      return vector.every((value, dimension) =>
        value >= bounds.lower[dimension] && value <= bounds.upper[dimension]
      ) ? choices : null;
    }
    const suffix = {
      minimum: remaining.minimum[cellIndex + 1],
      maximum: remaining.maximum[cellIndex + 1]
    };
    const options = cells[cellIndex].options
      .filter(option => cellIndex !== 0 || option.leftIndices.includes(0))
      .map(option => ({
        option,
        vector: vector.map((value, dimension) => value + option.vector[dimension])
      }))
      .filter(candidate => candidate.vector.every((value, dimension) =>
        value + suffix.minimum[dimension] <= bounds.upper[dimension]
        && value + suffix.maximum[dimension] >= bounds.lower[dimension]
      ))
      .sort((left, right) =>
        optionCompletionScore(left.vector, suffix, bounds)
        - optionCompletionScore(right.vector, suffix, bounds)
        || compareStrings(vectorKey(left.vector), vectorKey(right.vector))
        || compareStrings(left.option.leftIndices.join(","), right.option.leftIndices.join(","))
      );
    for (const candidate of options) {
      const resolved = visit(cellIndex + 1, candidate.vector, [
        ...choices,
        candidate.option.leftIndices
      ]);
      if (resolved) return resolved;
    }
    return null;
  }

  return visit(0, initialVector, []);
}

function groupCounts(rows, groupIds, field) {
  const indexById = new Map(groupIds.map((id, index) => [id, index]));
  const counts = Array(groupIds.length).fill(0);
  rows.forEach(row => {
    const index = indexById.get(row[field]);
    if (index === undefined) throw new Error(`unknown ${field} ${row[field]}`);
    counts[index] += 1;
  });
  return counts;
}

function targetBounds(counts) {
  return {
    lower: counts.map(count => Math.floor(count / 2)),
    upper: counts.map(count => Math.ceil(count / 2))
  };
}

function vectorKey(vector) {
  return vector.join(",");
}

export function assignCounterbalancedSides(selectedRows, {
  stratumIds,
  balanceCellIds = null
}) {
  const balance = prepareBalance(selectedRows, stratumIds, balanceCellIds);
  const bounds = targetBounds(balance.totalCounts);
  const choices = resolveBalanceChoices(balance.cells, balance.groupIds.length, bounds);
  if (!choices) throw new Error("no complete counterbalanced side assignment");

  const sideBySeed = selectedSideMap(balance.cells, choices);
  return selectedRows.map(row => Object.freeze({
    ...row,
    candidateSide: sideBySeed.get(row.seed)
  }));
}

function selectRound(eligibleRows, {
  round,
  stratumIds,
  visualCellIds,
  pairsPerCell,
  minimumStratumCount
}) {
  const pools = new Map(visualCellIds.map(cellId => [
    cellId,
    eligibleRows
      .filter(row => row.visualCellId === cellId)
      .map(row => ({ row, orderKey: hashCanonical({ round, seed: row.seed }) }))
  ]));
  if ([...pools].some(([, rows]) => rows.length < pairsPerCell)) return null;
  const selected = [];
  const selectedSeeds = new Set();
  const stratumCounts = new Map(stratumIds.map(id => [id, 0]));
  const ratioCounts = new Map();
  for (let position = 0; position < pairsPerCell; position += 1) {
    for (const cellId of visualCellIds) {
      const candidates = pools.get(cellId)
        .filter(item => !selectedSeeds.has(item.row.seed))
        .sort((left, right) =>
          (stratumCounts.get(left.row.stratumId) || 0) - (stratumCounts.get(right.row.stratumId) || 0)
          || (ratioCounts.get(left.row.ratio) || 0) - (ratioCounts.get(right.row.ratio) || 0)
          || compareStrings(left.orderKey, right.orderKey)
          || left.row.seed - right.row.seed
        );
      const chosen = candidates[0]?.row;
      if (!chosen) return null;
      selected.push(chosen);
      selectedSeeds.add(chosen.seed);
      increment(stratumCounts, chosen.stratumId);
      increment(ratioCounts, chosen.ratio);
    }
  }
  if (stratumIds.some(id => (stratumCounts.get(id) || 0) < minimumStratumCount)) return null;
  return selected.sort((left, right) =>
    compareStrings(left.visualCellId, right.visualCellId) || left.seed - right.seed
  );
}

export function selectBalancedBlindCandidates(eligibleRows, {
  stratumIds,
  visualCellIds,
  pairsPerCell = 10,
  minimumStratumCount = 10,
  maximumRounds = 256
}) {
  if (!Array.isArray(eligibleRows) || !Array.isArray(stratumIds) || !Array.isArray(visualCellIds)) {
    throw new TypeError("blind candidate selection requires arrays");
  }
  if (pairsPerCell !== 10) throw new Error("v1 blind corpus requires 10 pairs per visual cell");
  for (let round = 0; round < maximumRounds; round += 1) {
    const selected = selectRound(eligibleRows, {
      round,
      stratumIds,
      visualCellIds,
      pairsPerCell,
      minimumStratumCount
    });
    if (!selected) continue;
    try {
      return interleaveBlindPresentation(assignCounterbalancedSides(
        selected.map(row => ({ ...row, sideBalanceCellId: row.visualCellId })),
        { stratumIds, balanceCellIds: visualCellIds }
      ));
    } catch {
      // A different deterministic selection round may admit an exact side assignment.
    }
  }
  const cellCounts = Object.fromEntries(visualCellIds.map(id => [
    id,
    eligibleRows.filter(row => row.visualCellId === id).length
  ]));
  const stratumCounts = Object.fromEntries(stratumIds.map(id => [
    id,
    eligibleRows.filter(row => row.stratumId === id).length
  ]));
  throw new Error(`unable to select blind corpus: ${JSON.stringify({ cellCounts, stratumCounts })}`);
}

export function selectCompleteBlindCorpus(eligibleRows, {
  stratumIds,
  visualCellIds,
  pairsPerVisualCell = 10,
  pairsPerStratum = 10,
  maximumRounds = 256
}) {
  const failureCounts = new Map();
  for (let round = 0; round < maximumRounds; round += 1) {
    const visualRows = selectRound(eligibleRows, {
      round,
      stratumIds,
      visualCellIds,
      pairsPerCell: pairsPerVisualCell,
      minimumStratumCount: 0
    });
    if (!visualRows) continue;
    const selectedSeeds = new Set(visualRows.map(row => row.seed));
    const ratioCounts = new Map();
    visualRows.forEach(row => increment(ratioCounts, row.ratio));
    const selected = visualRows.map(row => ({ ...row, sideBalanceCellId: row.visualCellId }));
    let supplementalComplete = true;
    for (const stratumId of stratumIds) {
      const currentCount = selected.filter(row => row.stratumId === stratumId).length;
      const deficit = Math.max(0, pairsPerStratum - currentCount);
      const pool = eligibleRows
        .filter(row =>
          row.visualCellId === null
          && row.stratumId === stratumId
          && !selectedSeeds.has(row.seed)
        )
        .map(row => ({ row, orderKey: hashCanonical({ round, supplemental: true, seed: row.seed }) }))
        .sort((left, right) =>
          (ratioCounts.get(left.row.ratio) || 0) - (ratioCounts.get(right.row.ratio) || 0)
          || compareStrings(left.orderKey, right.orderKey)
          || left.row.seed - right.row.seed
        );
      if (pool.length < deficit) {
        supplementalComplete = false;
        break;
      }
      pool.slice(0, deficit).forEach(({ row }) => {
        selected.push({ ...row, sideBalanceCellId: `supplemental/${stratumId}` });
        selectedSeeds.add(row.seed);
        increment(ratioCounts, row.ratio);
      });
    }
    if (!supplementalComplete) continue;
    const balanceCellIds = [
      ...visualCellIds,
      ...stratumIds
        .map(id => `supplemental/${id}`)
        .filter(id => selected.some(row => row.sideBalanceCellId === id))
    ];
    try {
      return interleaveBlindPresentation(assignCounterbalancedSides(selected, { stratumIds, balanceCellIds }));
    } catch (error) {
      increment(failureCounts, String(error?.message || error));
      // Retry with another deterministic visual/supplemental selection.
    }
  }
  const visualCellCounts = Object.fromEntries(visualCellIds.map(id => [
    id,
    eligibleRows.filter(row => row.visualCellId === id).length
  ]));
  const stratumCounts = Object.fromEntries(stratumIds.map(id => [
    id,
    eligibleRows.filter(row => row.stratumId === id).length
  ]));
  throw new Error(`unable to select complete blind corpus: ${JSON.stringify({
    visualCellCounts,
    stratumCounts,
    selectionFailures: Object.fromEntries([...failureCounts].sort(([left], [right]) => compareStrings(left, right)))
  })}`);
}
