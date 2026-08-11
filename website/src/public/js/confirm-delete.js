// Generic destructive-action confirmation, driven by data attributes:
//   data-delete-url="/dealerships/foo.com"   — DELETE endpoint to call
//   data-delete-name="Foo Motors"            — shown in the confirmation text
//   data-delete-context="row" | "page"       — "row" removes the element
//       matching data-delete-row-selector from the DOM on success;
//       "page" redirects to data-delete-redirect on success.
(function () {
  const modalEl = document.getElementById('confirmModal');
  if (!modalEl) return;

  const bsModal = new bootstrap.Modal(modalEl);
  const bodyEl = document.getElementById('confirmModalBody');
  const confirmBtn = document.getElementById('confirmModalConfirmBtn');

  let pending = null;

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-delete-url]');
    if (!trigger) return;
    e.preventDefault();
    e.stopPropagation();

    pending = {
      url: trigger.dataset.deleteUrl,
      context: trigger.dataset.deleteContext || 'page',
      redirect: trigger.dataset.deleteRedirect || '/',
      row: trigger.dataset.deleteRowSelector ? trigger.closest(trigger.dataset.deleteRowSelector) : null,
    };
    bodyEl.textContent = `Delete "${trigger.dataset.deleteName || 'this entry'}"? This can't be undone.`;
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Delete';
    bsModal.show();
  });

  confirmBtn.addEventListener('click', async () => {
    if (!pending) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting…';
    try {
      const res = await fetch(pending.url, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);

      if (pending.context === 'row' && pending.row) {
        pending.row.remove();
        document.dispatchEvent(new CustomEvent('row-deleted'));
      } else {
        window.location.href = pending.redirect;
        return;
      }
      bsModal.hide();
    } catch (err) {
      bodyEl.textContent = err.message || 'Something went wrong.';
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Retry';
    }
  });
})();
