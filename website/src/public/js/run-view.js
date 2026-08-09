(function () {
  const root = document.getElementById('runRoot');
  const output = document.getElementById('runOutput');
  const status = document.getElementById('runStatus');
  const source = new EventSource('/run/events/' + root.dataset.runId);

  source.addEventListener('chunk', (event) => {
    const data = JSON.parse(event.data);
    output.textContent += data.text;
    output.scrollTop = output.scrollHeight;
  });

  source.addEventListener('done', (event) => {
    const data = JSON.parse(event.data);
    source.close();
    if (data.error) {
      status.className = 'alert alert-danger';
      status.textContent = 'Failed to start: ' + data.error;
    } else if (data.exitCode === 0) {
      status.className = 'alert alert-success';
      status.textContent = 'Done.';
    } else {
      status.className = 'alert alert-danger';
      status.textContent = 'Exited with code ' + data.exitCode + '. If this needed the browser tools, run it from the terminal instead.';
    }
  });

  source.onerror = () => {
    // EventSource auto-retries on transient network errors; if the server
    // already sent "done" it closed the connection itself, so a subsequent
    // error here just means there's nothing left to reconnect to.
  };
})();
