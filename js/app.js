(function () {
  const header = document.querySelector("[data-header]");
  const nav = document.getElementById("primary-navigation");
  const toggle = document.querySelector("[data-nav-toggle]");
  const yearTarget = document.querySelector("[data-year]");

  const closeNav = () => {
    if (!nav || !toggle) return;
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  };

  const openNav = () => {
    if (!nav || !toggle) return;
    nav.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("nav-open");
  };

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      if (expanded) {
        closeNav();
      } else {
        openNav();
      }
    });

    nav.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.tagName === "A") {
        closeNav();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeNav();
      }
    });
  }

  if (yearTarget) {
    yearTarget.textContent = String(new Date().getFullYear());
  }

  const handleScroll = () => {
    if (!header) return;
    if (window.scrollY > 24) {
      header.classList.add("site-header--scrolled");
    } else {
      header.classList.remove("site-header--scrolled");
    }
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll();
})();

(function () {
  const API_BASE = window.__API_BASE__ || "http://localhost:4000/api";
  const menuContainer = document.getElementById("menu-items");
  if (!menuContainer) {
    return;
  }

  const orderContainer = document.getElementById("order-items");
  const totalTarget = document.getElementById("order-total");
  const orderForm = document.getElementById("order-form");
  const submitButton = document.getElementById("submit-order");
  const feedback = document.getElementById("order-feedback");

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  });

  const menuById = new Map();
  const orderById = new Map();

  const formatCurrency = (valueInCents) => {
    const cents = Number.isFinite(valueInCents) ? valueInCents : 0;
    return currencyFormatter.format(cents / 100);
  };

  const setFeedback = (message, tone) => {
    if (!feedback) return;
    feedback.textContent = message || "";
    if (tone) {
      feedback.dataset.tone = tone;
    } else {
      delete feedback.dataset.tone;
    }
  };

  const renderOrderItems = () => {
    if (!orderContainer || !totalTarget) {
      return;
    }

    if (orderById.size === 0) {
      orderContainer.innerHTML = '<p class="muted" data-order-empty>Select a dish to begin.</p>';
      totalTarget.textContent = formatCurrency(0);
      if (submitButton) {
        submitButton.disabled = true;
      }
      return;
    }

    const items = Array.from(orderById.values());
    const total = items.reduce((sum, item) => sum + item.quantity * item.priceCents, 0);

    orderContainer.innerHTML = items
      .map(
        (item) => `
          <article class="order-item" data-order-id="${item.id}">
            <div class="order-item__info">
              <h4>${item.name}</h4>
              <p class="muted">${formatCurrency(item.priceCents)}</p>
            </div>
            <div class="order-item__controls">
              <button type="button" class="order-item__button" data-order-action="decrease" data-item-id="${item.id}" aria-label="Decrease ${item.name}">-</button>
              <span class="order-item__quantity" aria-live="polite">${item.quantity}</span>
              <button type="button" class="order-item__button" data-order-action="increase" data-item-id="${item.id}" aria-label="Increase ${item.name}">+</button>
              <button type="button" class="order-item__remove" data-order-action="remove" data-item-id="${item.id}">Remove</button>
            </div>
          </article>
        `
      )
      .join("");

    totalTarget.textContent = formatCurrency(total);
    if (submitButton) {
      submitButton.disabled = false;
    }
  };

  const addItemToOrder = (menuItem) => {
    if (!menuItem || !menuItem._id) return;

    const existing = orderById.get(menuItem._id);
    if (existing) {
      existing.quantity += 1;
      orderById.set(menuItem._id, existing);
    } else {
      orderById.set(menuItem._id, {
        id: menuItem._id,
        name: menuItem.name,
        priceCents: menuItem.priceCents || 0,
        quantity: 1
      });
    }

    renderOrderItems();
    setFeedback("");
  };

  const adjustQuantity = (id, delta) => {
    const item = orderById.get(id);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0 || !Number.isFinite(item.quantity)) {
      orderById.delete(id);
    } else {
      orderById.set(id, item);
    }

    renderOrderItems();
  };

  menuContainer.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest("[data-add-item]");
    if (!button) return;

    const itemId = button.getAttribute("data-item-id");
    if (!itemId) return;

    const menuItem = menuById.get(itemId);
    addItemToOrder(menuItem);
  });

  if (orderContainer) {
    orderContainer.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const action = target.getAttribute("data-order-action");
      if (!action) return;

      const itemId = target.getAttribute("data-item-id");
      if (!itemId) return;

      if (action === "remove") {
        orderById.delete(itemId);
        renderOrderItems();
        return;
      }

      if (action === "increase") {
        adjustQuantity(itemId, 1);
      } else if (action === "decrease") {
        adjustQuantity(itemId, -1);
      }
    });
  }

  if (orderForm) {
    orderForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (orderById.size === 0 || !submitButton) {
        return;
      }

      const formData = new FormData(orderForm);
      const name = String(formData.get("customerName") || "").trim();
      const email = String(formData.get("customerEmail") || "").trim();
      const notes = String(formData.get("notes") || "").trim();

      if (!name || !email) {
        setFeedback("Provide your name and email so we can confirm the order.", "error");
        return;
      }

      const itemsPayload = Array.from(orderById.values()).map((item) => ({
        menuItem: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPriceCents: item.priceCents
      }));

      const payload = {
        items: itemsPayload,
        contact: {
          name,
          email,
          notes: notes || undefined
        },
        channel: "web_pickup"
      };

      setFeedback("");
      submitButton.disabled = true;
      const originalText = submitButton.textContent;
      submitButton.textContent = "Placing order...";

      try {
        const response = await fetch(`${API_BASE}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include"
        });

        if (!response.ok) {
          throw new Error(`Order failed with status ${response.status}`);
        }

        orderById.clear();
        renderOrderItems();
        orderForm.reset();
        setFeedback("Order received! We'll email you a confirmation shortly.", "success");
      } catch (error) {
        console.error("Failed to place order", error);
        setFeedback("Something went wrong while placing your order. Please try again.", "error");
        if (orderById.size > 0) {
          submitButton.disabled = false;
        }
      } finally {
        submitButton.textContent = originalText || "Place Order";
      }
    });
  }

  const renderMenu = (items) => {
    if (!items || items.length === 0) {
      menuContainer.innerHTML = '<p class="muted">Menu items will appear here as soon as they are published.</p>';
      return;
    }

    items.forEach((item) => {
      if (!item || !item._id) return;
      menuById.set(item._id, item);
    });

    menuContainer.innerHTML = items
      .map((item) => {
        const price = formatCurrency(item.priceCents);
        const description = item.description ? `<p>${item.description}</p>` : "";
        const image = item.imageUrl
          ? `<img src="${item.imageUrl}" alt="${item.name}">
            `
          : '<div class="menu-card__placeholder" aria-hidden="true">Delicato</div>';

        return `
          <article class="menu-card" data-menu-item="${item._id}">
            ${image}
            <div class="menu-card__body">
              <h3>${item.name}</h3>
              ${description}
              <div class="menu-card__actions">
                <span>${price}</span>
                <button type="button" class="button button--small" data-add-item data-item-id="${item._id}">Add</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  };

  const loadMenu = async () => {
    try {
      const response = await fetch(`${API_BASE}/menu`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`Menu request failed with status ${response.status}`);
      }
      const menuItems = await response.json();
      renderMenu(Array.isArray(menuItems) ? menuItems : []);
    } catch (error) {
      console.error("Failed to load menu", error);
      menuContainer.innerHTML = '<p class="muted">Unable to load the menu right now. Please refresh.</p>';
    }
  };

  loadMenu();
})();
(function () {
  const CONTENT_STORAGE_KEY = 'delicato-content';
  let stored;

  try {
    const raw = window.localStorage.getItem(CONTENT_STORAGE_KEY);
    if (!raw) {
      return;
    }
    stored = JSON.parse(raw);
  } catch (error) {
    console.error('Failed to parse saved homepage content', error);
    return;
  }

  if (!stored || typeof stored !== 'object') {
    return;
  }

  const heroSection = document.getElementById('home');
  if (heroSection && stored.hero) {
    const hero = stored.hero;
    const eyebrowEl = heroSection.querySelector('.eyebrow');
    if (eyebrowEl && hero.eyebrow) {
      eyebrowEl.textContent = hero.eyebrow;
    }

    const headlineEl = heroSection.querySelector('h1');
    if (headlineEl && hero.headline) {
      headlineEl.textContent = hero.headline;
    }

    const subheadingEl = heroSection.querySelector('.lede');
    if (subheadingEl && hero.subheading) {
      subheadingEl.textContent = hero.subheading;
    }

    const heroButtons = heroSection.querySelectorAll('.hero__actions a');
    if (Array.isArray(hero.ctas) && heroButtons.length) {
      hero.ctas.forEach((cta, index) => {
        if (!cta) return;
        const button = heroButtons[index];
        if (!button) return;
        if (cta.label) {
          button.textContent = cta.label;
        }
        if (cta.target) {
          button.setAttribute('href', cta.target);
        }
      });
    }

    const heroImg = heroSection.querySelector('.hero__image img');
    if (heroImg) {
      if (hero.imageUrl) {
        heroImg.src = hero.imageUrl;
      }
      if (hero.imageAlt) {
        heroImg.alt = hero.imageAlt;
      }
    }

    const captionEl = heroSection.querySelector('.hero__image figcaption');
    if (captionEl && hero.caption) {
      captionEl.textContent = hero.caption;
    }
  }

  const storySection = document.getElementById('story');
  if (storySection && stored.story) {
    const story = stored.story;
    const titleEl = storySection.querySelector('h2');
    if (titleEl && story.title) {
      titleEl.textContent = story.title;
    }

    const bodyEl = storySection.querySelector('p');
    if (bodyEl && story.body) {
      bodyEl.textContent = story.body;
    }

    const highlightEls = storySection.querySelectorAll('.feature-list h3');
    if (highlightEls.length && Array.isArray(story.highlights)) {
      story.highlights.forEach((highlight, index) => {
        const heading = highlightEls[index];
        if (heading && highlight) {
          heading.textContent = highlight;
        }
      });
    }
  }

  if (Array.isArray(stored.popular) && stored.popular.length) {
    const popularCards = document.querySelectorAll('#popular .card');
    stored.popular.forEach((item, index) => {
      const card = popularCards[index];
      if (!card || !item) return;

      const img = card.querySelector('img');
      if (img) {
        if (item.imageUrl) {
          img.src = item.imageUrl;
        }
        if (item.imageAlt) {
          img.alt = item.imageAlt;
        }
      }

      const titleEl = card.querySelector('h3');
      if (titleEl && item.name) {
        titleEl.textContent = item.name;
      }

      const paragraphs = card.querySelectorAll('p');
      const descriptionEl = paragraphs[0];
      const priceEl = paragraphs[1];
      if (descriptionEl && item.description) {
        descriptionEl.textContent = item.description;
      }
      if (priceEl && item.price) {
        priceEl.textContent = item.price;
      }
    });
  }
})();
