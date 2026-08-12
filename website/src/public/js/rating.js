// Star rating + favorite/avoid toggle (TODOS: dealership and vehicle
// ratings). One delegated listener works anywhere on the site, keyed off the
// nearest [data-meta-url] container around the buttons — that attribute is
// the PUT endpoint to call (e.g. /dealerships/<domain>/meta,
// /vehicles/<make>/<model>/<year>/meta), so this file has no knowledge of
// dealerships vs. vehicles.
(() => {
  async function putMeta(url, meta) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta),
    });
    if (!res.ok) throw new Error(`Failed to update rating (${res.status})`);
    return res.json();
  }

  // Page-header widgets render their icons a size up (fs-5) — baked into the
  // server-rendered className, not tracked separately, so preserve it across
  // a click-triggered re-render instead of silently shrinking the icons back
  // to table-row size.
  function sizeClass(el) {
    return el.className.includes('fs-5') ? ' fs-5' : '';
  }

  // Fill (gold, this function's `rating` arg — the user's own rating) and
  // outline color (the AI rating, data-ai-rating on the container — red
  // through that position, black beyond it, muted if there's no aiRating at
  // all) are two independently-visible layers stacked by star-rating.ejs, so
  // a star can show red outline + gold fill at once instead of one
  // replacing the other. Only the fill layer's visibility changes here —
  // the outline color is fixed at render time (the AI rating never changes
  // from a click).
  function renderStars(container, rating) {
    container.querySelectorAll('[data-rate]').forEach((btn) => {
      const n = Number(btn.dataset.rate);
      const fillIcon = btn.querySelector('[data-star-fill]');
      if (fillIcon) fillIcon.style.opacity = n <= rating ? '1' : '0';
    });
  }

  function renderStatus(container, status) {
    const favIcon = container.querySelector('[data-status="favorite"] i');
    const avoidIcon = container.querySelector('[data-status="avoid"] i');
    if (favIcon) favIcon.className = (status === 'favorite' ? 'bi bi-heart-fill text-danger' : 'bi bi-heart text-muted') + sizeClass(favIcon);
    if (avoidIcon) avoidIcon.className = (status === 'avoid' ? 'bi bi-slash-circle text-danger' : 'bi bi-slash-circle text-muted') + sizeClass(avoidIcon);
  }

  function renderSpotCheck(btn, spotCheck) {
    const icon = btn.querySelector('i');
    if (icon) icon.className = (spotCheck ? 'bi bi-binoculars-fill text-info' : 'bi bi-binoculars text-muted') + sizeClass(icon);
    btn.dataset.spotCheck = spotCheck ? '1' : '0';
    btn.title = spotCheck
      ? "Dealership spot-check — not a car I'm looking to buy (click to unmark)"
      : "Mark as a dealership spot-check — not a car I'm looking to buy";
  }

  // Sortable tables (dealership-table.js) sort off data-rating on the <tr>
  // itself, separate from this widget's own state — keep both in sync.
  function syncRowDataset(container, key, value) {
    const row = container.closest('tr');
    if (row) row.dataset[key] = String(value);
  }

  document.addEventListener('click', async (e) => {
    const rateBtn = e.target.closest('[data-rate]');
    const statusBtn = e.target.closest('[data-status]');
    const spotCheckBtn = e.target.closest('[data-spot-check-toggle]');
    if (!rateBtn && !statusBtn && !spotCheckBtn) return;

    const container = (rateBtn || statusBtn || spotCheckBtn).closest('[data-meta-url]');
    if (!container) return;
    const metaUrl = container.dataset.metaUrl;

    try {
      if (rateBtn) {
        const clicked = Number(rateBtn.dataset.rate);
        const current = Number(container.dataset.rating || 0);
        const next = clicked === current ? 0 : clicked;
        await putMeta(metaUrl, { rating: next, status: container.dataset.status || 'none' });
        container.dataset.rating = String(next);
        renderStars(container, next);
        syncRowDataset(container, 'rating', next);
      } else if (statusBtn) {
        const clicked = statusBtn.dataset.status;
        const current = container.dataset.status || 'none';
        const next = clicked === current ? 'none' : clicked;
        await putMeta(metaUrl, { rating: Number(container.dataset.rating || 0), status: next });
        container.dataset.status = next;
        renderStatus(container, next);
      } else if (spotCheckBtn) {
        const next = spotCheckBtn.dataset.spotCheck !== '1';
        await putMeta(metaUrl, { spotCheck: next });
        renderSpotCheck(spotCheckBtn, next);
      }
    } catch {
      // Transient failure (server down, etc.) — icons simply don't update;
      // no dedicated error UI for a click-to-toggle control this small.
    }
  });
})();
