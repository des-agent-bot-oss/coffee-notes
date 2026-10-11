// Placeholder shell behaviour for T1: proves the page is served by the same
// process as the API. The real UI replaces this module in task T2.

const target = document.querySelector('[data-health]');

async function showHealth() {
  if (!target) return;
  try {
    const response = await fetch('/api/health');
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(`HTTP ${response.status}`);
    target.dataset.state = 'ok';
    target.textContent = `API healthy — version ${payload.version}, database ${payload.db}.`;
  } catch (error) {
    target.dataset.state = 'error';
    target.textContent = `API unreachable (${error.message}). Is the server running?`;
  }
}

showHealth();
