import {
  COMPOSITION_RULE_GROUPS,
  TOKEN_CATALOG_SECTION_TITLE,
  TOKEN_FORMS,
  TOKEN_FUNCTIONS
} from "./config.js";
import { marginSize, paddedBox } from "./layout.js";
import { line, make, rect, textNode } from "./svg.js";
import { isComposableToken } from "./token-model.js";

export function composableTokenCategories(definitions) {
  return definitions.filter(category => isComposableToken(category) && category.items.length);
}

export function composableCategoryCombinations(categories) {
  const combinations = [];
  const total = 1 << categories.length;
  for (let mask = 0; mask < total; mask += 1) {
    const combination = categories.filter((category, index) => mask & (1 << index));
    if (combination.length >= 2) combinations.push(combination);
  }
  return combinations.sort((a, b) => a.length - b.length);
}

export function createCatalogRenderer({ randomSource, graphicPrimitives, renderTypographySample }) {
  const { pick } = randomSource;
  const { barcode, label, microBadge, miniTable, pseudoQr, wave } = graphicPrimitives;

  function renderGraphicDescriptorInCell(group, item, cell, tokenContext = "catalog-ui") {
    if (item.graphicType === "barcode") {
      barcode(group, cell.x, cell.y + cell.height * 0.18, cell.width, cell.height * 0.62, {
        caption: true,
        tokenSize: item.size,
        tokenContext
      });
    } else if (item.graphicType === "table") {
      miniTable(group, cell.x, cell.y + cell.height * 0.06, cell.width, {
        maxHeight: cell.height * 0.9,
        tokenSize: item.size,
        tokenContext
      });
    } else if (item.graphicType === "wave") {
      wave(group, cell.x, cell.y + cell.height * 0.14, cell.width, cell.height * 0.66, {
        tokenSize: item.size,
        tokenContext
      });
    } else if (item.graphicType === "pseudo-qr") {
      pseudoQr(group, cell.x, cell.y + cell.height * 0.04, Math.min(cell.width, cell.height * 0.86), 15, {
        tokenSize: item.size,
        tokenContext
      });
    } else if (item.graphicType === "status-label") {
      label(group, cell.x, cell.y + cell.height * 0.28, cell.width, "STATUS", true, {
        tokenSize: item.size,
        tokenFunction: "sign",
        tokenRole: "status-label",
        tokenContext,
        align: "left"
      });
    } else if (item.graphicType === "metadata-badge") {
      microBadge(group, cell.x, cell.y + cell.height * 0.34, "REV A", {
        tokenSize: item.size,
        tokenContext
      });
    }
  }

  function renderComposableCategorySample(group, category, cell) {
    const item = pick(category.items);
    const labelHeight = cell.height < 48 ? 0 : 18;
    if (labelHeight) {
      group.appendChild(textNode(cell.x, cell.y + 10, category.shortLabel, {
        size: 8,
        tokenSize: "small",
        tokenFunction: "content",
        tokenRole: "catalog-sample-label",
        tokenContext: "catalog-ui",
        typeface: "english",
        opacity: 0.55,
        maxWidth: cell.width
      }));
    }

    const sample = {
      x: cell.x,
      y: cell.y + labelHeight,
      width: cell.width,
      height: Math.max(1, cell.height - labelHeight)
    };
    if (category.form === "graphic") {
      renderGraphicDescriptorInCell(group, item, sample);
      return;
    }

    const sizeLimit = Math.max(9, sample.height * 0.58);
    const sizes = {
      small: Math.min(11, sizeLimit),
      medium: Math.min(16, sizeLimit),
      large: Math.min(22, sizeLimit),
      xlarge: Math.min(30, sizeLimit),
      xxlarge: Math.min(38, sizeLimit),
      xxxlarge: Math.min(46, sizeLimit)
    };
    renderTypographySample(group, sample, item.value, {
      align: "left",
      tokenSize: item.size,
      tokenFunction: item.function,
      tokenRole: item.role,
      tokenContext: "catalog-ui",
      baseline: 0.62,
      size: sizes[item.size] || 16,
      minSize: 8,
      maxHeight: sample.height * 0.82,
      typeface: item.typeface,
      maxWidth: sample.width
    });
  }

  function renderTokenMap(group, box, definitions) {
    const titleHeight = TOKEN_CATALOG_SECTION_TITLE.height;
    const rowLabelWidth = Math.min(118, box.width * 0.16);
    const gridY = box.y + titleHeight;
    const gridHeight = box.height - titleHeight;
    const cellWidth = (box.width - rowLabelWidth) / TOKEN_FUNCTIONS.length;
    const cellHeight = gridHeight / TOKEN_FORMS.length;

    group.appendChild(textNode(box.x, box.y + titleHeight * 0.72, "TOKEN MAP", {
      size: TOKEN_CATALOG_SECTION_TITLE.size,
      tokenSize: "small",
      tokenFunction: "content",
      tokenRole: "catalog-section-label",
      tokenContext: "catalog-ui",
      typeface: "english",
      maxWidth: box.width * 0.5
    }));
    group.appendChild(textNode(box.x + box.width, box.y + titleHeight * 0.72, "COMPOSE  /  EMPTY  /  SIGN", {
      size: 8,
      tokenSize: "small",
      tokenFunction: "data",
      tokenRole: "catalog-map-legend",
      tokenContext: "catalog-ui",
      align: "right",
      typeface: "mono",
      opacity: 0.62,
      maxWidth: box.width * 0.42
    }));
    group.appendChild(line(box.x, gridY, box.x + box.width, gridY, { opacity: 0.75 }));

    TOKEN_FUNCTIONS.forEach((tokenFunction, column) => {
      const x = box.x + rowLabelWidth + column * cellWidth;
      group.appendChild(textNode(x + cellWidth * 0.5, gridY + 13, tokenFunction.toUpperCase(), {
        size: 8,
        tokenSize: "small",
        tokenFunction: "content",
        tokenRole: "catalog-map-column",
        tokenContext: "catalog-ui",
        align: "center",
        typeface: "english",
        maxWidth: cellWidth * 0.86
      }));
    });

    TOKEN_FORMS.forEach((form, row) => {
      const y = gridY + row * cellHeight;
      group.appendChild(textNode(box.x, y + cellHeight * 0.6, form.toUpperCase(), {
        size: 9,
        tokenSize: "small",
        tokenFunction: "content",
        tokenRole: "catalog-map-row",
        tokenContext: "catalog-ui",
        typeface: "english",
        maxWidth: rowLabelWidth * 0.86
      }));
      group.appendChild(line(box.x, y + cellHeight, box.x + box.width, y + cellHeight, { opacity: 0.3 }));

      TOKEN_FUNCTIONS.forEach((tokenFunction, column) => {
        const category = definitions.find(item => item.form === form && item.function === tokenFunction);
        const x = box.x + rowLabelWidth + column * cellWidth;
        const status = tokenFunction === "sign" ? "SIGN" : category.items.length ? "COMPOSE" : "EMPTY";
        const active = status === "COMPOSE";
        group.appendChild(rect(x + 2, y + cellHeight * 0.43, 5, 5, {
          fill: active ? "currentColor" : "none",
          opacity: active ? 0.9 : 0.45
        }));
        group.appendChild(textNode(x + 12, y + cellHeight * 0.6, `${category.items.length}  ${status}`, {
          size: 8,
          tokenSize: "small",
          tokenFunction: "data",
          tokenRole: "catalog-map-cell",
          tokenContext: "catalog-ui",
          typeface: "mono",
          opacity: active ? 0.9 : 0.48,
          maxWidth: cellWidth - 16
        }));
        if (column) group.appendChild(line(x, y + 18, x, y + cellHeight, { opacity: 0.22 }));
      });
    });
  }

  function renderCompositionRuleGroups(group, box) {
    const titleHeight = TOKEN_CATALOG_SECTION_TITLE.height;
    const gap = marginSize(box.width, box.height, "medium");
    const groupWidth = (box.width - gap * (COMPOSITION_RULE_GROUPS.length - 1)) / COMPOSITION_RULE_GROUPS.length;
    group.appendChild(textNode(box.x, box.y + titleHeight * 0.72, "RULE GROUPS", {
      size: TOKEN_CATALOG_SECTION_TITLE.size,
      tokenSize: "small",
      tokenFunction: "content",
      tokenRole: "catalog-section-label",
      tokenContext: "catalog-ui",
      typeface: "english",
      maxWidth: box.width
    }));
    group.appendChild(line(box.x, box.y + titleHeight, box.x + box.width, box.y + titleHeight, { opacity: 0.75 }));

    COMPOSITION_RULE_GROUPS.forEach((ruleGroup, index) => {
      const x = box.x + index * (groupWidth + gap);
      const bodyY = box.y + titleHeight;
      const lineHeight = Math.max(8, (box.height - titleHeight - 12) / ruleGroup.rules.length);
      group.appendChild(textNode(x, bodyY + 11, ruleGroup.label, {
        size: 8,
        tokenSize: "small",
        tokenFunction: "content",
        tokenRole: "catalog-rule-group",
        tokenContext: "catalog-ui",
        typeface: "english",
        maxWidth: groupWidth
      }));
      ruleGroup.rules.forEach((rule, ruleIndex) => {
        group.appendChild(textNode(x, bodyY + 11 + lineHeight * (ruleIndex + 1), rule, {
          size: 7.2,
          tokenSize: "small",
          tokenFunction: "content",
          tokenRole: "catalog-rule",
          tokenContext: "catalog-ui",
          typeface: "english",
          opacity: 0.72,
          maxWidth: groupWidth
        }));
      });
    });
  }

  function renderComposableTokensMode(width, height, definitions) {
    const group = make("g", { "data-mode": "composable-tokens" });
    const safe = paddedBox(0, 0, width, height, "large");
    const headerHeight = 52;
    const sectionGap = marginSize(safe.width, safe.height, "large");
    const categories = composableTokenCategories(definitions);
    const combinations = composableCategoryCombinations(categories);

    group.appendChild(textNode(safe.x, safe.y + 26, "COMPOSABLE CATEGORIES", {
      size: 18,
      tokenSize: "medium",
      tokenFunction: "content",
      tokenRole: "catalog-title",
      tokenContext: "catalog-ui",
      typeface: "english",
      maxWidth: safe.width * 0.58
    }));
    group.appendChild(textNode(safe.x + safe.width, safe.y + 26, `CATEGORIES ${categories.length} / COMBINATIONS ${combinations.length}`, {
      size: 12,
      tokenSize: "small",
      tokenFunction: "data",
      tokenRole: "catalog-count",
      tokenContext: "catalog-ui",
      align: "right",
      typeface: "mono",
      maxWidth: safe.width * 0.38
    }));
    group.appendChild(line(safe.x, safe.y + headerHeight, safe.x + safe.width, safe.y + headerHeight, { opacity: 0.85 }));

    const mapY = safe.y + headerHeight + sectionGap;
    const mapHeight = Math.max(112, Math.min(150, safe.height * 0.22));
    renderTokenMap(group, { x: safe.x, y: mapY, width: safe.width, height: mapHeight }, definitions);

    const rulesY = mapY + mapHeight + sectionGap;
    const rulesHeight = Math.max(82, Math.min(104, safe.height * 0.15));
    renderCompositionRuleGroups(group, { x: safe.x, y: rulesY, width: safe.width, height: rulesHeight });

    const listY = rulesY + rulesHeight + sectionGap;
    const listTitleHeight = TOKEN_CATALOG_SECTION_TITLE.height;
    const rowsY = listY + listTitleHeight;
    const rowHeight = Math.max(44, (safe.y + safe.height - rowsY) / Math.max(1, combinations.length));
    group.appendChild(textNode(safe.x, listY + listTitleHeight * 0.72, "POSSIBLE COMBINATIONS", {
      size: TOKEN_CATALOG_SECTION_TITLE.size,
      tokenSize: "small",
      tokenFunction: "content",
      tokenRole: "catalog-section-label",
      tokenContext: "catalog-ui",
      typeface: "english",
      maxWidth: safe.width
    }));
    group.appendChild(line(safe.x, rowsY, safe.x + safe.width, rowsY, { opacity: 0.75 }));

    combinations.forEach((combination, rowIndex) => {
      const rowY = rowsY + rowIndex * rowHeight;
      const labelWidth = safe.width * 0.38;
      const sampleGap = marginSize(safe.width, rowHeight, "medium");
      const sampleX = safe.x + labelWidth + sampleGap;
      const sampleWidth = safe.width - labelWidth - sampleGap;
      const cellGap = marginSize(sampleWidth, rowHeight, "small");
      const cellWidth = (sampleWidth - cellGap * Math.max(0, combination.length - 1)) / combination.length;

      group.appendChild(textNode(safe.x, rowY + rowHeight * 0.54, combination.map(category => category.shortLabel).join(" + "), {
        size: 11,
        tokenSize: "small",
        tokenFunction: "content",
        tokenRole: "catalog-combination",
        tokenContext: "catalog-ui",
        typeface: "english",
        maxWidth: labelWidth - sampleGap
      }));
      combination.forEach((category, index) => {
        renderComposableCategorySample(group, category, {
          x: sampleX + index * (cellWidth + cellGap),
          y: rowY + 8,
          width: cellWidth,
          height: Math.max(1, rowHeight - 16)
        });
      });
      group.appendChild(line(safe.x, rowY + rowHeight, safe.x + safe.width, rowY + rowHeight, { opacity: 0.35 }));
    });

    return group;
  }

  return { renderComposableTokensMode };
}
