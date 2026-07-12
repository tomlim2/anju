    import { createCatalogRenderer } from "./catalog-renderer.js";
    import {
      LAYOUT_GRID,
      MIN_VIEWPORT,
      TYPEFACES,
      componentBorderModes
    } from "./config.js";
    import { createArtworkExporter } from "./export.js";
    import {
      blockContentBox,
      gridBlockBox,
      layoutGridBlockPosition,
      uniformTypographyGroupKey
    } from "./grid-layout.js";
    import { createGridFinalizer } from "./grid-finalizer.js";
    import { createGraphicPrimitives, recordGraphicRandomValues } from "./graphics.js";
    import { createGridRenderer } from "./grid-renderer.js";
    import {
      createGridSelectionEngine,
      createGridTokenPools,
      createSelectionState
    } from "./grid-selection.js";
    import {
      alignedTextX,
      fitComponentBox,
      normalizeTokenAlign,
      paddedBox
    } from "./layout.js";
    import { createRandomSource } from "./random.js";
    import { line, make, rect, textNode } from "./svg.js";
    import { createTokenLibrary } from "./token-library.js";
    import {
      normalizeDesignTokenSize
    } from "./token-model.js";
    import { createTypographyMeasurer } from "./typography.js";
    import { validateRenderedTokenRules as runValidationRules } from "./validation.js";
    import { visualTokens } from "./vocabulary.js";

    const art = document.querySelector("#art");
    const seedLabel = document.querySelector("#seedLabel");
    const controls = {
      random: document.querySelector("#random"),
      mode: document.querySelector("#mode"),
      grid: document.querySelector("#grid"),
      png: document.querySelector("#png"),
      svg: document.querySelector("#svg"),
      tone: document.querySelector("#tone")
    };
    const typographyMeasureCanvas = document.createElement("canvas");
    const typographyMeasureContext = typographyMeasureCanvas.getContext("2d");
    const typographyMeasurer = createTypographyMeasurer(typographyMeasureContext);
    const urlParameters = new URLSearchParams(window.location.search);
    const testMode = urlParameters.get("test") === "1";
    const requestedTestSeed = urlParameters.has("seed") ? Number(urlParameters.get("seed")) : null;
    const requestedTestNow = urlParameters.get("now");
    const fixedGenerationDate = testMode && requestedTestNow && !Number.isNaN(Date.parse(requestedTestNow))
      ? new Date(requestedTestNow)
      : null;
    let seed = testMode && Number.isFinite(requestedTestSeed)
      ? requestedTestSeed >>> 0
      : randomSeed();
    let activeComponentRatio = "";
    let activeBorderMode = "";
    let activeBlockLayout = "";
    let blockOutlinesVisible = true;
    let appMode = "random";
    let dark = false;
    let renderVersion = 0;
    let activeGridPlan = null;

    function randomSeed() {
      return crypto.getRandomValues(new Uint32Array(1))[0] >>> 0;
    }

    function generationDate() {
      return fixedGenerationDate ? new Date(fixedGenerationDate.getTime()) : new Date();
    }

    function seedHex() {
      return seed.toString(16).toUpperCase().padStart(8, "0");
    }

    function seedSlug() {
      return seed.toString(16);
    }

    function cssVar(name) {
      return getComputedStyle(document.body).getPropertyValue(name).trim();
    }

    const randomSource = createRandomSource(seed);
    const { pick } = randomSource;
    const graphicPrimitives = createGraphicPrimitives({ randomSource, visualTokens });
    const tokenLibrary = createTokenLibrary({
      randomSource,
      visualTokens,
      generationDate,
      measureBadgeWidth: graphicPrimitives.microBadgeWidth
    });
    const gridSelection = createGridSelectionEngine({ randomSource, typographyMeasurer });
    const {
      applyTypographyGridSelection,
      renderGridPlan,
      renderTypographyGridTokenAtSize
    } = createGridRenderer({ typographyMeasurer, visualTokens });
    const { finalizeRenderedGridTypography } = createGridFinalizer({
      applyTypographyGridSelection,
      renderTypographyGridTokenAtSize
    });
    const catalogRenderer = createCatalogRenderer({
      randomSource,
      graphicPrimitives,
      renderTypographySample: stackTextToken
    });
    const artworkExporter = createArtworkExporter({
      art,
      getViewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
      cssVariable: cssVar,
      filenameSlug: seedSlug
    });

    function textSpinTransform(x, y, angle = 0) {
      if (!angle) return "";
      return `rotate(${angle.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`;
    }

    function stackTextToken(g, zone, text, attrs = {}) {
      const align = normalizeTokenAlign(attrs.align || "left");
      const tokenSize = normalizeDesignTokenSize(attrs.tokenSize || "medium");
      const y = zone.y + zone.height * (attrs.baseline ?? 0.72);
      const x = alignedTextX(zone, align);
      const spin = attrs.spin || 0;
      g.appendChild(textNode(x, y, text, {
        ...attrs,
        align,
        tokenSize,
        maxWidth: attrs.maxWidth || zone.width,
        transform: attrs.transform || textSpinTransform(x, y, spin)
      }));
    }

    // 3x3 random rectangular block system.
    function renderRandomGridLayout(w, h) {
      const safe = paddedBox(0, 0, w, h, "large");
      const typographyItems = Object.values(tokenLibrary.createTypographyTokenGroups()).flat();
      const graphicItems = tokenLibrary.createGraphicTokenDescriptors();
      const pools = createGridTokenPools(typographyItems, graphicItems);
      const selectionState = createSelectionState();
      const blocks = gridSelection.planGridBlocks(safe, pools);
      activeBlockLayout = blocks.map(block => `${block.width}x${block.height}`).join("+");
      const blockPlans = [];
      blocks.forEach(block => {
        const box = gridBlockBox(safe, block);
        const contentBox = blockContentBox(box, block);
        const position = layoutGridBlockPosition(contentBox, block);
        const selection = gridSelection.selectTokenForBlock({
          block,
          position,
          pools,
          availableBox: contentBox,
          selectionState
        });
        if (selection.kind === "graphic") {
          selection.graphicRandomValues = recordGraphicRandomValues(selection.tokenPlan, randomSource);
        }
        blockPlans.push({ block, box, contentBox, position, selection });
      });
      activeGridPlan = { safe, blocks: blockPlans, blockOutlinesVisible };
      return renderGridPlan(activeGridPlan);
    }

    // Extension point: add Component ratio templates here.
    const componentTemplates = [
      {
        label: "component 1:1",
        ratio: { width: 1, height: 1 },
        scale: 0.72
      },
      {
        label: "component 2:3",
        ratio: { width: 2, height: 3 },
        scale: 0.78
      },
      {
        label: "component 2:5",
        ratio: { width: 2, height: 5 },
        scale: 0.82
      },
      {
        label: "component 3:2",
        ratio: { width: 3, height: 2 },
        scale: 0.78
      },
      {
        label: "component 5:2",
        ratio: { width: 5, height: 2 },
        scale: 0.82
      },
      {
        label: "component 4:3",
        ratio: { width: 4, height: 3 },
        scale: 0.8
      },
      {
        label: "component 3:4",
        ratio: { width: 3, height: 4 },
        scale: 0.8
      }
    ];

    function renderComponentBorder(w, h, mode) {
      const g = make("g", { "data-border": mode });
      if (mode === "no-stroke") return g;

      if (mode === "stroke") {
        g.appendChild(rect(1, 1, w - 2, h - 2, { opacity: 0.9 }));
        return g;
      }

      const inset = 8;
      const x0 = inset;
      const y0 = inset;
      const x1 = w - inset;
      const y1 = h - inset;
      const length = Math.min(72, Math.max(38, Math.min(w, h) * 0.18));
      const attrs = { opacity: 0.94 };
      g.append(
        line(x0, y0, x0 + length, y0, attrs),
        line(x0, y0, x0, y0 + length, attrs),
        line(x1, y0, x1 - length, y0, attrs),
        line(x1, y0, x1, y0 + length, attrs),
        line(x0, y1, x0 + length, y1, attrs),
        line(x0, y1, x0, y1 - length, attrs),
        line(x1, y1, x1 - length, y1, attrs),
        line(x1, y1, x1, y1 - length, attrs)
      );
      return g;
    }

    function renderComponent(boardW, boardH) {
      const component = pick(componentTemplates);
      const borderMode = pick(componentBorderModes);
      activeComponentRatio = component.label.replace("component ", "");
      activeBorderMode = borderMode;
      const box = fitComponentBox(boardW, boardH, component.ratio, component.scale);
      const layer = make("svg", {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        viewBox: `0 0 ${box.width} ${box.height}`,
        overflow: "hidden",
        "data-component": component.label,
        "data-layout-grid": `${LAYOUT_GRID.columns}x${LAYOUT_GRID.rows}`
      });
      const layout = renderRandomGridLayout(box.width, box.height);
      layer.appendChild(layout);
      layer.appendChild(renderComponentBorder(box.width, box.height, borderMode));
      return layer;
    }

    function reportValidationResults(target, validation) {
      target.setAttribute("data-rule-violations", String(validation.violations.length));
      target.setAttribute("data-rule-violation-list", validation.violations.join(","));
      if (validation.violations.length) console.warn("Token rule violations", validation.results.filter(result => !result.valid));
      return validation;
    }

    function normalizedComponentFingerprint() {
      const component = art.querySelector("svg[data-component]");
      const blocks = component
        ? [...component.querySelectorAll("[data-grid-block]")].map(block => {
            const token = block.querySelector(":scope > [data-grid-token]");
            const typography = token?.querySelector(':scope > text[data-token-form="typography"]');
            const actualSize = token?.getAttribute("data-grid-token-kind") === "graphic"
              ? token.getAttribute("data-token-size")
              : typography?.getAttribute("data-token-size");
            const weight = typography?.getAttribute("font-weight");
            return {
              footprint: block.getAttribute("data-grid-footprint"),
              cells: (block.getAttribute("data-grid-cells") || "")
                .split(",")
                .filter(Boolean)
                .map(Number),
              role: token?.getAttribute("data-grid-token") || null,
              value: typography?.textContent || token?.getAttribute("data-grid-token") || null,
              kind: token?.getAttribute("data-grid-token-kind") || null,
              requestedSize: token?.getAttribute("data-token-requested-size") || null,
              actualSize: actualSize || null,
              weight: weight ? Number(weight) : null,
              orientation: token?.getAttribute("data-token-orientation") || null,
              fit: token?.getAttribute("data-grid-token-kind") === "graphic" ||
                token?.getAttribute("data-token-fit") === "true"
            };
          })
        : [];

      return {
        mode: appMode,
        tone: dark ? "dark" : "light",
        grid: blockOutlinesVisible,
        componentRatio: activeComponentRatio,
        borderMode: activeBorderMode,
        blockLayout: activeBlockLayout,
        blocks
      };
    }

    function currentTestSnapshot() {
      const fingerprint = normalizedComponentFingerprint();
      const structuralFingerprint = {
        mode: fingerprint.mode,
        componentRatio: fingerprint.componentRatio,
        borderMode: fingerprint.borderMode,
        blockLayout: fingerprint.blockLayout,
        blocks: fingerprint.blocks
      };
      return {
        schemaVersion: 1,
        seed,
        seedHex: seedHex(),
        renderVersion,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        prng: randomSource.snapshot(),
        violations: Number(art.getAttribute("data-rule-violations") || 0),
        violationList: (art.getAttribute("data-rule-violation-list") || "").split(",").filter(Boolean),
        fingerprint,
        normalizedFingerprint: JSON.stringify(fingerprint),
        structuralFingerprint: JSON.stringify(structuralFingerprint)
      };
    }

    function render(nextSeed = randomSeed()) {
      seed = Number(nextSeed) >>> 0;
      randomSource.reset(seed);
      const w = Math.max(MIN_VIEWPORT.width, window.innerWidth);
      const h = Math.max(MIN_VIEWPORT.height, window.innerHeight);
      art.setAttribute("viewBox", `0 0 ${w} ${h}`);
      art.setAttribute("style", "color: var(--ink)");
      art.setAttribute("data-grid-outlines", blockOutlinesVisible ? "visible" : "hidden");
      art.replaceChildren();
      activeGridPlan = null;
      document.body.classList.toggle("is-dark", dark);

      const bg = make("rect", { x: 0, y: 0, width: w, height: h, fill: "var(--bg)" });
      art.appendChild(bg);
      if (appMode === "composable-tokens") {
        activeComponentRatio = "composable categories";
        activeBorderMode = "catalog";
        art.appendChild(catalogRenderer.renderComposableTokensMode(w, h, tokenLibrary.createCategoryDefinitions()));
        seedLabel.textContent = `MODE COMPOSABLE CATEGORIES / SEED ${seedHex()}`;
      } else {
        art.appendChild(renderComponent(w, h));
        seedLabel.textContent = `SEED ${seedHex()} / COMP ${activeComponentRatio} / BLOCKS ${activeBlockLayout} / BORDER ${activeBorderMode}`;
      }
      finalizeRenderedGridTypography(art.querySelector("svg[data-component]"), activeGridPlan);
      reportValidationResults(art, runValidationRules(art));
      renderVersion += 1;
    }

    function syncBlockOutlineVisibility() {
      art.setAttribute("data-grid-outlines", blockOutlinesVisible ? "visible" : "hidden");
      art.querySelectorAll("[data-grid-block-outline]").forEach(outline => {
        outline.setAttribute("opacity", blockOutlinesVisible ? "0.18" : "0");
      });
      controls.grid.setAttribute("aria-pressed", String(blockOutlinesVisible));
    }

    function bindEvents() {
      controls.random.addEventListener("click", () => render());
      controls.mode.addEventListener("click", () => {
        appMode = appMode === "random" ? "composable-tokens" : "random";
        controls.mode.textContent = appMode === "composable-tokens" ? "Generator" : "Compose";
        controls.mode.setAttribute("aria-pressed", String(appMode === "composable-tokens"));
        render(seed);
      });
      controls.grid.addEventListener("click", () => {
        blockOutlinesVisible = !blockOutlinesVisible;
        syncBlockOutlineVisibility();
      });
      controls.png.addEventListener("click", artworkExporter.exportPng);
      controls.svg.addEventListener("click", artworkExporter.exportSvg);
      controls.tone.addEventListener("click", () => {
        dark = !dark;
        render(seed);
      });
      art.addEventListener("click", () => render());
      window.addEventListener("resize", () => render(seed));
    }

    function wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function loadTypefaces() {
      if (!document.fonts) return;

      const ready = Promise.allSettled(
        [TYPEFACES.english, TYPEFACES.korean, TYPEFACES.mono, TYPEFACES.chinese]
          .flatMap(typeface => [400, 700, 900].map(weight => document.fonts.load(`${weight} 80px ${typeface}`)))
      ).then(() => document.fonts.ready);

      ready.then(() => render(seed)).catch(() => {});
      await Promise.race([ready, wait(900)]);
    }

    async function start() {
      bindEvents();
      await loadTypefaces();
      render(seed);
    }

    const startPromise = start();
    if (testMode) {
      const ready = startPromise.then(async () => {
        if (document.fonts) await document.fonts.ready;
        render(seed);
        return currentTestSnapshot();
      });
      Object.defineProperty(window, "__MICRO_GRAPHIC_TEST__", {
        configurable: false,
        enumerable: false,
        value: Object.freeze({
          ready,
          snapshot: currentTestSnapshot,
          renderSeed(nextSeed) {
            if (!Number.isFinite(Number(nextSeed))) throw new TypeError("Seed must be a finite number");
            render(Number(nextSeed) >>> 0);
            return currentTestSnapshot();
          },
          finalizeGrid() {
            finalizeRenderedGridTypography(art.querySelector("svg[data-component]"), activeGridPlan);
            return currentTestSnapshot();
          },
          validate() {
            return reportValidationResults(art, runValidationRules(art));
          },
          uniformTypographyGroupKey,
          svgText: artworkExporter.svgText
        })
      });
    }
