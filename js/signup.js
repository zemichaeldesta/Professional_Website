(function () {
  const AUTH = window.DelicatoAuth;
  const API_BASE = window.__API_BASE__ || 'http://localhost:4000/api';
  const form = document.querySelector('.auth-form');
  const feedback = document.querySelector('[data-auth-feedback]');
  const submitButton = form ? form.querySelector('button[type="submit"]') : null;

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
    const landing = existingSession.role === 'customer' ? 'customer.html' : 'manager.html';
    window.location.replace(landing);
    return;
  }

  const passwordWrappers = document.querySelectorAll('[data-password]');
  passwordWrappers.forEach((wrapper) => {
    const input = wrapper.querySelector('input');
    const toggle = wrapper.querySelector('[data-password-toggle]');
    if (!input || !toggle) {
      return;
    }

    toggle.addEventListener('click', () => {
      const isHidden = input.getAttribute('type') === 'password';
      input.setAttribute('type', isHidden ? 'text' : 'password');
      toggle.textContent = isHidden ? 'Hide' : 'Show';
      toggle.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
      if (!isHidden) {
        input.focus();
      }
    });
  });

  if (!form) {
    return;
  }

  form.setAttribute('action', '#');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const firstNameInput = form.querySelector('input[name="firstName"]');
    const lastNameInput = form.querySelector('input[name="lastName"]');
    const emailInput = form.querySelector('input[name="email"]');
    const phoneInput = form.querySelector('input[name="phone"]');
    const passwordInput = form.querySelector('input[name="password"]');
    const confirmInput = form.querySelector('input[name="confirmPassword"]');
    const rememberInput = form.querySelector('input[name="remember"]');

    const firstName = firstNameInput ? firstNameInput.value.trim() : '';
    const lastName = lastNameInput ? lastNameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';
    const confirmPassword = confirmInput ? confirmInput.value.trim() : '';

    let isValid = true;

    if (!firstName) {
      isValid = false;
      if (firstNameInput) {
        firstNameInput.setAttribute('aria-invalid', 'true');
        firstNameInput.focus();
      }
    } else if (firstNameInput) {
      firstNameInput.removeAttribute('aria-invalid');
    }

    if (isValid && !lastName) {
      isValid = false;
      if (lastNameInput) {
        lastNameInput.setAttribute('aria-invalid', 'true');
        lastNameInput.focus();
      }
    } else if (lastNameInput) {
      lastNameInput.removeAttribute('aria-invalid');
    }

    if (isValid && !email) {
      isValid = false;
      if (emailInput) {
        emailInput.setAttribute('aria-invalid', 'true');
        emailInput.focus();
      }
    } else if (emailInput) {
      emailInput.removeAttribute('aria-invalid');
    }

    if (isValid && (!password || password.length < 8)) {
      isValid = false;
      if (passwordInput) {
        passwordInput.setAttribute('aria-invalid', 'true');
        passwordInput.focus();
      }
    } else if (passwordInput) {
      passwordInput.removeAttribute('aria-invalid');
    }

    if (isValid && password !== confirmPassword) {
      isValid = false;
      if (confirmInput) {
        confirmInput.setAttribute('aria-invalid', 'true');
        confirmInput.focus();
      }
    } else if (confirmInput) {
      confirmInput.removeAttribute('aria-invalid');
    }

    if (!isValid) {
      setFeedback('Please complete the required fields and ensure passwords match.', 'error');
      return;
    }

    const rememberMe = Boolean(rememberInput && rememberInput.checked);

    setFeedback('Creating your account...');
    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone: phone || undefined,
          password,
          remember: rememberMe
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errorMessage = data && data.error ? data.error : 'We could not create your account right now.';
        setFeedback(errorMessage, 'error');
        if (submitButton) {
          submitButton.disabled = false;
        }
        return;
      }

      const result = await response.json();
      const userPayload = result && result.user ? result.user : { email, name: `${firstName} ${lastName}`.trim(), role: 'customer' };
      if (result && typeof result.expiresIn === 'number') {
        userPayload.expiresIn = result.expiresIn;
      }

      if (AUTH && typeof AUTH.signIn === 'function') {
        AUTH.signIn(userPayload, rememberMe);
      }

      setFeedback('Account created! Redirecting you to your dashboard.', 'success');
      window.setTimeout(() => {
        window.location.href = 'customer.html';
      }, 400);
    } catch (error) {
      console.error('Failed to sign up', error);
      setFeedback('Unable to create your account right now. Please try again.', 'error');
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
})();
