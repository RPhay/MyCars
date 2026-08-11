(function () {
  const modalEl = document.getElementById('researchModal');
  if (!modalEl) return;

  const bsModal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
  const titleEl = document.getElementById('researchTitle');
  const carIcon = document.getElementById('researchCarIcon');
  const statusEl = document.getElementById('researchStatus');
  const logEl = document.getElementById('researchLog');
  const questionEl = document.getElementById('researchQuestion');
  const questionTextEl = document.getElementById('researchQuestionText');
  const choicesEl = document.getElementById('researchQuestionChoices');
  const textGroupEl = document.getElementById('researchQuestionTextGroup');
  const answerInput = document.getElementById('researchAnswerInput');
  const answerSubmit = document.getElementById('researchAnswerSubmit');
  const resultEl = document.getElementById('researchResult');
  const cancelBtn = document.getElementById('researchCancelBtn');

  let currentSource = null;
  let currentRunId = null;
  let finished = false;

  function log(text, cls) {
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = text;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function resetModal(title) {
    titleEl.textContent = title;
    statusEl.textContent = 'Starting…';
    statusEl.className = 'fw-semibold mb-2';
    logEl.textContent = '';
    resultEl.classList.add('d-none');
    resultEl.textContent = '';
    hideQuestion();
    carIcon.classList.remove('is-paused');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.classList.remove('btn-secondary');
    cancelBtn.classList.add('btn-outline-danger');
    finished = false;
    currentRunId = null;
  }

  function hideQuestion() {
    questionEl.classList.add('d-none');
    choicesEl.innerHTML = '';
    textGroupEl.classList.add('d-none');
    answerInput.value = '';
  }

  // Renders a question and resolves with the answer once the user responds —
  // used both for questions the server emits mid-run, and for the initial
  // "what VIN/URL/dealership?" prompt before a run even starts.
  function askQuestion(q) {
    return new Promise((resolve) => {
      carIcon.classList.add('is-paused');
      questionTextEl.textContent = q.text;
      questionEl.classList.remove('d-none');

      const finish = (answer) => {
        hideQuestion();
        carIcon.classList.remove('is-paused');
        resolve(answer);
      };

      if (q.kind === 'choice') {
        choicesEl.innerHTML = '';
        textGroupEl.classList.add('d-none');
        (q.options || []).forEach((opt) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn-primary btn-sm';
          btn.textContent = opt;
          btn.addEventListener('click', () => finish(opt));
          choicesEl.appendChild(btn);
        });
      } else {
        choicesEl.innerHTML = '';
        textGroupEl.classList.remove('d-none');
        answerInput.placeholder = q.placeholder || '';
        answerInput.value = '';
        answerInput.focus();
        const onSubmit = () => finish(answerInput.value);
        answerSubmit.onclick = onSubmit;
        answerInput.onkeydown = (e) => {
          if (e.key === 'Enter') onSubmit();
        };
      }
    });
  }

  function connect(id) {
    currentRunId = id;
    const source = new EventSource(`/api/runs/${id}/events`);
    currentSource = source;

    source.addEventListener('phase', (e) => {
      const data = JSON.parse(e.data);
      statusEl.textContent = data.text;
      log(data.text + (data.detail ? ` — ${data.detail}` : ''), 'phase-line');
    });

    source.addEventListener('output', (e) => {
      const data = JSON.parse(e.data);
      log(data.text);
    });

    source.addEventListener('question', async (e) => {
      const q = JSON.parse(e.data);
      const answer = await askQuestion(q);
      await fetch(`/api/runs/${id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      });
    });

    source.addEventListener('done', (e) => {
      const data = JSON.parse(e.data);
      finish(data.error ? 'error' : 'done', data);
    });
    source.addEventListener('error', (e) => {
      let data = {};
      try {
        data = JSON.parse(e.data);
      } catch {
        // connection-level error, not a payload
      }
      finish('error', data);
    });
    source.addEventListener('cancelled', () => finish('cancelled', {}));
  }

  function finish(state, data) {
    finished = true;
    if (currentSource) {
      currentSource.close();
      currentSource = null;
    }
    carIcon.classList.remove('is-paused');
    carIcon.style.animationPlayState = 'paused';

    if (state === 'done') {
      statusEl.textContent = 'Done.';
      statusEl.className = 'fw-semibold mb-2 text-success';
      if (data.result?.path) {
        resultEl.classList.remove('d-none');
        resultEl.innerHTML = `Saved to <code>${data.result.path}</code>. Reload the page to see it.`;
      }
    } else if (state === 'cancelled') {
      statusEl.textContent = 'Cancelled.';
      statusEl.className = 'fw-semibold mb-2 text-muted';
    } else {
      statusEl.textContent = 'Failed.';
      statusEl.className = 'fw-semibold mb-2 text-danger';
      resultEl.classList.remove('d-none');
      resultEl.innerHTML = '';

      const reason = document.createElement('div');
      reason.textContent = data.message || data.error || 'Unknown error.';
      resultEl.appendChild(reason);

      if (data.cliPrompt) {
        const hint = document.createElement('div');
        hint.className = 'fw-semibold mt-2';
        hint.textContent = 'Run this from the Claude CLI instead:';
        resultEl.appendChild(hint);

        const row = document.createElement('div');
        row.className = 'd-flex align-items-start gap-2 mt-1';

        const code = document.createElement('pre');
        code.className = 'bg-light border rounded p-2 mb-0 flex-grow-1';
        code.style.whiteSpace = 'pre-wrap';
        code.style.fontSize = '0.8rem';
        code.textContent = `claude -p "${data.cliPrompt.replace(/"/g, '\\"')}"`;
        row.appendChild(code);

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn btn-outline-secondary btn-sm flex-shrink-0';
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(`claude -p "${data.cliPrompt.replace(/"/g, '\\"')}"`);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => (copyBtn.textContent = 'Copy'), 1500);
          } catch {
            copyBtn.textContent = 'Copy failed';
          }
        });
        row.appendChild(copyBtn);

        resultEl.appendChild(row);
      }

      if (data.technical) log(data.technical, 'phase-line detail');
    }

    cancelBtn.textContent = 'Close';
    cancelBtn.classList.remove('btn-outline-danger');
    cancelBtn.classList.add('btn-secondary');
  }

  cancelBtn.addEventListener('click', async () => {
    if (finished) {
      bsModal.hide();
      return;
    }
    if (currentRunId) {
      await fetch(`/api/runs/${currentRunId}/cancel`, { method: 'POST' });
    }
    if (currentSource) {
      currentSource.close();
      currentSource = null;
    }
    finish('cancelled', {});
  });

  async function beginVehicleRun(input) {
    if (!input) return;
    log(`Input: ${input}`);
    const res = await fetch('/api/runs/vehicle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    });
    const data = await res.json();
    if (!res.ok) return finish('error', data);
    connect(data.id);
  }

  async function beginSkillRun(payload) {
    const res = await fetch('/api/runs/skill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return finish('error', data);
    connect(data.id);
  }

  async function handleTrigger(el) {
    const kind = el.dataset.research;

    if (kind === 'vehicle') {
      resetModal('Researching vehicle…');
      bsModal.show();
      const input = el.dataset.input || (await askQuestion({ kind: 'text', text: 'VIN or vehicle URL?', placeholder: 'VIN or URL...' }));
      beginVehicleRun(input);
      return;
    }

    if (kind === 'skill') {
      const skill = el.dataset.skill;
      if (skill === 'dealership-analyzer') {
        resetModal('Researching dealership…');
        bsModal.show();
        const url = el.dataset.url || (await askQuestion({ kind: 'text', text: 'Dealership URL?', placeholder: 'https://...' }));
        beginSkillRun({ skill, url, spotCheck: el.dataset.spotCheck === 'true' });
        return;
      }
      if (skill === 'vehicle-research') {
        resetModal('Researching vehicle type…');
        bsModal.show();
        const model = el.dataset.model || (await askQuestion({ kind: 'text', text: `Which ${el.dataset.make} model?`, placeholder: 'e.g. M235i' }));
        const year = el.dataset.year || (await askQuestion({ kind: 'text', text: `Which year of ${el.dataset.make} ${model}?`, placeholder: 'e.g. 2020' }));
        beginSkillRun({
          skill,
          make: el.dataset.make,
          model,
          year,
          trim: el.dataset.trim,
        });
        return;
      }
    }
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-research]');
    if (el) handleTrigger(el);
  });
})();
