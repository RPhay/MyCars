// Free-text notes (TODOS: vehicle "specific pages" notes). Generic like
// rating.js — driven by data-notes-url on the wrapping container, so it
// isn't tied to vehicles specifically. Explicit Save button rather than
// autosave: a background save on a free-text field the user is still typing
// in is more surprising than helpful for a personal single-user app.
(() => {
  document.querySelectorAll('[data-notes-url]').forEach((container) => {
    const textarea = container.querySelector('textarea');
    const saveBtn = container.querySelector('[data-notes-save]');
    const savedIndicator = container.querySelector('[data-notes-saved]');
    if (!textarea || !saveBtn) return;

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      if (savedIndicator) savedIndicator.style.display = 'none';
      try {
        const res = await fetch(container.dataset.notesUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: textarea.value }),
        });
        if (!res.ok) throw new Error(`Failed to save notes (${res.status})`);
        if (savedIndicator) {
          savedIndicator.textContent = 'Saved.';
          savedIndicator.style.display = '';
          setTimeout(() => {
            savedIndicator.style.display = 'none';
          }, 2000);
        }
      } catch {
        if (savedIndicator) {
          savedIndicator.textContent = 'Save failed — try again.';
          savedIndicator.className = 'text-danger ms-2';
          savedIndicator.style.display = '';
        }
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save notes';
      }
    });
  });
})();
