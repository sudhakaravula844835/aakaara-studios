import { supabase } from './supabase-client.js';
import { showErrorToast } from './board-shared.js';

export async function renderStaffView() {
  const wrap = document.getElementById('staffTableWrap');
  wrap.innerHTML = '';

  const [{ data: staffData, error }, { data: userData }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, role, active').order('full_name', { ascending: true }),
    supabase.auth.getUser(),
  ]);

  if (error) {
    showErrorToast('Could not load staff.');
    return;
  }

  const currentUserId = userData.user?.id;

  const table = document.createElement('table');
  table.className = 'list-table staff-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Name', 'Email', 'Role', 'Status'].forEach(label => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  if (staffData.length === 0) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 4;
    emptyCell.className = 'list-empty';
    emptyCell.textContent = 'No staff yet.';
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
  } else {
    staffData.forEach(staff => tbody.appendChild(renderStaffRow(staff, currentUserId)));
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
}

function renderStaffRow(staff, currentUserId) {
  const row = document.createElement('tr');
  row.className = 'list-row staff-row';

  const isSelf = staff.id === currentUserId;
  const isOwnerRow = staff.role === 'owner';

  const nameCell = document.createElement('td');
  nameCell.textContent = staff.full_name;
  row.appendChild(nameCell);

  const emailCell = document.createElement('td');
  emailCell.textContent = staff.email;
  row.appendChild(emailCell);

  const roleCell = document.createElement('td');
  if (isOwnerRow || isSelf) {
    roleCell.textContent = staff.role === 'owner' ? 'Owner' : (staff.role === 'pm' ? 'PM' : 'Editor');
  } else {
    const select = document.createElement('select');
    select.className = 'list-stage-select';
    [['pm', 'PM'], ['editor', 'Editor']].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      if (value === staff.role) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', async () => {
      const newRole = select.value;
      const previousRole = staff.role;
      select.disabled = true;
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', staff.id);
      select.disabled = false;
      if (error) {
        select.value = previousRole;
        showErrorToast('Could not update role — please try again.');
        return;
      }
      await renderStaffView();
    });
    roleCell.appendChild(select);
  }
  row.appendChild(roleCell);

  const statusCell = document.createElement('td');
  const statusBadge = document.createElement('span');
  statusBadge.className = 'staff-status-badge' + (staff.active ? ' staff-status-active' : ' staff-status-inactive');
  statusBadge.textContent = staff.active ? 'Active' : 'Deactivated';
  statusCell.appendChild(statusBadge);

  if (!isOwnerRow && !isSelf) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'staff-status-toggle';
    toggleBtn.textContent = staff.active ? 'Deactivate' : 'Reactivate';
    toggleBtn.addEventListener('click', async () => {
      toggleBtn.disabled = true;
      const { error } = await supabase.from('profiles').update({ active: !staff.active }).eq('id', staff.id);
      toggleBtn.disabled = false;
      if (error) {
        showErrorToast('Could not update status — please try again.');
        return;
      }
      await renderStaffView();
    });
    statusCell.appendChild(toggleBtn);
  }
  row.appendChild(statusCell);

  return row;
}

function openInviteModal() {
  document.getElementById('inviteForm').reset();
  document.getElementById('inviteError').textContent = '';
  document.getElementById('inviteModalBackdrop').classList.add('open');
  document.getElementById('iFullName').focus();
}

function closeInviteModal() {
  document.getElementById('inviteModalBackdrop').classList.remove('open');
}

async function handleInviteFormSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById('inviteError');
  errorEl.textContent = '';

  const fullName = document.getElementById('iFullName').value.trim();
  const email = document.getElementById('iEmail').value.trim();
  const role = document.getElementById('iRole').value;

  if (!fullName || !email) {
    errorEl.textContent = 'Name and email are required.';
    return;
  }

  const submitBtn = document.querySelector('#inviteForm button[type="submit"]');
  submitBtn.disabled = true;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    submitBtn.disabled = false;
    errorEl.textContent = 'Your session has expired — please log in again.';
    return;
  }

  try {
    const res = await fetch('/board/api/invite-staff', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ email, full_name: fullName, role }),
    });
    const json = await res.json();
    submitBtn.disabled = false;

    if (!res.ok) {
      errorEl.textContent = json.error || 'Could not send invite — please try again.';
      return;
    }

    closeInviteModal();
    await renderStaffView();
  } catch {
    submitBtn.disabled = false;
    errorEl.textContent = 'Could not reach the server — please try again.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('inviteStaffBtn').addEventListener('click', openInviteModal);
  document.getElementById('inviteForm').addEventListener('submit', handleInviteFormSubmit);
  document.getElementById('inviteModalClose').addEventListener('click', closeInviteModal);
  document.getElementById('inviteModalCancel').addEventListener('click', closeInviteModal);
  document.getElementById('inviteModalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'inviteModalBackdrop') closeInviteModal();
  });
});
