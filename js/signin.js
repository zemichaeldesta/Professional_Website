(function () {
  const AUTH = window.DelicatoAuth;
  const API_BASE = window.__API_BASE__ || 'http://localhost:4000/api';
  const passwordWrapper = document.querySelector('[data-password]');
  const passwordInput = passwordWrapper ? passwordWrapper.querySelector('input[type="password"], input[type="text"]') : null;
  const toggle = document.querySelector('[data-password-toggle]');
  const form = document.querySelector('.auth-form');
  const feedback = document.querySelector('[data-auth-feedback]');
  const rememberCheckbox = form ? form.querySelector('input[name="remember"]') : null;

  const params = new URLSearchParams(window.location.search || '');
  const requestedNext = params.get('next');

  const getDefaultLanding = (role) => (role === 'customer' ? 'customer.html' : 'manager.html');

  const setFeedback = (message, tone) => {
    if (!feedback) return;
    feedback.textContent = message || '';
    if (tone) {
      feedback.dataset.tone = tone;
    } else {
      delete feedback.dataset.tone;
    }
  };

  const existingSession = AUTH && typeof AUTH.getAuth === 'function' ? AUTH.getAuth() : null;
  if (existingSession) {
    const landing = requestedNext || getDefaultLanding(existingSession.role);
    window.location.replace(landing);
    return;
  }

  if (toggle && passwordInput) {
    toggle.addEventListener('click', () => {
      const isHidden = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isHidden ? 'text' : 'password');
      toggle.textContent = isHidden ? 'Hide' : 'Show';
      toggle.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
      if (!isHidden) {
        passwordInput.focus();
      }
    });
  }

  if (!form) {
    return;
  }

  form.setAttribute('action', '#');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = form.querySelector('input[type="email"]');
    const password = form.querySelector('input[name="password"]');
    let isValid = true;

    const emailValue = email ? email.value.trim() : '';
    if (!emailValue) {
      isValid = false;
      if (email) {
        email.setAttribute('aria-invalid', 'true');
        email.focus();
      }
    } else if (email) {
      email.removeAttribute('aria-invalid');
    }

    const passwordValue = password ? password.value.trim() : '';
    if (isValid) {
      if (!passwordValue || passwordValue.length < 8) {
        isValid = false;
        if (password) {
          password.setAttribute('aria-invalid', 'true');
          password.focus();
        }
      } else if (password) {
        password.removeAttribute('aria-invalid');
      }
    }

    if (!isValid) {
      setFeedback('Enter your email and an 8+ character password.', 'error');
      return;
    }

    setFeedback('Signing in.');

    try {
      const response = await fetch(`${API_BASE}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: emailValue,
          password: passwordValue,
          remember: Boolean(rememberCheckbox && rememberCheckbox.checked)
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errorMessage = data && data.error ? data.error : response.status === 403 ? 'Account not permitted to sign in.' : 'Sign in failed';
        setFeedback(errorMessage, 'error');
        return;
      }

      const result = await response.json();
      const userPayload = result && result.user ? result.user : { email: emailValue, role: 'guest' };
      if (result && typeof result.expiresIn === 'number') {
        userPayload.expiresIn = result.expiresIn;
      }

      const rememberMe = Boolean(rememberCheckbox && rememberCheckbox.checked);
      if (AUTH && typeof AUTH.signIn === 'function') {
        AUTH.signIn(userPayload, rememberMe);
      }

      setFeedback('Signed in! Redirecting.', 'success');
      const landingTarget = requestedNext || getDefaultLanding(userPayload.role);
      window.setTimeout(() => {
        window.location.href = landingTarget;
      }, 300);
    } catch (error) {
      console.error('Failed to sign in', error);
      setFeedback('Unable to sign in right now. Please try again.', 'error');
    }
  });
})();
