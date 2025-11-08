(function () {
  const tabContainers = document.querySelectorAll('[data-tabs]');

  tabContainers.forEach((container) => {
    const tabs = container.querySelectorAll('[data-tab]');
    const panels = container.querySelectorAll('.tabs__panel');

    const activate = (target) => {
      tabs.forEach((tab) => {
        const isMatch = tab.dataset.tab === target;
        tab.classList.toggle('is-active', isMatch);
        tab.setAttribute('aria-selected', String(isMatch));
      });

      panels.forEach((panel) => {
        const isMatch = panel.id === `tab-${target}`;
        panel.classList.toggle('is-active', isMatch);
        panel.hidden = !isMatch;
      });
    };

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => activate(tab.dataset.tab));
      tab.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate(tab.dataset.tab);
        }
      });
    });
  });

})();

(function () {

  const API_BASE = window.__API_BASE__ || 'http://localhost:4000/api';

  const AUTH = window.DelicatoAuth;
  let currentUser = AUTH && typeof AUTH.getAuth === 'function' ? AUTH.getAuth() : null;

  const signOutButton = document.querySelector('[data-signout]');

  const loyaltyRateInput = document.querySelector('[data-loyalty-rate]');
  const loyaltySaveButton = document.querySelector('[data-loyalty-save]');
  const loyaltyFeedback = document.querySelector('[data-loyalty-feedback]');
  const teamTable = document.querySelector('[data-team-table]');
  const teamFeedback = document.querySelector('[data-team-feedback]');
  const teamRefreshButton = document.querySelector('[data-team-refresh]');
  const viewTriggers = document.querySelectorAll('[data-view-trigger]');
  const viewSections = document.querySelectorAll('[data-view-section]');
  let activeView = null;

  const showView = (target) => {
    if (!target) return;
    viewSections.forEach((section) => {
      const matches = section.dataset.viewSection === target;
      section.hidden = !matches;
      section.classList.toggle('dashboard-section--active', matches);
    });
    viewTriggers.forEach((trigger) => {
      const matches = trigger.dataset.viewTrigger === target;
      trigger.classList.toggle('is-active', matches);
      if (matches) {
        trigger.setAttribute('aria-current', 'page');
      } else {
        trigger.removeAttribute('aria-current');
      }
    });
    activeView = target;

    if (target === 'operations' && teamTable) {
      loadTeam({ silent: true });
    }

    if (target === 'settings' && loyaltyRateInput) {
      loadLoyaltySettings();
    }
  };

  if (viewTriggers.length && viewSections.length) {
    viewTriggers.forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        const targetView = trigger.dataset.viewTrigger;
        if (!targetView || targetView === activeView) {
          return;
        }
        showView(targetView);
      });
    });

    showView('analytics');
  }


  const setLoyaltyFeedback = (message, tone) => {
    if (!loyaltyFeedback) return;
    loyaltyFeedback.textContent = message || '';
    if (tone) {
      loyaltyFeedback.dataset.tone = tone;
    } else {
      delete loyaltyFeedback.dataset.tone;
    }
  };

  async function loadLoyaltySettings() {
    if (!loyaltyRateInput) {
      return;
    }

    try {
      const response = await fetch(API_BASE + '/settings/loyalty', { credentials: 'include' });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setLoyaltyFeedback('Manager permissions required to adjust loyalty settings.', 'error');
          loyaltyRateInput.disabled = true;
          if (loyaltySaveButton) {
            loyaltySaveButton.disabled = true;
          }
          return;
        }
        throw new Error('Failed with status ' + response.status);
      }

      const data = await response.json();
      const rate = Number(data.pointsPerDollar);
      if (Number.isFinite(rate)) {
        loyaltyRateInput.value = rate % 1 === 0 ? String(rate) : rate.toFixed(2);
      } else {
        loyaltyRateInput.value = '1';
      }
      setLoyaltyFeedback('');
    } catch (error) {
      console.error('Failed to load loyalty settings', error);
      setLoyaltyFeedback('Unable to load loyalty settings right now.', 'error');
    }
  }


  const TEAM_ROLE_OPTIONS = [
    { value: 'manager', label: 'Manager', description: 'Full access' },
    { value: 'staff', label: 'Employee', description: 'Operations & menu access' },
    { value: 'kitchen', label: 'Kitchen', description: 'Kitchen display & ticket controls' },
    { value: 'customer', label: 'Customer', description: 'Customer portal only' }
  ];

  const escapeHtml = (value) => {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const formatTimestamp = (input) => {
    if (!input) {
      return '--';
    }
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) {
      return '--';
    }
    return date.toLocaleString();
  };

  const getRoleDescription = (role) => {
    const option = TEAM_ROLE_OPTIONS.find((entry) => entry.value === role);
    return option ? option.description : '';
  };

  const setTeamFeedback = (message, tone) => {
    if (!teamFeedback) return;
    teamFeedback.textContent = message || '';
    if (tone) {
      teamFeedback.dataset.tone = tone;
    } else {
      delete teamFeedback.dataset.tone;
    }
  };

  const normalizeTeamUser = (user) => {
    if (!user || typeof user !== 'object') {
      return user;
    }
    const normalized = { ...user };
    const department = String(normalized.department || normalized.team || '').toLowerCase();
    if (String(normalized.role || '').toLowerCase() === 'staff' && department === 'kitchen') {
      normalized.role = 'kitchen';
      if (!normalized.department) {
        normalized.department = 'kitchen';
      }
    }
    return normalized;
  };

  function createTeamRow(user) {
    const isSelf = currentUser && String(currentUser.id || currentUser._id) === user.id;
    const roleOptions = TEAM_ROLE_OPTIONS.map((option) => {
      const selected = option.value === user.role ? ' selected' : '';
      return '<option value="' + option.value + '"' + selected + '>' + option.label + '</option>';
    }).join('');
    const description = getRoleDescription(user.role);
    const emailLine = description
      ? escapeHtml(user.email) + ' - ' + escapeHtml(description)
      : escapeHtml(user.email);
    const deleteDisabled = isSelf ? ' disabled aria-disabled="true"' : '';
    const deleteActionAttr = isSelf ? '' : ' data-action="delete"';
    const departmentAttr = user.department ? ' data-user-department="' + escapeHtml(user.department) + '"' : '';

    const markup = [
      '<div class="settings-row" data-user-row data-user-id="' + escapeHtml(user.id) + '"' + departmentAttr + '>',
      '  <span>',
      '    <input type="text" data-user-name value="' + escapeHtml(user.name || '') + '">',
      '    <small class="muted">' + emailLine + '</small>',
      '  </span>',
      '  <span>',
      '    <select data-user-role>' + roleOptions + '</select>',
      '  </span>',
      '  <span data-user-updated>' + formatTimestamp(user.updatedAt) + '</span>',
      '  <span class="settings-row__actions">',
      '    <button type="button" class="button button--outline button--small" data-action="save">Save</button>',
      '    <button type="button" class="link-button"' + deleteActionAttr + deleteDisabled + '>Remove</button>',
      '  </span>',
      '</div>'
    ].join('\n');

    return markup;
  }

  function renderTeam(users = []) {
    if (!teamTable) return;
    const emptyRow = teamTable.querySelector('[data-team-empty]');
    teamTable.querySelectorAll('[data-user-row]').forEach((row) => row.remove());

    const normalizedUsers = users.map((user) => normalizeTeamUser(user));

    if (!normalizedUsers.length) {
      if (emptyRow) {
        emptyRow.style.display = '';
        const firstCell = emptyRow.querySelector('span');
        if (firstCell) {
          firstCell.textContent = 'No team members yet.';
        }
      }
      return;
    }

    if (emptyRow) {
      emptyRow.style.display = 'none';
    }

    const rowsMarkup = normalizedUsers.map(createTeamRow).join('');
    teamTable.insertAdjacentHTML('beforeend', rowsMarkup);
  }

  async function loadTeam(options = {}) {
    if (!teamTable) {
      return;
    }

    const { silent = false } = options;

    if (teamRefreshButton) {
      teamRefreshButton.disabled = true;
    }

    if (!silent) {
      setTeamFeedback('Loading team...');
    }

    try {
      const response = await fetch(`${API_BASE}/users`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      const payload = await response.json();
      const users = Array.isArray(payload) ? payload : [];
      renderTeam(users);
      if (!silent) {
        setTeamFeedback(users.length ? '' : 'No team members yet.');
      }
    } catch (error) {
      console.error('Failed to load users', error);
      setTeamFeedback('Unable to load team right now.', 'error');
    } finally {
      if (teamRefreshButton) {
        teamRefreshButton.disabled = false;
      }
    }
  }

  async function handleTeamSave(row, trigger) {
    const userId = row?.dataset?.userId;
    if (!userId) {
      return;
    }

    const nameInput = row.querySelector('[data-user-name]');
    const roleSelect = row.querySelector('[data-user-role]');
    if (!nameInput || !roleSelect) {
      return;
    }

    const selectedRole = roleSelect.value;
    const isKitchenRole = selectedRole === 'kitchen';
    const currentDepartmentAttr = (row.getAttribute('data-user-department') || '').toLowerCase();

    const payload = {
      name: nameInput.value.trim(),
      role: isKitchenRole ? 'staff' : selectedRole
    };

    if (!payload.name) {
      setTeamFeedback('Name cannot be empty.', 'error');
      return;
    }

    if (isKitchenRole) {
      payload.department = 'kitchen';
    } else if (currentDepartmentAttr === 'kitchen') {
      payload.department = '';
    }

    const originalLabel = trigger.textContent;
    trigger.disabled = true;
    trigger.textContent = 'Saving...';

    try {
      const response = await fetch(API_BASE + '/users/' + userId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const message = errorPayload && errorPayload.error ? errorPayload.error : 'Failed to update user.';
        setTeamFeedback(message, 'error');
        return;
      }

      await loadTeam({ silent: true });
      setTeamFeedback(isKitchenRole ? 'Kitchen access granted.' : 'User updated.', 'success');
    } catch (error) {
      console.error('Failed to update user ' + userId, error);
      setTeamFeedback('Failed to update user.', 'error');
    } finally {
      trigger.disabled = false;
      trigger.textContent = originalLabel;
    }
  }

  async function handleTeamDelete(row, trigger) {
    const userId = row?.dataset?.userId;
    if (!userId) {
      return;
    }

    const nameInput = row.querySelector('[data-user-name]');
    const targetName = nameInput ? nameInput.value.trim() : 'this user';
    const confirmDelete = window.confirm(`Remove ${targetName} from the dashboard?`);
    if (!confirmDelete) {
      return;
    }

    const originalLabel = trigger.textContent;
    trigger.disabled = true;
    trigger.textContent = 'Removing...';

    try {
      const response = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const message = errorPayload && errorPayload.error ? errorPayload.error : 'Failed to delete user.';
        setTeamFeedback(message, 'error');
        return;
      }

      await loadTeam({ silent: true });
      setTeamFeedback('User removed.', 'success');
    } catch (error) {
      console.error(`Failed to delete user ${userId}`, error);
      setTeamFeedback('Failed to delete user.', 'error');
    } finally {
      trigger.disabled = false;
      trigger.textContent = originalLabel;
    }
  }

  if (signOutButton) {

    signOutButton.addEventListener('click', async () => {

      const confirmSignOut = window.confirm('Sign out of the manager dashboard?');

      if (!confirmSignOut) {

        return;

      }



      try {

        await fetch(`${API_BASE}/auth/signout`, {

          method: 'POST',

          credentials: 'include'

        });

      } catch (error) {

        console.error('Failed to sign out', error);

      }



      if (AUTH && typeof AUTH.signOut === 'function') {

        AUTH.signOut();

      }



      window.location.href = 'signin.html';

    });

  }



  if (AUTH && typeof AUTH.requireAuth === 'function') {

    AUTH.requireAuth({ redirectTo: 'signin.html', next: 'manager.html', roles: ['manager', 'staff'] });

  }



  async function ensureServerSession() {

    try {

      const response = await fetch(`${API_BASE}/auth/session`, { credentials: 'include' });

      if (!response.ok) {

        throw new Error('no-session');

      }

      const result = await response.json();

      if (result && result.user && AUTH && typeof AUTH.signIn === 'function') {

        AUTH.signIn(result.user, true);

      }

    } catch (error) {

      if (AUTH && typeof AUTH.signOut === 'function') {

        AUTH.signOut();

      }

      window.location.href = 'signin.html?next=manager.html';

    }

  }



  ensureServerSession()
    .then(() => {
      currentUser = AUTH && typeof AUTH.getAuth === 'function' ? AUTH.getAuth() : currentUser;
      if (teamTable) {
        loadTeam();
      }
      if (loyaltyRateInput) {
        loadLoyaltySettings();
      }
    })
    .catch(() => {});



  const metricElements = {
    revenue: {
      value: document.querySelector('[data-metric-value="revenue"]'),
      meta: document.querySelector('[data-metric-meta="revenue"]')
    },
    orders: {
      value: document.querySelector('[data-metric-value="orders"]'),
      meta: document.querySelector('[data-metric-meta="orders"]')
    },
    ticket: {
      value: document.querySelector('[data-metric-value="ticket"]'),
      meta: document.querySelector('[data-metric-meta="ticket"]')
    },
    guests: {
      value: document.querySelector('[data-metric-value="guests"]'),
      meta: document.querySelector('[data-metric-meta="guests"]')
    }
  };

  const ordersBody = document.getElementById('orders-table-body');
  const reservationsBody = document.getElementById('reservations-table-body');
  const menuBody = document.getElementById('menu-admin-body');
  const menuRefreshButton = document.querySelector('[data-menu-refresh]');
  const menuForm = document.getElementById('menu-create-form');
  const menuFeedback = document.getElementById('menu-form-feedback');
  const contentForm = document.querySelector('#content-management .content-form');
  const contentFeedback = document.getElementById('content-form-feedback');

  const CONTENT_STORAGE_KEY = 'delicato-content';

  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  });

  const state = {
    orders: [],
    reservations: [],
    menu: []
  };

  const orderStatusFlow = {
    pending: { label: 'Start Order', next: 'in_progress' },
    in_progress: { label: 'Mark Ready', next: 'ready' },
    ready: { label: 'Complete', next: 'completed' }
  };

  const statusClass = {
    pending: 'status--pending',
    in_progress: 'status--in-progress',
    ready: 'status--ready',
    completed: 'status--complete',
    cancelled: 'status--cancelled',
    confirmed: 'status--ready',
    seated: 'status--success'
  };

  const statusLabel = {
    pending: 'Pending',
    in_progress: 'In Progress',
    ready: 'Ready',
    completed: 'Completed',
    cancelled: 'Cancelled',
    confirmed: 'Confirmed',
    seated: 'Seated'
  };

  const setContentFeedback = (message, tone) => {
    if (!contentFeedback) return;
    contentFeedback.textContent = message || '';
    if (tone) {
      contentFeedback.dataset.tone = tone;
    } else {
      delete contentFeedback.dataset.tone;
    }
  };

  const getFieldValue = (name) => {
    if (!contentForm) return '';
    const field = contentForm.elements.namedItem(name);
    if (!field) return '';
    const value = typeof field.value === 'string' ? field.value : '';
    return value.trim();
  };

  const setFieldValue = (name, value) => {
    if (!contentForm) return;
    const field = contentForm.elements.namedItem(name);
    if (!field || typeof field.value === 'undefined') return;
    field.value = value != null ? value : '';
  };

  const extractContentFromForm = () => {
    if (!contentForm) return null;

    const heroCtas = [1, 2, 3].map((index) => ({
      label: getFieldValue(`hero-cta-${index}-label`),
      target: getFieldValue(`hero-cta-${index}-target`)
    }));

    return {
      hero: {
        eyebrow: getFieldValue('hero-eyebrow'),
        headline: getFieldValue('hero-headline'),
        subheading: getFieldValue('hero-subheading'),
        ctas: heroCtas,
        imageUrl: getFieldValue('hero-image'),
        imageAlt: getFieldValue('hero-image-alt'),
        caption: getFieldValue('hero-caption')
      },
      story: {
        title: getFieldValue('story-title'),
        body: getFieldValue('story-body'),
        highlights: [1, 2, 3].map((index) => getFieldValue(`story-highlight-${index}`))
      },
      popular: [1, 2, 3].map((index) => ({
        name: getFieldValue(`popular-${index}-name`),
        price: getFieldValue(`popular-${index}-price`),
        description: getFieldValue(`popular-${index}-description`),
        imageUrl: getFieldValue(`popular-${index}-image`),
        imageAlt: getFieldValue(`popular-${index}-image-alt`)
      }))
    };
  };

  let defaultContent = contentForm ? extractContentFromForm() : null;

  const applyContentToForm = (data) => {
    if (!contentForm || !data) return;

    const hero = data.hero || {};
    if (Object.prototype.hasOwnProperty.call(hero, 'eyebrow')) setFieldValue('hero-eyebrow', hero.eyebrow ?? '');
    if (Object.prototype.hasOwnProperty.call(hero, 'headline')) setFieldValue('hero-headline', hero.headline ?? '');
    if (Object.prototype.hasOwnProperty.call(hero, 'subheading')) setFieldValue('hero-subheading', hero.subheading ?? '');
    if (Array.isArray(hero.ctas)) {
      hero.ctas.forEach((cta, index) => {
        if (!cta) return;
        const idx = index + 1;
        if (Object.prototype.hasOwnProperty.call(cta, 'label')) {
          setFieldValue(`hero-cta-${idx}-label`, cta.label ?? '');
        }
        if (Object.prototype.hasOwnProperty.call(cta, 'target')) {
          setFieldValue(`hero-cta-${idx}-target`, cta.target ?? '');
        }
      });
    }
    if (Object.prototype.hasOwnProperty.call(hero, 'imageUrl')) setFieldValue('hero-image', hero.imageUrl ?? '');
    if (Object.prototype.hasOwnProperty.call(hero, 'imageAlt')) setFieldValue('hero-image-alt', hero.imageAlt ?? '');
    if (Object.prototype.hasOwnProperty.call(hero, 'caption')) setFieldValue('hero-caption', hero.caption ?? '');

    const story = data.story || {};
    if (Object.prototype.hasOwnProperty.call(story, 'title')) setFieldValue('story-title', story.title ?? '');
    if (Object.prototype.hasOwnProperty.call(story, 'body')) setFieldValue('story-body', story.body ?? '');
    if (Array.isArray(story.highlights)) {
      story.highlights.forEach((highlight, index) => {
        setFieldValue(`story-highlight-${index + 1}`, highlight ?? '');
      });
    }

    const popular = Array.isArray(data.popular) ? data.popular : [];
    popular.forEach((item, index) => {
      const idx = index + 1;
      if (!item) return;
      if (Object.prototype.hasOwnProperty.call(item, 'name')) setFieldValue(`popular-${idx}-name`, item.name ?? '');
      if (Object.prototype.hasOwnProperty.call(item, 'price')) setFieldValue(`popular-${idx}-price`, item.price ?? '');
      if (Object.prototype.hasOwnProperty.call(item, 'description')) setFieldValue(`popular-${idx}-description`, item.description ?? '');
      if (Object.prototype.hasOwnProperty.call(item, 'imageUrl')) setFieldValue(`popular-${idx}-image`, item.imageUrl ?? '');
      if (Object.prototype.hasOwnProperty.call(item, 'imageAlt')) setFieldValue(`popular-${idx}-image-alt`, item.imageAlt ?? '');
    });
  };

  const loadContentSettings = () => {
    if (!contentForm) return;
    let stored = null;
    try {
      const raw = window.localStorage.getItem(CONTENT_STORAGE_KEY);
      if (raw) {
        stored = JSON.parse(raw);
      }
    } catch (error) {
      console.error('Failed to parse saved homepage content', error);
    }

    if (stored) {
      applyContentToForm(stored);
    } else if (defaultContent) {
      applyContentToForm(defaultContent);
    }

    setContentFeedback('');
  };

  if (contentForm) {
    loadContentSettings();

    contentForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const payload = extractContentFromForm();
      if (!payload) return;

      try {
        const serialized = JSON.stringify(payload);
        window.localStorage.setItem(CONTENT_STORAGE_KEY, serialized);
        defaultContent = JSON.parse(serialized);
        setContentFeedback('Homepage content saved. Refresh the guest site to see the changes.', 'success');
      } catch (error) {
        console.error('Failed to save homepage content', error);
        setContentFeedback('Unable to save changes. Please try again.', 'error');
      }
    });

    contentForm.addEventListener('reset', () => {
      window.setTimeout(() => {
        if (defaultContent) {
          applyContentToForm(defaultContent);
        }
        setContentFeedback('');
      });
    });

    contentForm.addEventListener('input', () => setContentFeedback(''));
  }

  const setMenuFeedback = (message, tone) => {
    if (!menuFeedback) return;
    menuFeedback.textContent = message || '';
    if (tone) {
      menuFeedback.dataset.tone = tone;
    } else {
      delete menuFeedback.dataset.tone;
    }
  };

  const formatCurrency = (value) => currencyFormatter.format((Number(value) || 0) / 100);

  const beginOfDay = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const endOfDay = () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return end;
  };

  const getDateParts = (value) => {
    if (!value) {
      return { dateLabel: 'ÃƒÂ¯Ã‚Â¿Ã‚Â½', timeLabel: 'ÃƒÂ¯Ã‚Â¿Ã‚Â½' };
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return { dateLabel: 'ÃƒÂ¯Ã‚Â¿Ã‚Â½', timeLabel: 'ÃƒÂ¯Ã‚Â¿Ã‚Â½' };
    }
    return {
      dateLabel: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      timeLabel: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    };
  };

  const updateMetrics = () => {
    const start = beginOfDay();
    const end = endOfDay();

    const todaysOrders = state.orders.filter((order) => {
      const created = order.createdAt ? new Date(order.createdAt) : null;
      return created && created >= start && created <= end;
    });

    const validOrders = todaysOrders.filter((order) => order.status !== 'cancelled');
    const revenueCents = validOrders.reduce((sum, order) => sum + (order.totalCents || 0), 0);
    const pendingCount = todaysOrders.filter((order) => !['cancelled', 'completed'].includes(order.status)).length;

    const revenueMetric = metricElements.revenue;
    if (revenueMetric.value) {
      revenueMetric.value.textContent = formatCurrency(revenueCents);
      revenueMetric.meta.textContent = todaysOrders.length
        ? `${todaysOrders.length} orders today`
        : 'Awaiting first order';
    }

    const ordersMetric = metricElements.orders;
    if (ordersMetric.value) {
      ordersMetric.value.textContent = String(todaysOrders.length);
      ordersMetric.meta.textContent = `${pendingCount} pending`;
    }

    const ticketMetric = metricElements.ticket;
    if (ticketMetric.value) {
      if (validOrders.length) {
        const average = revenueCents / validOrders.length;
        ticketMetric.value.textContent = formatCurrency(average);
        ticketMetric.meta.textContent = `${validOrders.length} finalized today`;
      } else {
        ticketMetric.value.textContent = '$0.00';
        ticketMetric.meta.textContent = 'No completed orders yet';
      }
    }

    const todaysGuests = state.reservations.filter((reservation) => {
      const time = reservation.reservationTime ? new Date(reservation.reservationTime) : null;
      return time && time >= start && time <= end && reservation.status !== 'cancelled';
    });

    const totalGuests = todaysGuests.reduce((sum, reservation) => sum + (reservation.partySize || 0), 0);
    const upcomingReservations = state.reservations.filter((reservation) => reservation.status !== 'cancelled').length;

    const guestsMetric = metricElements.guests;
    if (guestsMetric.value) {
      guestsMetric.value.textContent = String(totalGuests);
      guestsMetric.meta.textContent = `${upcomingReservations} upcoming reservations`;
    }
  };

  const renderOrders = () => {
    if (!ordersBody) return;

    if (!state.orders.length) {
      ordersBody.innerHTML = '<tr data-empty><td colspan="6" class="muted">No orders yet.</td></tr>';
      return;
    }

    ordersBody.innerHTML = state.orders
      .map((order) => {
        const guestName = order.contact?.name
          || [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ')
          || order.contact?.email
          || 'Guest';
        const tableLabel = order.tableNumber || (order.channel === 'web_pickup' ? 'Pickup' : order.channel || 'ÃƒÂ¯Ã‚Â¿Ã‚Â½');
        const items = Array.isArray(order.items) && order.items.length
          ? order.items.map((item) => `${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ''}`).join(', ')
          : 'ÃƒÂ¯Ã‚Â¿Ã‚Â½';
        const statusKey = order.status || 'pending';
        const statusText = statusLabel[statusKey] || statusKey;
        const statusClassName = statusClass[statusKey] || 'status--pending';
        const shortId = order._id ? `#${order._id.slice(-6).toUpperCase()}` : 'ÃƒÂ¯Ã‚Â¿Ã‚Â½';
        const flow = orderStatusFlow[statusKey];
        const actions = [];

        if (flow) {
          actions.push(`<button type="button" class="button button--outline button--small" data-order-status="${flow.next}" data-order-id="${order._id}">${flow.label}</button>`);
        }

        if (!['cancelled', 'completed'].includes(statusKey)) {
          actions.push(`<button type="button" class="link-button" data-order-cancel="${order._id}">Cancel</button>`);
        }

        return `
          <tr data-order-id="${order._id}">
            <td>${shortId}</td>
            <td>${guestName}</td>
            <td>${tableLabel}</td>
            <td>${items}</td>
            <td><span class="status ${statusClassName}">${statusText}</span></td>
            <td>${actions.join(' ') || '<span class="muted">No actions</span>'}</td>
          </tr>
        `;
      })
      .join('');
  };

  const renderReservations = () => {
    if (!reservationsBody) return;

    if (!state.reservations.length) {
      reservationsBody.innerHTML = '<tr data-empty><td colspan="6" class="muted">No reservations scheduled.</td></tr>';
      return;
    }

    reservationsBody.innerHTML = state.reservations
      .map((reservation) => {
        const guestName = [reservation.customer?.firstName, reservation.customer?.lastName].filter(Boolean).join(' ')
          || reservation.customer?.email
          || 'Guest';
        const { dateLabel, timeLabel } = getDateParts(reservation.reservationTime);
        const party = reservation.partySize || 'ÃƒÂ¯Ã‚Â¿Ã‚Â½';
        const notes = reservation.notes ? reservation.notes : 'ÃƒÂ¯Ã‚Â¿Ã‚Â½';
        const statusKey = reservation.status || 'pending';
        const statusText = statusLabel[statusKey] || statusKey;
        const statusClassName = statusClass[statusKey] || 'status--pending';
        const actions = [];

        if (!['confirmed', 'cancelled'].includes(statusKey)) {
          actions.push(`<button type="button" class="button button--outline button--small" data-reservation-status="confirmed" data-reservation-id="${reservation._id}">Confirm</button>`);
        }

        if (statusKey === 'confirmed') {
          actions.push(`<button type="button" class="button button--outline button--small" data-reservation-status="seated" data-reservation-id="${reservation._id}">Mark Seated</button>`);
        }

        if (statusKey !== 'cancelled') {
          actions.push(`<button type="button" class="link-button" data-reservation-status="cancelled" data-reservation-id="${reservation._id}">Cancel</button>`);
        }

        return `
          <tr data-reservation-id="${reservation._id}">
            <td>${guestName}</td>
            <td>${dateLabel}</td>
            <td>${timeLabel}</td>
            <td>${party}</td>
            <td>${notes}</td>
            <td><span class="status ${statusClassName}">${statusText}</span><div class="table-actions">${actions.join(' ')}</div></td>
          </tr>
        `;
      })
      .join('');
  };

  const renderMenu = () => {
    if (!menuBody) return;

    if (!state.menu.length) {
      menuBody.innerHTML = '<tr data-empty><td colspan="5" class="muted">No menu items found.</td></tr>';
      return;
    }

    menuBody.innerHTML = state.menu
      .map((item) => {
        const active = item.isActive !== false;
        const statusText = active ? 'Active' : 'Hidden';
        const statusClassName = active ? 'status--ready' : 'status--pending';
        const price = item.priceCents != null ? formatCurrency(item.priceCents) : '$0.00';
        const category = item.category || 'ÃƒÂ¯Ã‚Â¿Ã‚Â½';

        return `
          <tr data-menu-id="${item._id}" data-active="${active}">
            <td>${item.name}</td>
            <td>${category}</td>
            <td>${price}</td>
            <td><span class="status ${statusClassName}">${statusText}</span></td>
            <td>
              <button type="button" class="button button--outline button--small" data-menu-action="toggle" data-menu-id="${item._id}">${active ? 'Hide' : 'Publish'}</button>
              <button type="button" class="link-button" data-menu-action="remove" data-menu-id="${item._id}">Delete</button>
            </td>
          </tr>
        `;
      })
      .join('');
  };

  const loadOrders = async () => {
    if (!ordersBody) return;
    ordersBody.innerHTML = '<tr data-empty><td colspan="6" class="muted">Loading orders...</td></tr>';

    try {
      const response = await fetch(`${API_BASE}/orders`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      const data = await response.json();
      state.orders = Array.isArray(data) ? data : [];
      renderOrders();
      updateMetrics();
    } catch (error) {
      console.error('Failed to load orders', error);
      ordersBody.innerHTML = '<tr data-empty><td colspan="6" class="muted">Unable to load orders.</td></tr>';
    }
  };

  const loadReservations = async () => {
    if (!reservationsBody) return;
    reservationsBody.innerHTML = '<tr data-empty><td colspan="6" class="muted">Loading reservations...</td></tr>';

    const from = beginOfDay().toISOString();
    const to = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

    try {
      const response = await fetch(`${API_BASE}/reservations?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      const data = await response.json();
      state.reservations = Array.isArray(data) ? data : [];
      renderReservations();
      updateMetrics();
    } catch (error) {
      console.error('Failed to load reservations', error);
      reservationsBody.innerHTML = '<tr data-empty><td colspan="6" class="muted">Unable to load reservations.</td></tr>';
    }
  };

  const loadMenu = async () => {
    if (!menuBody) return;
    menuBody.innerHTML = '<tr data-empty><td colspan="5" class="muted">Loading menu...</td></tr>';

    try {
      const response = await fetch(`${API_BASE}/menu?include=all`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      const data = await response.json();
      state.menu = Array.isArray(data) ? data : [];
      renderMenu();
    } catch (error) {
      console.error('Failed to load menu', error);
      menuBody.innerHTML = '<tr data-empty><td colspan="5" class="muted">Unable to load menu items.</td></tr>';
    }
  };

  const updateOrderStatus = async (id, status) => {
    if (!id || !status) return;
    try {
      const response = await fetch(`${API_BASE}/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      await loadOrders();
    } catch (error) {
      console.error('Failed to update order status', error);
      window.alert('Could not update order status. Please try again.');
    }
  };

  const updateReservationStatus = async (id, status) => {
    if (!id || !status) return;
    try {
      const response = await fetch(`${API_BASE}/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      await loadReservations();
    } catch (error) {
      console.error('Failed to update reservation status', error);
      window.alert('Could not update reservation. Please try again.');
    }
  };

  const toggleMenuItem = async (id, isActive) => {
    try {
      const response = await fetch(`${API_BASE}/menu/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      await loadMenu();
    } catch (error) {
      console.error('Failed to update menu item', error);
      window.alert('Could not update menu item.');
    }
  };

  const deleteMenuItem = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/menu/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      await loadMenu();
    } catch (error) {
      console.error('Failed to delete menu item', error);
      window.alert('Could not delete menu item.');
    }
  };

  if (ordersBody) {
    ordersBody.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const status = target.getAttribute('data-order-status');
      const id = target.getAttribute('data-order-id');
      const cancelId = target.getAttribute('data-order-cancel');

      if (status && id) {
        updateOrderStatus(id, status);
      } else if (cancelId) {
        const confirmed = window.confirm('Cancel this order?');
        if (confirmed) {
          updateOrderStatus(cancelId, 'cancelled');
        }
      }
    });
  }

  if (reservationsBody) {
    reservationsBody.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const status = target.getAttribute('data-reservation-status');
      const id = target.getAttribute('data-reservation-id');
      if (status && id) {
        updateReservationStatus(id, status);
      }
    });
  }

  if (menuBody) {
    menuBody.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const action = target.getAttribute('data-menu-action');
      const id = target.getAttribute('data-menu-id');
      if (!action || !id) return;

      if (action === 'toggle') {
        const row = target.closest('[data-menu-id]');
        const isActive = row?.getAttribute('data-active') !== 'true';
        toggleMenuItem(id, isActive);
      }

      if (action === 'remove') {
        const confirmed = window.confirm('Delete this menu item?');
        if (confirmed) {
          deleteMenuItem(id);
        }
      }
    });
  }

  if (menuRefreshButton) {
    menuRefreshButton.addEventListener('click', () => {
      loadMenu();
    });
  }

  if (menuForm) {
    menuForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(menuForm);
      const payload = {
        name: String(formData.get('name') || '').trim(),
        category: String(formData.get('category') || '').trim() || undefined,
        description: String(formData.get('description') || '').trim() || undefined,
        imageUrl: String(formData.get('imageUrl') || '').trim() || undefined,
        isActive: true
      };

      const priceValue = Number.parseFloat(String(formData.get('price') || '0'));
      if (!payload.name || Number.isNaN(priceValue)) {
        setMenuFeedback('Name and price are required.', 'error');
        return;
      }

      payload.priceCents = Math.round(Math.max(0, priceValue * 100));
      setMenuFeedback('Publishing item...', null);

      try {
        const response = await fetch(`${API_BASE}/menu`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`);
        }
        menuForm.reset();
        setMenuFeedback('Menu item added successfully.', 'success');
        await loadMenu();
      } catch (error) {
        console.error('Failed to create menu item', error);
        setMenuFeedback('Could not create menu item.', 'error');
      }
    });

    menuForm.addEventListener('input', () => setMenuFeedback(''));
  }

  if (teamRefreshButton) {
    teamRefreshButton.addEventListener('click', () => {
      loadTeam();
    });
  }

  if (teamTable) {
    teamTable.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.getAttribute('data-action');
      if (!action || target.hasAttribute('disabled')) return;
      const row = target.closest('[data-user-row]');
      if (!row) return;
      if (action === 'save') {
        handleTeamSave(row, target);
      } else if (action === 'delete') {
        handleTeamDelete(row, target);
      }
    });
  }

  if (loyaltyRateInput) {
    loyaltyRateInput.addEventListener('input', () => setLoyaltyFeedback(''));
    loyaltyRateInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        updateLoyaltyRate();
      }
    });
  }

  if (loyaltySaveButton) {
    loyaltySaveButton.addEventListener('click', () => {
      updateLoyaltyRate();
    });
  }

  loadOrders();
  loadReservations();
  loadMenu();
})();




















