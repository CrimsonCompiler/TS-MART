/**
 * Regression test for the cascading district dropdown.
 *
 * The checkout page encodes DISTRICTS_BY_DIVISION as JSON inside an HTML
 * attribute. If we forget to HTML-escape the JSON, characters like `"` or
 * the apostrophe in `Cox's Bazar` will break the attribute boundary and
 * JSON.parse() will fail in the browser — districts won't appear when the
 * user picks a division.
 *
 * The EJS template uses `encodeJSONForAttr()` (defined in utils/format.js).
 * If we ever replace its encoding logic, this test will fail — that's the
 * point. It also exercises a node-side equivalent: the helper's output,
 * after decoding the entities back, must parse as the original map.
 *
 * History: this test was first written when the bug was the `"` in JSON
 * breaking a double-quoted attribute. After fixing that, the bug moved
 * to the apostrophe in `Cox's Bazar` breaking a single-quoted attribute —
 * hence the `&#39;` decode below.
 */

const { DISTRICTS_BY_DIVISION } = require('../../utils/validation');
const { encodeJSONForAttr } = require('../../utils/format');

// Simulate what a browser does when reading a data-* attribute: decode
// the named/numeric entities we emit back to the original characters.
function decodeAttributeValue(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

describe('checkout district dropdown attribute', () => {
  it('round-trips through the production encoder and JSON.parse', () => {
    const encoded = encodeJSONForAttr(DISTRICTS_BY_DIVISION);
    const decoded = decodeAttributeValue(encoded);
    const parsed = JSON.parse(decoded);
    expect(parsed).toEqual(DISTRICTS_BY_DIVISION);
  });

  it('preserves district names containing apostrophes (Cox\'s Bazar)', () => {
    const data = { Chattogram: ["Cox's Bazar"] };
    const encoded = encodeJSONForAttr(data);
    const decoded = decodeAttributeValue(encoded);
    const parsed = JSON.parse(decoded);
    expect(parsed.Chattogram).toEqual(["Cox's Bazar"]);
  });

  it('encodes apostrophes so single-quoted attributes stay intact', () => {
    const data = { foo: "it's" };
    const encoded = encodeJSONForAttr(data);
    expect(encoded).not.toMatch(/'[^&]/);     // no raw `'` left
    expect(encoded).toContain('&#39;');      // every `'` is encoded
  });

  it('encodes double quotes so double-quoted attributes stay intact', () => {
    const data = { foo: 'a"b' };
    const encoded = encodeJSONForAttr(data);
    expect(encoded).toContain('&quot;');
  });

  it('escapes & first so we do not double-encode other entities', () => {
    // If & were escaped last, "&quot;" would become "&amp;quot;" and the
    // browser would render the literal text "&quot;" instead of `"`.
    const data = { a: '&' };
    const encoded = encodeJSONForAttr(data);
    // JSON.stringify({a:'&'}) → '{"a":"&"}'  → escape & →  '"&"' becomes '"&amp;"'
    expect(encoded).toBe('{&quot;a&quot;:&quot;&amp;&quot;}');
    // And the encoder must not contain any raw "&" that is followed by a
    // character other than "amp;" (the only valid one we emit).
    expect(encoded).not.toMatch(/&(?!(amp|quot|apos|#39|lt|gt);)/);
  });

  it('preserves all 64 official districts', () => {
    const total = Object.values(DISTRICTS_BY_DIVISION).reduce((s, list) => s + list.length, 0);
    expect(total).toBe(64);
    const encoded = encodeJSONForAttr(DISTRICTS_BY_DIVISION);
    const parsed = JSON.parse(decodeAttributeValue(encoded));
    const roundTotal = Object.values(parsed).reduce((s, list) => s + list.length, 0);
    expect(roundTotal).toBe(64);
  });

  it('produces output safe inside BOTH single- and double-quoted attributes', () => {
    const encoded = encodeJSONForAttr(DISTRICTS_BY_DIVISION);
    // Re-wrap the value inside the two kinds of HTML quotes; both must
    // still be parseable. We model the attribute as a tiny HTML fragment.
    for (const q of ['"', "'"]) {
      const html = `<div data-foo=${q}${encoded}${q}></div>`;
      // Strip outer wrapper, take the attribute value, decode.
      const m = html.match(new RegExp(`data-foo=${q}([^${q}]*)${q}`));
      expect(m).not.toBeNull();
      const decoded = decodeAttributeValue(m[1]);
      expect(() => JSON.parse(decoded)).not.toThrow();
    }
  });
});
