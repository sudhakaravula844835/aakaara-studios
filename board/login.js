import { supabase } from './supabase-client.js';

// Shared by both the auto-redirect-if-already-signed-in path and the
// form-submit path: fetches the signed-in user's role/active flag and
// either sends them to the right board or signs them back out with an
// explicit "access revoked" message -- never a silent bounce through
// index.html/editor.html first.
async function routeSignedInUser(userId, errorEl) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, active')
    .eq('id', userId)
    .single();

  // A failed profile fetch here doesn't block login -- this check is a UX
  // nicety on top of the real boundary (current_profile_role() returning
  // null for a deactivated user), which already blocks every RLS-gated
  // read/write regardless of whether this check ever runs.
  if (!profileError && profile && profile.active === false) {
    await supabase.auth.signOut();
    errorEl.textContent = 'Your access has been revoked. Contact the studio owner.';
    return;
  }

  window.location.href = (!profileError && profile && profile.role === 'editor') ? 'editor.html' : 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');

  // A tab that already holds a valid session -- including one belonging to
  // a user deactivated after the session was minted, e.g. in a second tab --
  // lands here on load. Route it through the same active-check as a fresh
  // sign-in, rather than redirecting blind and relying on index.html's/
  // editor.html's own check to eject them a beat later with no message
  // shown at all.
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) routeSignedInUser(data.session.user.id, errorEl);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const email = document.getElementById('lEmail').value.trim();
    const password = document.getElementById('lPassword').value;

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      errorEl.textContent = 'Incorrect email or password.';
      return;
    }

    await routeSignedInUser(signInData.user.id, errorEl);
  });
});
