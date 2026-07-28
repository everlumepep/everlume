// Password recovery landing (linked from the Supabase reset email).
(function () {
  const client = window.everlumeSupabase;
  const form = document.getElementById('resetForm');
  const status = document.getElementById('resetStatus');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!client) { status.textContent = 'Backend not configured.'; return; }
    const data = new FormData(form);
    if (data.get('password') !== data.get('confirm')) {
      status.classList.add('error');
      status.textContent = 'Passwords do not match.';
      return;
    }
    const { error } = await client.auth.updateUser({ password: data.get('password') });
    if (error) {
      status.classList.add('error');
      status.textContent = 'We could not update the password. Open the link from your email again.';
      return;
    }
    status.classList.remove('error');
    status.textContent = 'Password updated. Redirecting…';
    setTimeout(() => { location.href = './'; }, 900);
  });
})();
