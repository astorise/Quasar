const SENSITIVE_INPUT_TYPES = new Set(['password', 'tel', 'email', 'credit-card']);
const MASK_ATTRIBUTE = 'data-quasar-mask';
const MASK_PLACEHOLDER = '••••••';

function isMaskedElement(element) {
  if (!element || element.nodeType !== 1) return false;
  if (typeof element.hasAttribute === 'function' && element.hasAttribute(MASK_ATTRIBUTE)) return true;
  if (element.tagName === 'INPUT') {
    const type = element.getAttribute('type');
    if (type && SENSITIVE_INPUT_TYPES.has(type.toLowerCase())) return true;
  }
  return false;
}

export function sanitizeMutationValue(target, attribute, value) {
  if (!target || target.nodeType !== 1) return value;
  if (attribute === 'value' && isMaskedElement(target)) return MASK_PLACEHOLDER;
  return value;
}

export function createDomRecorder({
  doc = typeof document !== 'undefined' ? document : null,
  onPatch,
  now = () => Date.now(),
} = {}) {
  if (typeof onPatch !== 'function') throw new Error('dom-recorder: onPatch is required');
  if (!doc || typeof MutationObserver === 'undefined') {
    return { start() { /* noop in non-DOM env */ }, stop() { /* noop */ } };
  }

  const observer = new MutationObserver((mutations) => {
    const patches = [];
    for (const mutation of mutations) {
      if (isMaskedElement(mutation.target)) continue;
      if (mutation.type === 'characterData') {
        patches.push({
          op: 'text',
          ts: now(),
          target: descriptorFor(mutation.target.parentNode),
          value: mutation.target.data,
        });
      } else if (mutation.type === 'attributes') {
        patches.push({
          op: 'attr',
          ts: now(),
          target: descriptorFor(mutation.target),
          name: mutation.attributeName,
          value: sanitizeMutationValue(
            mutation.target,
            mutation.attributeName,
            mutation.target.getAttribute(mutation.attributeName),
          ),
        });
      } else if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (isMaskedElement(node)) continue;
          patches.push({
            op: 'add',
            ts: now(),
            target: descriptorFor(mutation.target),
            node: serializeNode(node),
          });
        }
        for (const node of mutation.removedNodes) {
          patches.push({
            op: 'remove',
            ts: now(),
            target: descriptorFor(mutation.target),
            node: descriptorFor(node),
          });
        }
      }
    }
    if (patches.length > 0) onPatch(patches);
  });

  return {
    start() {
      observer.observe(doc.documentElement || doc.body || doc, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    },
    stop() {
      observer.disconnect();
    },
  };
}

export function descriptorFor(node) {
  if (!node) return null;
  if (node.nodeType !== 1) return { type: node.nodeType };
  const id = node.id ? `#${node.id}` : '';
  const tag = node.tagName ? node.tagName.toLowerCase() : 'unknown';
  return { type: 1, tag, id, path: pathOf(node) };
}

function pathOf(node) {
  const segments = [];
  let cursor = node;
  while (cursor && cursor.nodeType === 1 && segments.length < 12) {
    const parent = cursor.parentNode;
    if (!parent) break;
    const idx = Array.prototype.indexOf.call(parent.childNodes, cursor);
    segments.unshift(`${cursor.tagName.toLowerCase()}[${idx}]`);
    cursor = parent;
  }
  return segments.join('>');
}

function serializeNode(node) {
  if (!node) return null;
  if (node.nodeType === 3) return { type: 3, text: node.data };
  if (node.nodeType !== 1) return { type: node.nodeType };
  return {
    type: 1,
    tag: node.tagName.toLowerCase(),
    attrs: Array.from(node.attributes || []).reduce((acc, attr) => {
      acc[attr.name] = sanitizeMutationValue(node, attr.name, attr.value);
      return acc;
    }, {}),
    masked: isMaskedElement(node),
  };
}

export { MASK_ATTRIBUTE, MASK_PLACEHOLDER, SENSITIVE_INPUT_TYPES, isMaskedElement };
