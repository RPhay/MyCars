// Dealership table (TODOS: Dealership page — table, sort, search). Vanilla JS,
// no framework, matching this app's no-build-step pattern (see references/uix-standards.md).
(() => {
  const table = document.getElementById('dealershipTable');
  if (!table) return;

  const tbody = table.querySelector('tbody');
  const headers = table.querySelectorAll('th[data-sort]');
  const searchInput = document.getElementById('dealershipSearch');
  const emptyState = document.getElementById('dealershipEmptyState');

  let sortKey = null;
  let sortDir = 1; // 1 = ascending, -1 = descending

  function setSortIcons(activeTh) {
    headers.forEach((th) => {
      const icon = th.querySelector('.sort-icon');
      if (th === activeTh) {
        icon.className = `bi sort-icon ${sortDir === 1 ? 'bi-arrow-up' : 'bi-arrow-down'}`;
      } else {
        icon.className = 'bi sort-icon bi-arrow-down-up text-muted';
      }
    });
  }

  function sortRows(key, type) {
    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.sort((a, b) => {
      let va = a.dataset[key];
      let vb = b.dataset[key];
      if (type === 'number') {
        va = Number(va);
        vb = Number(vb);
        return (va - vb) * sortDir;
      }
      return va.localeCompare(vb) * sortDir;
    });
    rows.forEach((row) => tbody.appendChild(row));
  }

  headers.forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      const type = th.dataset.type;
      sortDir = sortKey === key ? -sortDir : 1;
      sortKey = key;
      sortRows(key, type);
      setSortIcons(th);
    });
  });

  // Default: neutral icon on every sortable header until one is clicked.
  headers.forEach((th) => {
    th.querySelector('.sort-icon').className = 'bi sort-icon bi-arrow-down-up text-muted';
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const term = searchInput.value.trim().toLowerCase();
      let visibleCount = 0;
      tbody.querySelectorAll('tr').forEach((row) => {
        const match = row.dataset.search.includes(term);
        row.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });
      if (emptyState) emptyState.style.display = visibleCount === 0 ? '' : 'none';
    });
  }

  tbody.querySelectorAll('tr[data-href]').forEach((row) => {
    row.addEventListener('click', (e) => {
      // Let links/buttons inside the row (external-link icon, delete) handle
      // their own click instead of also navigating — CSP here has no
      // 'unsafe-inline', so those elements can't stopPropagation() via an
      // inline onclick, hence the guard here instead of relying on that.
      if (e.target.closest('a, button, [data-rate], [data-status], [data-spot-check-toggle]')) return;
      window.location.href = row.dataset.href;
    });
  });

  // After a row-level delete (confirm-delete.js), reload once the table is
  // empty so the server-rendered "No dealerships researched yet" state shows.
  document.addEventListener('row-deleted', () => {
    if (tbody.querySelectorAll('tr').length === 0) {
      window.location.reload();
    }
  });
})();
