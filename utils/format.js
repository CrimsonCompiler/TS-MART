const TAKA = '\u09F3'; // ৳

function formatBDT(amount) {
  const n = Number(amount) || 0;
  return `${TAKA}${n.toLocaleString('en-IN')}`;
}

/**
 * Stringify an object for embedding inside an HTML attribute.
 *
 * EJS scans template source for `%>` to find tag ends. The naive approach
 * of writing `JSON.stringify(x).replace(/&/g, '&amp;')` inside an EJS tag
 * breaks: the literal `%>` inside the JS string is parsed as the tag end,
 * leaving the rest of the JS dangling. So we do the stringification AND
 * HTML escaping entirely outside the template engine.
 *
 * Returns a string that is safe to drop inside either kind of HTML
 * attribute quotes — double or single. We escape both quote characters
 * because Cox's Bazar (and other BD place names) contain a real `'`,
 * and if a template wraps the attribute in single quotes the literal
 * apostrophe would otherwise terminate the attribute mid-value and
 * JSON.parse() would fail in the browser.
 */
function encodeJSONForAttr(obj) {
  return JSON.stringify(obj)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { TAKA, formatBDT, encodeJSONForAttr };