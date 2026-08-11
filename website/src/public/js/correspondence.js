// Correspondence log add-form (TODOS: dealership correspondence). Per-entry
// delete is handled generically by confirm-delete.js already (context="row")
// — this only handles submitting a new entry. Reloads on success rather than
// building a client-side render of the new row, to avoid duplicating the
// entry markup in both EJS and JS for a form that's used rarely, not in a
// hot loop.
(() => {
  const form = document.getElementById('correspondenceForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const res = await fetch(form.dataset.correspondenceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date.value,
          method: form.method.value,
          who: form.who.value,
          car: form.car.value,
          summary: form.summary.value,
        }),
      });
      if (!res.ok) throw new Error(`Failed to add entry (${res.status})`);
      window.location.reload();
    } catch {
      submitBtn.disabled = false;
    }
  });
})();
