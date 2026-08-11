// Bootstrap popovers for the N/10 analysis rating shown in tables — hover
// (or focus, for keyboard/touch) reveals the "Bottom line" reasoning behind
// the number instead of that reasoning taking up its own table column.
(() => {
  document.querySelectorAll('[data-bs-toggle="popover"]').forEach((el) => {
    new bootstrap.Popover(el);
  });
})();
