/**
 * Self-contained DOM field scanner.
 *
 * Designed to run INSIDE a Playwright page via page.evaluate(scanFields).
 * It must be fully self-contained — no imports, no closures — because
 * Playwright serializes the function body and runs it in the page context.
 *
 * Returns raw fields; classification (label → profile key) happens in Node
 * via @superjob/core's classifyLabel, so this file stays pure-DOM.
 *
 * This mirrors the extension's detector.ts but is written as a single
 * injectable function.
 */

export interface ScannedField {
  label: string;
  type: "text" | "email" | "tel" | "number" | "date" | "url" | "textarea" | "select" | "radio" | "checkbox" | "file";
  selector: string;
  value: string; // current value (for dedupe / skip-already-filled)
  options: { value: string; label: string }[];
  required: boolean;
}

// This is the function that runs in the page. Keep it self-contained.
export const scanFieldsSource = String.raw`
function scanFields() {
  var fields = [];
  var seen = new Set();
  var counter = 0;

  function uid() { counter++; return 'pw' + counter; }

  function escapeSel(s) {
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s);
    return String(s).replace(/[^a-zA-Z0-9_-]/g, function(c) { return '\\' + c; });
  }

  function isVisible(el) {
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return el.getAttribute('aria-hidden') !== 'true';
    var st = getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) > 0;
  }

  function labelFor(el) {
    var id = el.getAttribute('id');
    if (id) {
      var lab = document.querySelector('label[for="' + escapeSel(id) + '"]');
      if (lab && lab.textContent.trim()) return lab.textContent.trim();
    }
    var lb = el.getAttribute('aria-labelledby');
    if (lb) {
      var ref = lb.split(/\s+/).map(function(i){ return (document.getElementById(i)||{}).textContent || ''; }).filter(Boolean).join(' ');
      if (ref) return ref;
    }
    var aria = el.getAttribute('aria-label');
    if (aria) return aria;
    var wrap = el.closest('label');
    if (wrap && wrap.textContent.trim()) {
      var clone = wrap.cloneNode(true);
      clone.querySelectorAll('input,select,textarea,button').forEach(function(n){ n.remove(); });
      var t = clone.textContent.trim();
      if (t) return t;
      return wrap.textContent.trim();
    }
    var ph = el.placeholder;
    if (ph) return ph;
    var name = el.getAttribute('name');
    if (name) return name.replace(/[_-]+/g,' ').replace(/\b\w/g, function(c){return c.toUpperCase();}).trim();
    var fs = el.closest('fieldset');
    if (fs) { var lg = fs.querySelector('legend'); if (lg && lg.textContent.trim()) return lg.textContent.trim(); }
    return '';
  }

  function typeOf(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return 'textarea';
    if (tag === 'select') return 'select';
    if (tag === 'input') {
      var t = (el.getAttribute('type') || 'text').toLowerCase();
      if (['text','search'].indexOf(t) >= 0) return 'text';
      if (t === 'email') return 'email';
      if (t === 'tel') return 'tel';
      if (t === 'number') return 'number';
      if (t === 'url') return 'url';
      if (t === 'date') return 'date';
      if (t === 'radio') return 'radio';
      if (t === 'checkbox') return 'checkbox';
      if (t === 'file') return 'file';
      return 'text';
    }
    return 'text';
  }

  function selectorFor(el) {
    if (el.id) return '#' + escapeSel(el.id);
    var name = el.getAttribute('name');
    var type = el.getAttribute('type');
    if (name) return el.tagName.toLowerCase() + '[name="' + escapeSel(name) + '"]' + (type ? '[type="' + type + '"]' : '');
    var parent = el.parentElement;
    if (!parent) return el.tagName.toLowerCase();
    var sibs = Array.from(parent.children).filter(function(c){ return c.tagName === el.tagName; });
    return selectorFor(parent) + ' > ' + el.tagName.toLowerCase() + ':nth-of-type(' + (sibs.indexOf(el) + 1) + ')';
  }

  // text-ish + selects
  var sels = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not([type=radio]), textarea, select';
  var cands = Array.from(document.querySelectorAll(sels)).filter(function(el) {
    return isVisible(el) && !el.disabled && !el.readOnly;
  });
  cands.forEach(function(el) {
    if (seen.has(el)) return;
    var type = typeOf(el);
    if (type === 'radio') return;
    seen.add(el);
    var label = labelFor(el);
    var options = [];
    if (type === 'select') {
      options = Array.from(el.options).map(function(o){ return { value: o.value, label: (o.textContent||'').trim() || o.value }; });
    }
    fields.push({ label: label, type: type, selector: selectorFor(el), value: el.value || '', options: options, required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true' });
  });

  // radio groups
  var radios = Array.from(document.querySelectorAll('input[type=radio]')).filter(function(el) {
    return isVisible(el) && !el.disabled;
  });
  var groups = {};
  radios.forEach(function(r) {
    var key = r.getAttribute('name') || r.id;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });
  Object.keys(groups).forEach(function(key) {
    var opts = groups[key];
    if (opts.every(function(o){ return seen.has(o); })) return;
    opts.forEach(function(o){ seen.add(o); });
    var label = '';
    var fs = opts[0].closest('fieldset');
    if (fs) { var lg = fs.querySelector('legend'); label = lg ? lg.textContent.trim() : ''; }
    if (!label) label = labelFor(opts[0]) || key;
    var options = opts.map(function(o){
      var lbl = '';
      var w = o.closest('label');
      if (w) { lbl = w.textContent.replace(o.value,'').trim(); }
      if (!lbl) { var s = o.nextElementSibling; if (s && s.tagName === 'LABEL') lbl = s.textContent.trim(); }
      return { value: o.value, label: lbl || o.value };
    });
    var checked = opts.find(function(o){ return o.checked; });
    fields.push({ label: label, type: 'radio', selector: 'input[type=radio][name="' + escapeSel(key) + '"]', value: checked ? checked.value : '', options: options, required: opts[0].hasAttribute('required') });
  });

  return fields;
}
`;

/**
 * Scan a Playwright page for fillable fields.
 * Runs the self-contained scanFields() in the page context.
 */
export async function scanPage(page: import("playwright").Page): Promise<ScannedField[]> {
  // combine the source + the call, eval it
  const fn = new Function(`${scanFieldsSource}\nreturn scanFields();`);
  return page.evaluate(fn as () => ScannedField[]);
}
