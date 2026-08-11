// "Add a dealership" modal (dealership-list.ejs) — creates an unresearched
// stub entry (name + URL only) and jumps to its page, where "Research" does
// the actual work. Not a research trigger itself.
(() => {
  const form = document.getElementById('addDealershipForm');
  if (!form) return;

  const errorEl = document.getElementById('addDealershipError');
  const modalEl = document.getElementById('addDealershipModal');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await fetch('/dealerships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.elements.name.value.trim(),
          url: form.elements.url.value.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add dealership.');
      window.location.href = `/dealerships/${encodeURIComponent(data.domain)}`;
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = '';
      submitBtn.disabled = false;
    }
  });

  modalEl.addEventListener('hidden.bs.modal', () => {
    form.reset();
    errorEl.style.display = 'none';
  });
})();
