/* TS-Mart checkout page — cascading district dropdown + live delivery/total.
 *
 * Reads its configuration from data-* attributes on the form fields and a
 * single hidden #selectedDistrict input. This keeps the script CSP-friendly
 * (no inline JSON, no eval) while still letting the server pass per-request
 * state into the page.
 */
(function () {
  const TAKA = '\u09F3'; // ৳

  const divSel = document.getElementById('divisionSelect');
  const distSel = document.getElementById('districtSelect');
  const feeEl = document.getElementById('deliveryFee');
  const totalEl = document.getElementById('grandTotal');
  const hintEl = document.getElementById('deliveryHint');
  const selectedDistrictEl = document.getElementById('selectedDistrict');

  if (!divSel || !distSel || !feeEl || !totalEl) return;

  let byDivision = {};
  try {
    byDivision = JSON.parse(divSel.dataset.districts || '{}');
  } catch (_) {
    byDivision = {};
  }
  const selectedDistrict = selectedDistrictEl ? selectedDistrictEl.value : '';
  const subtotal = Number(totalEl.dataset.subtotal || 0);
  const DHAKA_FEE = Number(divSel.dataset.dhakaFee || 60);
  const OUTSIDE_FEE = Number(divSel.dataset.outsideFee || 120);
  const dhakaLabel = divSel.dataset.dhakaLabel || ('\u09F3' + DHAKA_FEE + ' Dhaka');
  const outsideLabel = divSel.dataset.outsideLabel || ('\u09F3' + OUTSIDE_FEE + ' outside');

  function fmt(n) {
    return TAKA + Math.round(n).toLocaleString('en-IN');
  }

  function refreshDistricts() {
    const list = byDivision[divSel.value] || [];
    const opts = ['<option value="">Select district</option>'].concat(
      list.map(function (d) {
        const sel = d === selectedDistrict ? ' selected' : '';
        return '<option value="' + d + '"' + sel + '>' + d + '</option>';
      })
    );
    distSel.innerHTML = opts.join('');
  }

  function refreshFee() {
    const division = divSel.value;
    if (!division) {
      feeEl.textContent = '--';
      totalEl.textContent = fmt(subtotal);
      hintEl.textContent = '(' + dhakaLabel + ' \u00B7 ' + outsideLabel + ')';
      return;
    }
    const fee = division === 'Dhaka' ? DHAKA_FEE : OUTSIDE_FEE;
    feeEl.textContent = fmt(fee);
    totalEl.textContent = fmt(subtotal + fee);
    hintEl.textContent = division === 'Dhaka' ? '(inside Dhaka)' : '(outside Dhaka)';
  }

  divSel.addEventListener('change', function () {
    refreshDistricts();
    refreshFee();
  });
  refreshDistricts();
  refreshFee();
})();
