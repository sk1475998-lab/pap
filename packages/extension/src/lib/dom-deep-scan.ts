/**
 * Deep DOM scan — pierce iframes, open shadow roots, and closed shadow roots (Workday, etc.).
 * GAP-DOM-01: Full enterprise shadow root & distributed slot node traversal.
 */

export function collectDeepRoots(doc: Document = document): ParentNode[] {
  const roots: ParentNode[] = [doc];
  const seen = new Set<ParentNode>([doc]);

  // 1. Traverse same-origin iframes in main document
  for (const iframe of doc.querySelectorAll("iframe")) {
    try {
      const inner = iframe.contentDocument;
      if (inner && !seen.has(inner)) {
        seen.add(inner);
        roots.push(inner);
        walkShadow(inner.body ?? inner.documentElement, roots, seen);
      }
    } catch {
      /* cross-origin */
    }
  }

  // 2. Walk standard open shadow roots and slotted elements in document body
  if (doc.body) {
    walkShadow(doc.body, roots, seen);
  }

  // 3. Walk closed shadow roots captured via Element.prototype.attachShadow hook
  try {
    const closedRoots = (typeof window !== "undefined" && (window as any).__sja_shadow_roots) as Set<ShadowRoot> | undefined;
    if (closedRoots && typeof closedRoots.forEach === "function") {
      closedRoots.forEach((shadow) => {
        if (shadow && !seen.has(shadow)) {
          seen.add(shadow);
          roots.push(shadow);
          for (const child of shadow.children) {
            walkShadow(child, roots, seen);
          }
        }
      });
    }
  } catch {}

  return roots;
}

function walkShadow(node: Element | null, roots: ParentNode[], seen: Set<ParentNode>) {
  if (!node) return;

  // Open shadow root
  if (node.shadowRoot && !seen.has(node.shadowRoot)) {
    seen.add(node.shadowRoot);
    roots.push(node.shadowRoot);

    // Check for iframes nested inside shadow roots
    try {
      const shadowIframes = node.shadowRoot.querySelectorAll("iframe");
      for (const iframe of shadowIframes) {
        const inner = iframe.contentDocument;
        if (inner && !seen.has(inner)) {
          seen.add(inner);
          roots.push(inner);
          walkShadow(inner.body ?? inner.documentElement, roots, seen);
        }
      }
    } catch {}

    for (const child of node.shadowRoot.children) {
      walkShadow(child, roots, seen);
    }
  }

  // Slotted content (distributed nodes)
  if (node && (node.tagName === "SLOT" || (typeof HTMLSlotElement !== "undefined" && node instanceof HTMLSlotElement))) {
    try {
      const assigned = (node as any).assignedElements ? (node as any).assignedElements({ flatten: true }) : [];
      for (const el of assigned) {
        if (el && !seen.has(el as any)) {
          seen.add(el as any);
          roots.push(el as any);
          walkShadow(el, roots, seen);
        }
      }
    } catch {}
  }

  if (node.children) {
    for (const child of node.children) {
      walkShadow(child, roots, seen);
    }
  }
}

/** Dedupe detected fields by selector + label. */
export function dedupeFields<T extends { selector: string; label: string }>(fields: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const f of fields) {
    const key = `${f.selector}::${f.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/**
 * Deep query selector that pierces across document, all shadow roots (open & closed),
 * and same-origin iframes.
 */
export function findDeepElement(selector: string, rootDoc: Document = document): Element | null {
  try {
    const direct = rootDoc.querySelector(selector);
    if (direct) return direct;
  } catch {}

  const roots = collectDeepRoots(rootDoc);
  for (const root of roots) {
    try {
      if (typeof (root as any).matches === "function" && (root as any).matches(selector)) {
        return root as unknown as Element;
      }
      if (selector.startsWith("#") && (root as any).id === selector.slice(1)) {
        return root as unknown as Element;
      }
      const el = (root as Document | ShadowRoot).querySelector(selector);
      if (el) return el;
    } catch {}
  }
  return null;
}

/**
 * Deep querySelectorAll across document, all shadow roots, and iframes.
 */
export function findAllDeepElements(selector: string, rootDoc: Document = document): Element[] {
  const results: Element[] = [];
  const roots = collectDeepRoots(rootDoc);
  for (const root of roots) {
    try {
      const els = Array.from((root as Document | ShadowRoot).querySelectorAll(selector));
      results.push(...els);
    } catch {}
  }
  return results;
}
