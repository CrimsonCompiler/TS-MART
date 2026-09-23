const { TAKA, formatBDT, encodeJSONForAttr } = require('../../utils/format');

describe('formatBDT', () => {
  it('formats with the taka symbol and Indian locale grouping', () => {
    expect(formatBDT(1000)).toBe(`${TAKA}1,000`);
  });

  it('formats large numbers with the Indian lakh/crore separator', () => {
    // 1234567 -> 12,34,567 in en-IN locale.
    expect(formatBDT(1234567)).toBe(`${TAKA}12,34,567`);
  });

  it('handles zero', () => {
    expect(formatBDT(0)).toBe(`${TAKA}0`);
  });

  it('coerces non-numbers to 0', () => {
    expect(formatBDT(null)).toBe(`${TAKA}0`);
    expect(formatBDT(undefined)).toBe(`${TAKA}0`);
    expect(formatBDT('not a number')).toBe(`${TAKA}0`);
  });

  it('handles decimal amounts', () => {
    expect(formatBDT(99.5)).toBe(`${TAKA}99.5`);
  });
});

describe('encodeJSONForAttr', () => {
  it('returns valid JSON when entities are decoded', () => {
    const obj = { Dhaka: ["Dhaka South", "Gazipur"], Chattogram: ["Cox's Bazar"] };
    const encoded = encodeJSONForAttr(obj);
    const decoded = encoded
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    expect(JSON.parse(decoded)).toEqual(obj);
  });

  it('escapes ampersands first to avoid double-escaping later', () => {
    const obj = { a: '&' };
    const encoded = encodeJSONForAttr(obj);
    expect(encoded).toBe('{&quot;a&quot;:&quot;&amp;&quot;}');
  });

  it('encodes double quotes so attribute bounds stay intact', () => {
    expect(encodeJSONForAttr({ a: '"x"' })).toContain('&quot;');
    expect(encodeJSONForAttr({ a: '"x"' })).not.toContain('"x"');
  });

  it('encodes apostrophes so single-quoted attributes stay intact', () => {
    expect(encodeJSONForAttr({ a: "it's" })).toContain('&#39;');
    expect(encodeJSONForAttr({ a: "it's" })).not.toMatch(/'[^&]/);
  });
});
