(function () {
  const modeType = document.getElementById('vrModeType');
  const modeVehicle = document.getElementById('vrModeVehicle');
  if (!modeType || !modeVehicle) return;

  const lookupGroup = document.getElementById('vrLookupGroup');
  const fieldsGroup = document.getElementById('vrFieldsGroup');
  const lookupInput = document.getElementById('vehicleResearchPrefillInput');
  const btn = document.getElementById('vehicleResearchPrefillBtn');
  const status = document.getElementById('vehicleResearchPrefillStatus');

  function applyMode() {
    if (modeVehicle.checked) {
      lookupGroup.classList.remove('d-none');
      // Fields stay hidden in this mode until a lookup resolves them, so
      // there's nothing stale left over from switching modes or a prior look-up.
      fieldsGroup.classList.add('d-none');
      status.textContent = '';
    } else {
      lookupGroup.classList.add('d-none');
      fieldsGroup.classList.remove('d-none');
    }
  }

  modeType.addEventListener('change', applyMode);
  modeVehicle.addEventListener('change', applyMode);
  applyMode();

  btn.addEventListener('click', async () => {
    const input = lookupInput.value.trim();
    if (!input) return;

    btn.disabled = true;
    status.textContent = 'Looking up vehicle info…';

    try {
      const res = await fetch('/run/vehicle-research/prefill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();

      if (!res.ok) {
        status.textContent = data.error || 'Could not resolve that VIN/URL.';
        return;
      }

      if (data.year) document.getElementById('vrYear').value = data.year;
      if (data.make) document.getElementById('vrMake').value = data.make;
      if (data.model) document.getElementById('vrModel').value = data.model;
      if (data.trim) document.getElementById('vrTrim').value = data.trim;

      fieldsGroup.classList.remove('d-none');
      status.textContent = 'Filled in — review before running.';
    } catch {
      status.textContent = 'Something went wrong reaching the server.';
    } finally {
      btn.disabled = false;
    }
  });
})();
