(function () {
  const API_BASE = window.__API_BASE__ || 'http://localhost:4000/api';
  const AUTH = window.DelicatoAuth;

  if (!AUTH) {
    return;
  }

  const selectors = {
    status: document.querySelector('[data-dashboard-status]'),
    heading: document.querySelector('[data-customer-heading]'),
    subtitle: document.querySelector('[data-customer-subtitle]'),
    points: document.querySelector('[data-customer-points]'),
    ordersThisMonth: document.querySelector('[data-orders-this-month]'),
    nextReservation: document.querySelector('[data-next-reservation]'),
    tier: document.querySelector('[data-loyalty-tier]'),
    tierExpiry: document.querySelector('[data-loyalty-expiry]'),
    progressLabel: document.querySelector('[data-loyalty-progress-label]'),
    progressWrapper: document.querySelector('[data-loyalty-progress-wrapper]'),
    progressFill: document.querySelector('[data-loyalty-progress]'),
    pointsRemaining: document.querySelector('[data-loyalty-points-remaining]'),
    perks: document.querySelector('[data-loyalty-perks]'),
    signOut: document.querySelector('[data-signout]')
  };

  const orderForm = document.getElementById('order-form');
  const orderName = orderForm && orderForm.querySelector('[data-order-name]');
  const orderEmail = orderForm && orderForm.querySelector('[data-order-email]');

  const numberFormatter = new Intl.NumberFormat('en-US');
  const dateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

  let currentAuth = null;
  let currentCustomer = null;

  function setStatus(message, tone) {
    if (!selectors.status) return;
    selectors.status.textContent = message || '';
    if (tone) {
      selectors.status.dataset.tone = tone;
    } else {
      delete selectors.status.dataset.tone;
    }
  }

  function formatReservationSlot(iso) {
    if (!iso) {
      return 'No upcoming reservations';
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return 'Pending scheduling';
    }
    return `${dateFormatter.format(date)} | ${timeFormatter.format(date)}`;
  }

  function formatExpiry(dateValue) {
    if (!dateValue) {
      return 'Tier expiry pending';
    }
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return 'Tier expiry pending';
    }
    return `Tier expires ${dateFormatter.format(date)}`;
  }

  function deriveContact(authRecord, customer) {
    const contact = { name: '', email: '' };

    if (customer) {
      const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
      if (fullName) {
        contact.name = fullName;
      } else if (customer.displayName) {
        contact.name = customer.displayName;
      }
      if (customer.email) {
        contact.email = customer.email;
      }
    }

    if (authRecord) {
      if (!contact.name && authRecord.name) {
        contact.name = authRecord.name;
      }
      if (!contact.name && authRecord.email) {
        contact.name = authRecord.email;
      }
      if (!contact.email && authRecord.email) {
        contact.email = authRecord.email;
      }
    }

    return contact;
  }

  function applyOrderContact(contact) {
    if (!orderName || !orderEmail) {
      return;
    }

    orderName.value = contact.name || '';
    orderEmail.value = contact.email || '';

    orderName.readOnly = true;
    orderEmail.readOnly = true;
    orderName.setAttribute('aria-readonly', 'true');
    orderEmail.setAttribute('aria-readonly', 'true');
  }

  function bindOrderForm() {
    if (!orderForm) {
      return;
    }

    orderForm.addEventListener('reset', () => {
      window.requestAnimationFrame(() => {
        const contact = deriveContact(currentAuth, currentCustomer);
        applyOrderContact(contact);
      });
    });
  }

  function renderHero(customer, loyalty) {
    if (selectors.heading) {
      const fullName = `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim();
      const friendlyName = fullName || customer?.displayName || currentAuth?.name || '';
      selectors.heading.textContent = friendlyName
        ? `Welcome back, ${friendlyName}.`
        : 'Welcome back. Your table awaits.';
    }

    if (selectors.subtitle) {
      selectors.subtitle.textContent = 'Track rewards, start an order, and redeem experiences in one place.';
    }

    if (selectors.points) {
      selectors.points.textContent = numberFormatter.format(customer?.pointsBalance || 0);
    }

    if (selectors.ordersThisMonth) {
      selectors.ordersThisMonth.textContent = numberFormatter.format(customer?.ordersThisMonth || 0);
    }

    if (selectors.nextReservation) {
      selectors.nextReservation.textContent = formatReservationSlot(customer?.nextReservationAt);
    }

    if (selectors.tier) {
      selectors.tier.textContent = loyalty?.currentTier ? `${loyalty.currentTier} Member` : 'Member';
    }

    if (selectors.tierExpiry) {
      selectors.tierExpiry.textContent = formatExpiry(loyalty?.tierExpiresAt);
    }

    if (selectors.progressFill) {
      const progress = Math.max(0, Math.min(100, Number(loyalty?.progressPercent) || 0));
      selectors.progressFill.style.setProperty('--progress', `${progress}%`);
      if (selectors.progressWrapper) {
        selectors.progressWrapper.setAttribute('aria-label', `Loyalty progress ${progress}%`);
      }
    }

    if (selectors.progressLabel) {
      selectors.progressLabel.textContent = loyalty?.nextTier
        ? `Progress to ${loyalty.nextTier}`
        : 'Loyalty progress';
    }

    if (selectors.pointsRemaining) {
      let message = 'Earn more points to unlock your next perk.';
      if (loyalty) {
        if (!loyalty.nextTier) {
          message = 'You are enjoying the highest tier. Savor the perks!';
        } else if (Number.isFinite(Number(loyalty.pointsToNext))) {
          const pointsToNext = Math.max(0, Number(loyalty.pointsToNext));
          message = `${numberFormatter.format(pointsToNext)} points to reach ${loyalty.nextTier}.`;
        }
      }
      selectors.pointsRemaining.textContent = message;
    }

    if (selectors.perks) {
      const perks = Array.isArray(loyalty?.perks) && loyalty.perks.length
        ? loyalty.perks
        : ['Priority reservations', 'Complimentary dessert every 5th visit', 'Exclusive tasting invitations'];
      selectors.perks.innerHTML = perks.map((perk) => `<li>${perk}</li>`).join('');
    }
  }

  function bindSignOut() {
    if (!selectors.signOut) {
      return;
    }

    selectors.signOut.addEventListener('click', () => {
      AUTH.signOut();
      window.location.href = 'signin.html';
    });
  }

  async function ensureServerSession() {
    try {
      const response = await fetch(`${API_BASE}/auth/session`, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('no-session');
      }
      const result = await response.json();
      if (result?.user && typeof AUTH.signIn === 'function') {
        AUTH.signIn(result.user, true);
      }
    } catch (error) {
      AUTH.signOut();
      window.location.href = 'signin.html?next=customer.html';
      throw error;
    }
  }

  async function loadDashboard() {
    setStatus('Loading your dashboard...');
    try {
      const response = await fetch(`${API_BASE}/customer-portal/dashboard`, {
        credentials: 'include'
      });

      if (response.status === 401) {
        throw new Error('unauthorized');
      }

      if (!response.ok) {
        throw new Error('failed');
      }

      const payload = await response.json();
      currentCustomer = payload?.customer || null;
      const loyalty = payload?.loyalty || null;

      const contact = deriveContact(currentAuth, currentCustomer);
      applyOrderContact(contact);
      renderHero(payload?.customer || {}, loyalty || {});
      setStatus('');
    } catch (error) {
      if (error.message === 'unauthorized') {
        AUTH.signOut();
        window.location.href = 'signin.html?next=customer.html';
        return;
      }
      console.error('Failed to load customer dashboard', error);
      setStatus('Unable to load your dashboard right now. Please refresh.', 'error');
    }
  }

  function initialize() {
    const authRecord = typeof AUTH.requireAuth === 'function'
      ? AUTH.requireAuth({ roles: ['customer'], redirectTo: 'signin.html', next: 'customer.html' })
      : null;

    if (!authRecord) {
      return;
    }

    currentAuth = authRecord;

    const contact = deriveContact(currentAuth, null);
    applyOrderContact(contact);

    bindSignOut();
    bindOrderForm();

    ensureServerSession()
      .then(loadDashboard)
      .catch(() => {
        // ensureServerSession redirects on failure; nothing else to do here.
      });
  }

  initialize();
})();



