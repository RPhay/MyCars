import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

// Generic run engine for hard-coded research workflows. Mirrors
// skillRunner.js's runs-Map + SSE-replay pattern, but the event producer is
// the workflow's own code (phase/question/done) instead of a claude child
// process's stdout.
const runs = new Map();

export class CancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'CancelledError';
  }
}

// `workflowFn(ctx, input)` does the actual research. `ctx` gives it:
// - ctx.phase(text, detail?) — announce what's happening now
// - ctx.question({ kind: 'choice'|'text', text, options? }) — pause and wait
//   for a real answer from the browser (a promise that resolves when
//   answerQuestion() is called for this run)
// - ctx.signal — an AbortSignal to pass into fetch() calls so Cancel actually
//   interrupts in-flight network requests, not just phase boundaries
// - ctx.cancelled() — check before/after any await that isn't itself abortable
export function startWorkflow(workflowFn, input) {
  const id = randomUUID();
  const emitter = new EventEmitter();
  const controller = new AbortController();
  const record = {
    emitter,
    buffer: [],
    done: false,
    cancelled: false,
    pendingAnswer: null,
    controller,
  };
  runs.set(id, record);

  const emit = (event, data) => {
    const chunk = { event, data };
    record.buffer.push(chunk);
    emitter.emit('event', chunk);
  };

  const ctx = {
    phase(text, detail) {
      if (record.cancelled) throw new CancelledError();
      emit('phase', { text, detail: detail || null });
    },
    question(q) {
      if (record.cancelled) throw new CancelledError();
      return new Promise((resolve) => {
        record.pendingAnswer = resolve;
        emit('question', q);
      }).then((answer) => {
        if (record.cancelled) throw new CancelledError();
        return answer;
      });
    },
    cancelled() {
      return record.cancelled;
    },
    signal: controller.signal,
  };

  (async () => {
    try {
      const result = await workflowFn(ctx, input);
      record.done = true;
      emit('done', { result });
    } catch (err) {
      record.done = true;
      if (err instanceof CancelledError) {
        emit('cancelled', {});
      } else {
        emit('error', { error: err.message || String(err) });
      }
    }
  })();

  // Trim finished runs after a while so this doesn't grow unbounded across a
  // long session — same housekeeping as skillRunner.js's run map.
  setTimeout(
    () => {
      if (record.done) runs.delete(id);
    },
    30 * 60 * 1000,
  );

  return id;
}

export function answerQuestion(id, answer) {
  const record = runs.get(id);
  if (!record || !record.pendingAnswer) return false;
  const resolve = record.pendingAnswer;
  record.pendingAnswer = null;
  resolve(answer);
  return true;
}

export function cancelWorkflow(id) {
  const record = runs.get(id);
  if (!record) return false;
  record.cancelled = true;
  record.controller.abort();
  if (record.pendingAnswer) {
    const resolve = record.pendingAnswer;
    record.pendingAnswer = null;
    resolve(undefined);
  }
  return true;
}

export function getWorkflowRun(id) {
  return runs.get(id);
}
