/**
 * Shadow DOM and Element extraction strategies.
 * Derived from reference capabilities to handle obfuscated DOM layouts (e.g. LinkedIn SDUI).
 */

/**
 * @deprecated REMOVED — Standard XPath 1.0 (document.evaluate) CANNOT pierce
 * Shadow DOM. The DOM spec isolates shadow trees from document-level XPath
 * queries at the shadow boundary. Any `//button` expression stops at
 * `#shadow-root` and returns zero results for elements inside it.
 *
 * Use `queryShadowElement` / `queryShadowElementAll` instead, which perform
 * a real breadth-first traversal through every open shadowRoot on the page.
 *
 * @see queryShadowElement
 */
export function buildShadowDomXPath(_selector: string, _fallbackClass: string): string {
  throw new Error(
    "buildShadowDomXPath is non-functional: XPath 1.0 cannot pierce shadow-root boundaries. "
    + "Use queryShadowElement() for real shadow DOM traversal."
  );
}

/**
 * Query a CSS selector across ALL open shadow roots in the document.
 *
 * Performs a breadth-first traversal of the entire composed DOM, entering
 * every open `shadowRoot` it encounters. Returns the first matching element
 * or `null` if none is found.
 *
 * @example
 *   // Find the LinkedIn Easy Apply button inside SDUI shadow trees
 *   const btn = queryShadowElement('button[aria-label*="Easy Apply"]');
 *
 * @param selector A valid CSS selector
 * @param root     Starting root (defaults to document)
 */
export function queryShadowElement(selector: string, root: Document | ShadowRoot | Element = document): Element | null {
  // Try light DOM first (fast path)
  const direct = (root as Document | Element).querySelector(selector);
  if (direct) return direct;

  // BFS through all shadow trees
  const queue: (Document | ShadowRoot | Element)[] = [root];
  while (queue.length > 0) {
    const node = queue.shift()!;
    const children = (node as Element).querySelectorAll ? (node as Element).querySelectorAll("*") : [];
    for (const child of children) {
      if (child.shadowRoot) {
        const found = child.shadowRoot.querySelector(selector);
        if (found) return found;
        queue.push(child.shadowRoot);
      }
    }
  }
  return null;
}

/**
 * Query all elements matching a CSS selector across ALL open shadow roots.
 *
 * Like `queryShadowElement` but returns every match found in the entire
 * composed DOM tree (light DOM + all open shadow trees).
 *
 * @param selector A valid CSS selector
 * @param root     Starting root (defaults to document)
 */
export function queryShadowElementAll(selector: string, root: Document | ShadowRoot | Element = document): Element[] {
  const results: Element[] = [];

  // Collect from light DOM
  (root as Document | Element).querySelectorAll(selector).forEach((el) => results.push(el));

  // BFS through all shadow trees
  const queue: (Document | ShadowRoot | Element)[] = [root];
  const visitedShadows = new Set<ShadowRoot>();
  while (queue.length > 0) {
    const node = queue.shift()!;
    const children = (node as Element).querySelectorAll ? (node as Element).querySelectorAll("*") : [];
    for (const child of children) {
      if (child.shadowRoot && !visitedShadows.has(child.shadowRoot)) {
        visitedShadows.add(child.shadowRoot);
        child.shadowRoot.querySelectorAll(selector).forEach((el) => results.push(el));
        queue.push(child.shadowRoot);
      }
    }
  }
  return results;
}

/**
 * Extracts a robust job identifier from a DOM element across different UI versions.
 * Falls back to React Context properties and data-view-tracking-scope if needed.
 */
export function extractJobId(element: Element): string | null {
    // Version 1/2: Standard Layout
    const standardId = element.getAttribute('data-job-id') || element.getAttribute('data-occludable-job-id');
    if (standardId) return standardId;
    
    // Version 4: SDUI with URN tracking scope
    const trackingScope = element.getAttribute('data-view-tracking-scope');
    if (trackingScope) {
        try {
            const parsed = JSON.parse(trackingScope);
            if (parsed[0]?.breadcrumb?.content?.data) {
                const buffer = parsed[0].breadcrumb.content.data;
                const decodedString = new TextDecoder().decode(new Uint8Array(buffer));
                const decodedJson = JSON.parse(decodedString);

                if (decodedJson.jobPosting?.objectUrn) {
                    const urn = decodedJson.jobPosting.objectUrn;
                    return urn.split(':').pop() || null;
                }
            }
        } catch (e) {
            console.warn('Failed to parse data-view-tracking-scope', e);
        }
    }

    // Version 5/6: React Component Keys
    const componentKey = element.getAttribute('componentkey');
    if (componentKey) {
        // Simple case: UUID is embedded directly in the component key
        if (componentKey.includes('job-card-component-ref-')) {
            return componentKey.replace('job-card-component-ref-', '').trim();
        }
        
        // Complex case: Needs hydration map mapping UUID to job ID
        // Note: Full hydration mapping logic should be injected via a separate hydration parser
        return componentKey; 
    }

    return null;
}
