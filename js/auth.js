(function (window) {
  "use strict";

  const PERSIST_KEY = "delicato-auth";
  const SESSION_KEY = "delicato-auth-session";
  const DEFAULT_EXPIRY_MS = 1000 * 60 * 60 * 24; // 24 hours

  const storage = {
    local: window.localStorage,
    session: window.sessionStorage
  };

  function sanitizeAuth(record) {
    if (!record || typeof record !== "object") {
      return null;
    }

    const copy = { ...record };
    copy.email = typeof copy.email === "string" ? copy.email : "";
    copy.role = typeof copy.role === "string" ? copy.role : "guest";
    copy.name = typeof copy.name === "string" && copy.name ? copy.name : copy.email || "Guest";
    if (copy.customerId) {
      copy.customerId = String(copy.customerId);
    }
    if (copy.id) {
      copy.id = String(copy.id);
    }
    if (!copy.issuedAt) {
      copy.issuedAt = Date.now();
    }
    if (!copy.expiresAt) {
      copy.expiresAt = copy.issuedAt + DEFAULT_EXPIRY_MS;
    }

    return copy;
  }

  function parseAuth(raw, source, key) {
    if (!raw) return null;
    try {
      const record = JSON.parse(raw);
      const sanitized = sanitizeAuth(record);
      if (!sanitized) {
        source.removeItem(key);
        return null;
      }
      if (sanitized.expiresAt && Date.now() > Number(sanitized.expiresAt)) {
        source.removeItem(key);
        return null;
      }
      return sanitized;
    } catch (error) {
      console.error("Failed to parse auth record", error);
      source.removeItem(key);
      return null;
    }
  }

  function getAuth() {
    const sessionRecord = parseAuth(storage.session.getItem(SESSION_KEY), storage.session, SESSION_KEY);
    if (sessionRecord) return sessionRecord;

    const persistentRecord = parseAuth(storage.local.getItem(PERSIST_KEY), storage.local, PERSIST_KEY);
    if (persistentRecord) return persistentRecord;

    return null;
  }

  function setAuth(record, remember) {
    const sanitized = sanitizeAuth(record);
    if (!sanitized) {
      return;
    }

    if (remember) {
      storage.local.setItem(PERSIST_KEY, JSON.stringify(sanitized));
      storage.session.removeItem(SESSION_KEY);
    } else {
      storage.session.setItem(SESSION_KEY, JSON.stringify(sanitized));
      storage.local.removeItem(PERSIST_KEY);
    }
  }

  function buildAuthPayload(data, remember) {
    const now = Date.now();
    const payload = {
      id: data && (data.id || data._id) ? String(data.id || data._id) : null,
      email: data && data.email ? data.email : "",
      role: data && data.role ? data.role : "guest",
      name: data && data.name ? data.name : data && data.email ? data.email : "Guest",
      customerId:
        data && data.customerId ? String(data.customerId) : data && data.customer ? String(data.customer) : null,
      issuedAt: now,
      remember: Boolean(remember)
    };

    if (data && typeof data.expiresAt === "number" && Number.isFinite(data.expiresAt)) {
      payload.expiresAt = data.expiresAt;
    } else if (data && typeof data.expiresIn === "number" && Number.isFinite(data.expiresIn)) {
      payload.expiresAt = now + Math.max(0, data.expiresIn) * 1000;
    } else {
      payload.expiresAt = now + DEFAULT_EXPIRY_MS;
    }

    return payload;
  }

  function signIn(data, remember) {
    const payload = buildAuthPayload(data || {}, remember);
    setAuth(payload, Boolean(remember));
    return payload;
  }

  function signOut() {
    storage.local.removeItem(PERSIST_KEY);
    storage.session.removeItem(SESSION_KEY);
  }

  function isAuthenticated() {
    return Boolean(getAuth());
  }

  function normalizeRoles(roles) {
    if (!roles) return null;
    if (Array.isArray(roles)) {
      return roles.map((role) => String(role).toLowerCase());
    }
    return [String(roles).toLowerCase()];
  }

  function requireAuth(options) {
    const auth = getAuth();
    const opts = options || {};
    const allowedRoles = normalizeRoles(opts.roles);

    if (auth) {
      const roleMatches = !allowedRoles || allowedRoles.includes(String(auth.role || "").toLowerCase());
      if (roleMatches) {
        return auth;
      }
      signOut();
    }

    const redirectTo = opts.redirectTo || "signin.html";
    let nextTarget = opts.next;

    if (!nextTarget) {
      const path = window.location.pathname || "";
      const normalized = path.startsWith("/") ? path.slice(1) : path;
      nextTarget = normalized || "manager.html";
      const search = window.location.search || "";
      const hash = window.location.hash || "";
      nextTarget += search + hash;
    }

    try {
      const redirectUrl = new URL(redirectTo, window.location.origin);
      if (nextTarget) {
        redirectUrl.searchParams.set("next", nextTarget);
      }
      window.location.replace(redirectUrl.toString());
    } catch (error) {
      const fallback = nextTarget ? `${redirectTo}?next=${encodeURIComponent(nextTarget)}` : redirectTo;
      window.location.replace(fallback);
    }

    return null;
  }

  window.DelicatoAuth = {
    getAuth,
    signIn,
    signOut,
    isAuthenticated,
    requireAuth,
    STORAGE_KEYS: {
      persistent: PERSIST_KEY,
      session: SESSION_KEY
    }
  };
})(window);



