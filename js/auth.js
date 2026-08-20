// Sign in / sign up / password reset for My Everlume.
(function () {
  const client = window.everlumeSupabase;
  const form = document.getElementById('authForm');
  const status = document.getElementById('authStatus');
  const title = document.getElementById('authTitle');
  const lead = document.getElementById('authLead');
  const submit = document.getElementById('authSubmit');
  const nameField = document.getElementById('nameField');
  const referralField = document.getElementById('referralField');
  const passwordField = document.getElementById('passwordField');
  let mode = 'signin';

  if (!client) {
    document.getElementById('configNotice').hidden = false;
    form.querySelectorAll('input, button').forEach(el => { el.disabled = true; });
    return;
  }

  const copy = {
    signin: { title: 'Sign in', lead: 'Access your orders, rewards, and account details.', submit: 'Sign in' },
    signup: { title: 'Create account', lead: 'Join Everlume to track orders and earn rewards.', submit: 'Create account' },
    reset: { title: 'Reset password', lead: 'We will email you a secure link to choose a new password.', submit: 'Send reset link' }
  };

  function setMode(next) {
    mode = next;
    title.textContent = copy[mode].title;
    lead.textContent = copy[mode].lead;
    submit.textContent = copy[mode].submit;
    nameField.hidden = mode !== 'signup';
    referralField.hidden = mode !== 'signup';
    passwordField.hidden = mode === 'reset';
    passwordField.querySelector('input').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    document.getElementById('switchToSignup').hidden = mode !== 'signin';
    document.getElementById('switchToSignin').hidden = mode === 'signin';
    document.getElementById('forgotLink').hidden = mode === 'reset';
    status.textContent = '';
    status.classList.remove('error');
  }
  document.querySelectorAll('[data-mode]').forEach(btn =>
    btn.addEventListener('click', () => setMode(btn.dataset.mode)));

  function fail(message) { status.textContent = message; status.classList.add('error'); }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const email = data.get('email');
    const password = data.get('password');
    submit.disabled = true;
    status.classList.remove('error');
    status.textContent = 'Working…';
    try {
      if (mode === 'signin') {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) return fail('Sign in failed. Check your email and password.');
        location.href = './';
      } else if (mode === 'signup') {
        if (!password || password.length < 8) return fail('Please choose a password of at least 8 characters.');
        const { error } = await client.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: new URL('./', location.href).href,
            data: { first_name: data.get('first_name') || '', referral_code: String(data.get('referral_code') || '').trim().toUpperCase() }
          }
        });
        if (error) return fail('We could not create the account. ' + (error.message || ''));
        status.textContent = 'Almost done — check your email to verify your address.';
      } else {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: new URL('reset.html', location.href).href
        });
        if (error) return fail('We could not send the reset email. Please try again.');
        status.textContent = 'If an account exists for that email, a reset link is on the way.';
      }
    } finally {
      submit.disabled = false;
      if (status.textContent === 'Working…') status.textContent = '';
    }
  });
})();
