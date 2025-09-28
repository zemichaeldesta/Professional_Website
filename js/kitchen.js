(function () {
  const clockEl = document.querySelector('[data-kitchen-clock]');
  const totalEl = document.querySelector('[data-kitchen-total]');
  const queuedEl = document.querySelector('[data-kitchen-queued]');
  const cookingEl = document.querySelector('[data-kitchen-cooking]');
  const readyEl = document.querySelector('[data-kitchen-ready]');

  function updateClock() {
    if (!clockEl) {
      return;
    }
    const now = new Date();
    const options = { hour: 'numeric', minute: '2-digit' };
    const formatted = new Intl.DateTimeFormat('en-US', options).format(now);
    clockEl.textContent = formatted;
  }

  function updateCounts() {
    const cards = document.querySelectorAll('.kitchen-order-card');
    const totals = { queued: 0, cooking: 0, ready: 0 };

    cards.forEach((card) => {
      const status = card.getAttribute('data-order-status');
      if (status && Object.prototype.hasOwnProperty.call(totals, status)) {
        totals[status] += 1;
      }
    });

    if (totalEl) {
      totalEl.textContent = cards.length;
    }
    if (queuedEl) {
      queuedEl.textContent = totals.queued;
    }
    if (cookingEl) {
      cookingEl.textContent = totals.cooking;
    }
    if (readyEl) {
      readyEl.textContent = totals.ready;
    }
  }

  updateClock();
  updateCounts();

  setInterval(updateClock, 30000);
  setInterval(updateCounts, 15000);
})();