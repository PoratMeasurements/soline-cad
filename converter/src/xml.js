'use strict';
// Minimal dependency-free XML parser, sufficient for well-formed ORDX files.
// Produces a tree of nodes: { name, attrs:{}, children:[node...], text:string }
// Handles: XML declaration, comments (incl. inline), attributes, self-closing
// tags, and text content. Not a full XML spec parser (no DTD/CDATA/entities
// beyond the common five), but robust for the ORDX schema.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, code) => {
    if (code[0] === '#') {
      const cp = code[1] === 'x' || code[1] === 'X'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, code) ? ENTITIES[code] : m;
  });
}

function parseAttrs(str) {
  const attrs = {};
  const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(str))) {
    attrs[m[1]] = decodeEntities(m[3] !== undefined ? m[3] : m[4]);
  }
  return attrs;
}

function parseXml(input) {
  // Strip BOM
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);

  const root = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  let i = 0;
  const n = input.length;

  const top = () => stack[stack.length - 1];

  while (i < n) {
    const lt = input.indexOf('<', i);
    if (lt < 0) {
      // trailing text
      const t = input.slice(i);
      if (t.trim()) top().text += decodeEntities(t);
      break;
    }
    // text before this tag
    if (lt > i) {
      const t = input.slice(i, lt);
      if (t.trim()) top().text += decodeEntities(t);
    }

    if (input.startsWith('<?', lt)) {           // processing instruction / decl
      i = input.indexOf('?>', lt);
      i = i < 0 ? n : i + 2;
      continue;
    }
    if (input.startsWith('<!--', lt)) {          // comment
      i = input.indexOf('-->', lt);
      i = i < 0 ? n : i + 3;
      continue;
    }
    if (input.startsWith('<![CDATA[', lt)) {     // CDATA
      const end = input.indexOf(']]>', lt);
      const data = input.slice(lt + 9, end < 0 ? n : end);
      top().text += data;
      i = end < 0 ? n : end + 3;
      continue;
    }
    if (input.startsWith('<!', lt)) {            // DOCTYPE etc.
      i = input.indexOf('>', lt);
      i = i < 0 ? n : i + 1;
      continue;
    }

    const gt = input.indexOf('>', lt);
    if (gt < 0) break;
    let tag = input.slice(lt + 1, gt).trim();

    if (tag[0] === '/') {                         // closing tag
      const name = tag.slice(1).trim();
      // pop to matching (tolerant of minor mismatches)
      for (let s = stack.length - 1; s >= 1; s--) {
        if (stack[s].name === name) { stack.length = s; break; }
      }
      i = gt + 1;
      continue;
    }

    const selfClose = tag.endsWith('/');
    if (selfClose) tag = tag.slice(0, -1).trim();

    const sp = tag.search(/\s/);
    const name = sp < 0 ? tag : tag.slice(0, sp);
    const attrs = sp < 0 ? {} : parseAttrs(tag.slice(sp + 1));
    const node = { name, attrs, children: [], text: '' };
    top().children.push(node);
    if (!selfClose) stack.push(node);
    i = gt + 1;
  }

  return root;
}

// ---- convenience accessors ----
function child(node, name) {
  if (!node) return null;
  return node.children.find((c) => c.name === name) || null;
}
function childrenNamed(node, name) {
  if (!node) return [];
  return node.children.filter((c) => c.name === name);
}
// Follow a slash path of element names, returning the trimmed text or ''.
function textAt(node, path) {
  let cur = node;
  for (const part of path.split('/')) {
    cur = child(cur, part);
    if (!cur) return '';
  }
  return (cur.text || '').trim();
}
// Same but returns the node.
function nodeAt(node, path) {
  let cur = node;
  for (const part of path.split('/')) {
    cur = child(cur, part);
    if (!cur) return null;
  }
  return cur;
}

module.exports = { parseXml, child, childrenNamed, textAt, nodeAt, decodeEntities };
