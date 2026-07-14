import { hashCanonical } from "./canonical-hash.js";

const STRUCTURAL_EXCLUDED_VALUES = new Set(["grid-overlay", "debug-overlay", "ui-only"]);
const STRUCTURAL_TEXT_ELEMENTS = new Set(["text", "tspan", "title", "desc"]);

function directTextContent(element) {
  if (!STRUCTURAL_TEXT_ELEMENTS.has(element.localName)) return "";
  return [...element.childNodes]
    .filter(node => node.nodeType === 3)
    .map(node => node.nodeValue || "")
    .join("");
}

function sortedAttributeRecords(element) {
  return [...element.attributes]
    .map(attribute => Object.freeze({
      namespaceURI: attribute.namespaceURI || "",
      localName: attribute.localName,
      value: attribute.value
    }))
    .sort((left, right) =>
      left.namespaceURI.localeCompare(right.namespaceURI)
      || left.localName.localeCompare(right.localName)
      || left.value.localeCompare(right.value)
    );
}

export function deriveSvgStructuralProjection(componentRoot) {
  if (!componentRoot || componentRoot.nodeType !== 1) {
    throw new TypeError("structural projection requires an SVG element root");
  }
  const nodes = [];
  function visit(element, nodePath) {
    if (STRUCTURAL_EXCLUDED_VALUES.has(element.getAttribute("data-structural-exclude"))) return;
    nodes.push(Object.freeze({
      nodePath: nodePath.join("."),
      namespaceURI: element.namespaceURI || "",
      localName: element.localName,
      sortedAttributes: Object.freeze(sortedAttributeRecords(element)),
      directText: directTextContent(element)
    }));
    const children = [...element.children].filter(child =>
      !STRUCTURAL_EXCLUDED_VALUES.has(child.getAttribute("data-structural-exclude"))
    );
    children.forEach((child, index) => visit(child, [...nodePath, index]));
  }
  visit(componentRoot, [0]);
  return Object.freeze({ schemaVersion: 1, nodes: Object.freeze(nodes) });
}

export function svgStructuralFingerprint(componentRoot) {
  return hashCanonical(deriveSvgStructuralProjection(componentRoot));
}
