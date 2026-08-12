import { supabase } from './supabase-client.js';

// Supabase Auth appends its own error state to the redirect URL (either in
// the query string or the hash fragment, depending on flow) rather than
// completing a session -- this is exactly what a stale/already-used/expired
// invite or recovery link looks like, e.g.
// "?error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired".
// Check both locations; don't assume one or the other.
export function readUrlError(location = window.location) {
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(location.search);
  return (
    hashParams.get('error_description') || queryParams.get('error_description') ||
    hashParams.get('error_code') || queryParams.get('error_code') ||
    hashParams.get('error') || queryParams.get('error') ||
    null
  );
}

async function routeAfterPasswordSet(userId) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, active')
    .eq('id', userId)
    .single();

  if (!error && profile && profile.active === false) {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
    return;
  }

  window.location.href = (!error && profile && profile.role === 'editor') ? 'editor.html' : 'index.html';
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initResetPasswordPage);
}

function initResetPasswordPage() {
  const titleEl = document.getElementById('resetTitle');
  const introEl = document.getElementById('resetIntro');
  const form = document.getElementById('resetForm');
  const errorEl = document.getElementById('resetError');
  const backLink = document.getElementById('backToLogin');

  function showExpired() {
    titleEl.textContent = 'Link Expired';
    introEl.textContent = 'This link is invalid or has already been used — invite and reset links only work once. Use "Forgot password?" on the log in page for a new one, or ask the studio owner to resend your invite.';
    form.hidden = true;
    backLink.hidden = false;
  }

  function showForm() {
    introEl.textContent = 'Choose a password to finish setting up your account.';
    form.hidden = false;
  }

  // Supabase redirected back with an explicit failure -- no session was ever
  // established, so don't bother waiting on auth state at all.
  if (readUrlError()) {
    showExpired();
    return;
  }

  // supabase-js (detectSessionInUrl: true by default) parses the URL's
  // access/refresh tokens asynchronously on load. onAuthStateChange's
  // INITIAL_SESSION event is the documented signal that it's finished --
  // fires exactly once, with either a resolved session (link was valid) or
  // null (nothing usable was in the URL).
  let resolved = false;
  supabase.auth.onAuthStateChange((event, session) => {
    if (resolved) return;
    if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
      resolved = true;
      showForm();
    } else if (event === 'INITIAL_SESSION' && !session) {
      resolved = true;
      showExpired();
    }
  });

  // Fallback: don't leave the page stuck on "Verifying your link…" forever
  // if INITIAL_SESSION doesn't fire the way expected on some client version.
  setTimeout(() => {
    if (resolved) return;
    supabase.auth.getSession().then(({ data }) => {
      if (resolved) return;
      resolved = true;
      if (data.session) showForm(); else showExpired();
    });
  }, 2500);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const password = document.getElementById('rPassword').value;
    const confirmPassword = document.getElementById('rPasswordConfirm').value;

    if (password.length < 8) {
      errorEl.textContent = 'Password must be at least 8 characters.';
      return;
    }
    if (password !== confirmPassword) {
      errorEl.textContent = 'Passwords do not match.';
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const { data: userData, error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      submitBtn.disabled = false;
      errorEl.textContent = 'Could not set your password — please try again.';
      return;
    }

    await routeAfterPasswordSet(userData.user.id);
  });
}
