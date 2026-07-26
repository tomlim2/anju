import assert from "node:assert/strict";
import { test } from "node:test";
import { enumerateCanonicalLayouts } from "../src/grid-layout.js";

test("canonical composition layouts preserve rectangular complete 3x3 coverage", () => {
  const expectedCounts = new Map([[2, 8], [3, 6], [4, 16], [5, 20]]);
  for (let count = 2; count <= 5; count += 1) {
    const slotIds = Array.from({ length: count }, (_, index) => `slot-${index + 1}`);
    const layouts = enumerateCanonicalLayouts(slotIds);
    assert.equal(layouts.length, expectedCounts.get(count));
    assert.equal(new Set(layouts.map(layout => layout.layoutKey)).size, layouts.length);
    for (const layout of layouts) {
      const cells = layout.blocks.flatMap(block => block.cells);
      assert.deepEqual([...cells].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
      assert.equal(new Set(cells).size, 9);
      assert.deepEqual(
        [...layout.blocks.map(block => block.slotInstanceId)].sort(),
        [...slotIds].sort()
      );
      layout.blocks.forEach(block => {
        const [width, height] = block.footprint.split("x").map(Number);
        assert.equal(width * height, block.cells.length);
      });
    }
  }
});
