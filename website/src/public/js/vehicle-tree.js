// Vehicle treeview (vehicle-list.ejs), rendered as a real <table> so every
// row shares one typography/row-height regardless of depth — indentation
// (depth-0/1/2 classes, see main.css) is what shows the hierarchy, not
// different heading levels. Every row click-throughs to that node's own page
// (make/model/year), matching vehicle-make.ejs/vehicle-model.ejs/
// vehicle-year.ejs. Only the make row (depth 0) is also collapsible — its
// chevron is a separate click target that toggles its models/years in place
// instead of navigating; its models/years show or hide together with it
// (no separate per-model collapse). Search matches against each row's own
// data-search blob, which already includes all of that row's descendant
// text (built once in the EJS template) — so a match anywhere under a make
// makes the make, its model, and that year all match independently, without
// needing runtime ancestor propagation.
(() => {
  const table = document.getElementById('vehicleTreeTable');
  if (!table) return;

  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const searchInput = document.getElementById('vehicleSearch');
  const emptyState = document.getElementById('vehicleEmptyState');

  function applyVisibility() {
    const term = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let anyVisible = false;

    rows.forEach((row) => {
      let visible;
      if (term) {
        visible = row.dataset.search.includes(term);
      } else if (row.dataset.depth === '0') {
        visible = true;
      } else {
        const makeRow = tbody.querySelector(`tr[data-node-id="${row.dataset.makeId}"]`);
        visible = !!makeRow && makeRow.dataset.expanded === 'true';
      }
      row.style.display = visible ? '' : 'none';
      if (visible) anyVisible = true;
    });

    if (emptyState) emptyState.style.display = term && !anyVisible ? '' : 'none';
  }

  rows.forEach((row) => {
    if (row.dataset.depth === '0') {
      // Chevron toggles expand/collapse in place; clicking anywhere else on
      // the row navigates to that make's own page — same click-through
      // behavior as every other row, just with one extra target reserved
      // for the toggle.
      row.addEventListener('click', (e) => {
        if (e.target.closest('.tree-chevron')) {
          row.dataset.expanded = row.dataset.expanded === 'true' ? 'false' : 'true';
          applyVisibility();
          return;
        }
        if (e.target.closest('a, button')) return;
        if (row.dataset.href) window.location.href = row.dataset.href;
      });
    } else if (row.dataset.href) {
      row.addEventListener('click', (e) => {
        if (e.target.closest('a, button')) return;
        window.location.href = row.dataset.href;
      });
    }
  });

  if (searchInput) {
    searchInput.addEventListener('input', applyVisibility);
  }

  applyVisibility();
})();
