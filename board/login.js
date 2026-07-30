import { supabase } from './supabase-client.js';

async function redirectForRole(userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  window.location.href = profile && profile.role === 'editor' ? 'editor.html' : 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');

  supabase.auth.getSession().then(({ data }) => {
    if (data.session) redirectForRole(data.session.user.id);
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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, active')
      .eq('id', signInData.user.id)
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
  });
});
