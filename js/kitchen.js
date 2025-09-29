(function () {
  const API_BASE = window.__API_BASE__ || 'http://localhost:4000/api';
  const AUTH = window.DelicatoAuth;

  const authorized = AUTH && typeof AUTH.requireAuth === 'function'
    ? AUTH.requireAuth({ roles: ['kitchen', 'staff', 'manager'], redirectTo: 'signin.html', next: 'kitchen.html' })
    : null;

  if (AUTH && typeof AUTH.requireAuth === 'function' && !authorized) {
    return;
  }

  const clockEl = document.querySelector('[data-kitchen-clock]');
  const totalEl = document.querySelector('[data-kitchen-total]');
  const queuedEl = document.querySelector('[data-kitchen-queued]');
  const cookingEl = document.querySelector('[data-kitchen-cooking]');
  const readyEl = document.querySelector('[data-kitchen-ready]');
  const ordersGrid = document.querySelector('[data-orders-grid]');
  const emptyStateEl = document.querySelector('[data-orders-empty]');
  const metaEl = document.querySelector('[data-orders-meta]');

  if (!ordersGrid) {
    return;
  }

  const cssEscape = (window.CSS && typeof window.CSS.escape === 'function')
    ? window.CSS.escape
    : (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, '_');

  const STATUS_LABEL = {
    pending: 'Queued',
    in_progress: 'Cooking',
    ready: 'Ready',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };

  const STATUS_FLOW = {
    pending: { label: 'Fire', next: 'in_progress' },
    in_progress: { label: 'Ready', next: 'ready' },
    ready: { label: 'Complete', next: 'completed' }
  };

  let ordersState = [];
  let refreshHandle = null;

  function setMeta(message, tone) {
    if (!metaEl) {
      return;
    }
    metaEl.textContent = message;
    if (tone) {
      metaEl.dataset.tone = tone;
    } else {
      delete metaEl.dataset.tone;
    }
  }

  function setGridLoading(isLoading) {
    ordersGrid.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  }

  function escapeHtml(value) {
    if (typeof value !== 'string') {
      return '';
    }
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function shortId(id) {
    if (!id) return '';
    return `#${String(id).slice(-4).toUpperCase()}`;
  }

  function formatChannel(order) {
    if (!order) return 'Order';
    if (order.tableNumber) {
      return `Table ${order.tableNumber}`;
    }
    if (order.channel) {
      const channel = String(order.channel).replace(/_/g, ' ');
      return channel.replace(/\b\w/g, (char) => char.toUpperCase());
    }
    if (order.serviceType) {
      return String(order.serviceType);
    }
    return 'Order';
  }

  function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
  }

  function formatElapsed(value) {
    if (!value) return null;
    const start = new Date(value);
    const now = new Date();
    if (Number.isNaN(start.getTime())) return null;
    const totalSeconds = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function summarizeItems(items) {
    if (!Array.isArray(items) || !items.length) {
      return '<li>No items</li>';
    }
    const limited = items.slice(0, 3);
    const rendered = limited.map((item) => {
      const name = escapeHtml(item?.name || item?.title || 'Item');
      const quantity = item?.quantity || item?.qty || 1;
      return `<li>${quantity}&times; ${name}</li>`;
    });
    if (items.length > limited.length) {
      rendered.push(`<li class="kitchen-order-card__more">+${items.length - limited.length} more</li>`);
    }
    return rendered.join('');
  }

  function mapStatus(status) {
    const key = String(status || '').toLowerCase();
    if (key === 'in-progress') return 'in_progress';
    if (key === 'inprogress') return 'in_progress';
    return key || 'pending';
  }

  function orderSortValue(order) {
    const promise = order.promisedFor || order.promisedAt || order.readyBy;
    const created = order.createdAt || order.submittedAt || order.placedAt || order.firedAt;
    const time = promise || created;
    if (!time) {
      return Number.MAX_SAFE_INTEGER;
    }
    const date = new Date(time);
    if (Number.isNaN(date.getTime())) {
      return Number.MAX_SAFE_INTEGER;
    }
    return date.getTime();
  }

  function formatOrder(order) {
    const statusKey = mapStatus(order.status);
    const created = order.createdAt || order.submittedAt || order.placedAt;
    const promised = order.promisedFor || order.promisedAt || order.readyBy;
    const fireStart = order.firedAt || created;
    return {
      id: order._id || order.id,
      displayId: order.shortCode || order.orderNumber || shortId(order._id || order.id),
      status: statusKey,
      items: order.items || [],
      channel: formatChannel(order),
      submittedAt: created,
      promisedAt: promised,
      elapsed: formatElapsed(fireStart),
      contact: order.contact || order.customer || {},
      notes: order.notes || order.kitchenNote || '',
      sortValue: orderSortValue(order)
    };
  }

  function renderOrders() {
    const limited = ordersState.slice(0, 20);

    if (emptyStateEl) {
      emptyStateEl.hidden = Boolean(limited.length);
    }

    if (!limited.length) {
      ordersGrid.innerHTML = '';
      if (emptyStateEl) {
        emptyStateEl.textContent = 'No active tickets. Waiting for the next order.';
        ordersGrid.append(emptyStateEl);
      }
      ordersGrid.dataset.empty = 'true';
      updateCounts(ordersState);
      setGridLoading(false);
      return;
    }

    const markup = limited.map((order) => {
      const statusKey = order.status;
      const statusLabel = STATUS_LABEL[statusKey] || 'Queued';
      const timeLabel = order.promisedAt ? `Promise ${formatTime(order.promisedAt)}` : order.elapsed ? `Elapsed ${order.elapsed}` : statusLabel;
      const nextFlow = STATUS_FLOW[statusKey];
      const canCancel = !['completed', 'cancelled'].includes(statusKey);
      const badgeClass = `kitchen-order-card__badge kitchen-order-card__badge--${statusKey}`;
      const headline = order.displayId || shortId(order.id);
      const note = order.notes ? `<p class="kitchen-order-card__note">${escapeHtml(order.notes)}</p>` : '';

      const actions = [];
      if (nextFlow) {
        actions.push(`<button type="button" class="kitchen-order-card__action" data-order-action="advance" data-order-id="${order.id}" data-next-status="${nextFlow.next}">${nextFlow.label}</button>`);
      }
      if (statusKey === 'ready' && (!nextFlow || nextFlow.next !== 'completed')) {
        actions.push(`<button type="button" class="kitchen-order-card__action" data-order-action="complete" data-order-id="${order.id}" data-next-status="completed">Complete</button>`);
      }
      if (canCancel) {
        actions.push(`<button type="button" class="kitchen-order-card__action kitchen-order-card__action--cancel" data-order-action="cancel" data-order-id="${order.id}" data-next-status="cancelled">Cancel</button>`);
      }

      const controls = actions.length
        ? `<div class="kitchen-order-card__controls">${actions.join('')}</div>`
        : '';

      const itemsMarkup = summarizeItems(order.items);

      return `
        <article class="kitchen-order-card" data-order-card data-order-id="${order.id}" data-status="${statusKey}">
          <header class="kitchen-order-card__header">
            <span class="kitchen-order-card__number">${escapeHtml(headline || '')}</span>
            <span class="kitchen-order-card__type">${escapeHtml(order.channel)}</span>
          </header>
          <ul class="kitchen-order-card__items">
            ${itemsMarkup}
          </ul>
          ${note}
          <footer class="kitchen-order-card__footer">
            <span class="kitchen-order-card__time">${escapeHtml(timeLabel)}</span>
            <span class="${badgeClass}">${escapeHtml(statusLabel)}</span>
          </footer>
          ${controls}
        </article>
      `;
    }).join('');

    ordersGrid.dataset.empty = 'false';
    ordersGrid.innerHTML = markup;
    setGridLoading(false);
    updateCounts(ordersState);
  }

  function updateCounts(list) {
    const counts = { total: list.length, queued: 0, cooking: 0, ready: 0 };
    list.forEach((order) => {
      const status = order.status;
      if (status === 'pending') counts.queued += 1;
      if (status === 'in_progress') counts.cooking += 1;
      if (status === 'ready') counts.ready += 1;
    });
    if (totalEl) totalEl.textContent = String(counts.total);
    if (queuedEl) queuedEl.textContent = String(counts.queued);
    if (cookingEl) cookingEl.textContent = String(counts.cooking);
    if (readyEl) readyEl.textContent = String(counts.ready);
  }

  function updateClock() {
    if (!clockEl) {
      return;
    }
    const now = new Date();
    clockEl.textContent = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(now);
  }

  async function loadOrders(options = {}) {
    const { silent = false } = options;
    if (!silent) {
      setGridLoading(true);
      if (emptyStateEl) {
        emptyStateEl.hidden = false;
        emptyStateEl.textContent = 'Loading tickets...';
        ordersGrid.innerHTML = '';
        ordersGrid.append(emptyStateEl);
      }
    }

    try {
      const response = await fetch(`${API_BASE}/orders`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      ordersState = list
        .map(formatOrder)
        .filter((order) => order.id && !['completed', 'cancelled'].includes(order.status))
        .sort((a, b) => a.sortValue - b.sortValue);

      setMeta(`Last updated ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date())}`);
      renderOrders();
    } catch (error) {
      console.error('Failed to load kitchen orders', error);
      ordersState = [];
      if (emptyStateEl) {
        emptyStateEl.hidden = false;
        emptyStateEl.textContent = 'Unable to load tickets. Check the connection.';
        ordersGrid.innerHTML = '';
        ordersGrid.append(emptyStateEl);
      }
      setGridLoading(false);
      setMeta('Unable to reach the order feed.', 'error');
      updateCounts([]);
    }
  }

  async function updateOrderStatus(id, status) {
    if (!id || !status) return;
    const card = ordersGrid.querySelector(`[data-order-card][data-order-id="${cssEscape(id)}"]`);
    if (card) {
      card.classList.add('is-updating');
    }
    try {
      setMeta('Updating ticket...');
      const response = await fetch(`${API_BASE}/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      await loadOrders({ silent: true });
      setMeta('Ticket updated.', 'success');
    } catch (error) {
      console.error('Failed to update order status', error);
      setMeta('Could not update ticket status.', 'error');
      if (card) {
        card.classList.remove('is-updating');
      }
    }
  }

  ordersGrid.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const actionButton = target.closest('[data-order-action]');
    if (!actionButton) {
      return;
    }
    const orderId = actionButton.getAttribute('data-order-id');
    const nextStatus = actionButton.getAttribute('data-next-status');

    if (!orderId || !nextStatus) {
      return;
    }

    if (actionButton.dataset.orderAction === 'cancel') {
      const confirmed = window.confirm('Cancel this order?');
      if (!confirmed) {
        return;
      }
    }

    actionButton.disabled = true;
    updateOrderStatus(orderId, nextStatus)
      .finally(() => {
        actionButton.disabled = false;
      });
  });

  function startAutoRefresh() {
    if (refreshHandle) {
      window.clearInterval(refreshHandle);
    }
    refreshHandle = window.setInterval(() => loadOrders({ silent: true }), 10000);
  }

  updateClock();
  setInterval(updateClock, 30000);
  loadOrders();
  startAutoRefresh();
})();
