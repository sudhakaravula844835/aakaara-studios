import { supabase } from './supabase-client.js';
import { validateProjectForm } from './board-utils.js';
import { showErrorToast } from './board-shared.js';

export function openProjectModal(project) {
  const backdrop = document.getElementById('projectModalBackdrop');
  const form = document.getElementById('projectForm');
  form.reset();
  document.getElementById('fClientNameError').textContent = '';
  document.getElementById('projectModalTitle').textContent = project ? 'Edit Project' : 'New Project';

  document.getElementById('fId').value = project ? project.id : '';
  document.getElementById('fClientName').value = project ? project.client_name : '';
  document.getElementById('fClientEmail').value = project ? (project.client_email || '') : '';
  document.getElementById('fClientPhone').value = project ? (project.client_phone || '') : '';
  document.getElementById('fPackageTier').value = project ? (project.package_tier || '') : '';
  document.getElementById('fHoursBooked').value = project ? (project.hours_booked ?? '') : '';
  document.getElementById('fQuotedPrice').value = project ? (project.quoted_price ?? '') : '';
  document.getElementById('fConfirmedPrice').value = project ? (project.confirmed_price ?? '') : '';
  document.getElementById('fDepositPaid').checked = project ? !!project.deposit_paid : false;
  document.getElementById('fBalancePaid').checked = project ? !!project.balance_paid : false;
  document.getElementById('fContractUrl').value = project ? (project.contract_url || '') : '';
  document.getElementById('fQuotePdfUrl').value = project ? (project.quote_pdf_url || '') : '';

  backdrop.classList.add('open');
  document.getElementById('fClientName').focus();
}

function closeProjectModal() {
  document.getElementById('projectModalBackdrop').classList.remove('open');
}

async function handleProjectFormSubmit(e) {
  e.preventDefault();

  const fields = {
    client_name: document.getElementById('fClientName').value.trim(),
    client_email: document.getElementById('fClientEmail').value.trim() || null,
    client_phone: document.getElementById('fClientPhone').value.trim() || null,
    package_tier: document.getElementById('fPackageTier').value.trim() || null,
    hours_booked: document.getElementById('fHoursBooked').value ? Number(document.getElementById('fHoursBooked').value) : null,
    quoted_price: document.getElementById('fQuotedPrice').value ? Number(document.getElementById('fQuotedPrice').value) : null,
    confirmed_price: document.getElementById('fConfirmedPrice').value ? Number(document.getElementById('fConfirmedPrice').value) : null,
    deposit_paid: document.getElementById('fDepositPaid').checked,
    balance_paid: document.getElementById('fBalancePaid').checked,
    contract_url: document.getElementById('fContractUrl').value.trim() || null,
    quote_pdf_url: document.getElementById('fQuotePdfUrl').value.trim() || null,
  };

  const { valid, errors } = validateProjectForm(fields);
  if (!valid) {
    document.getElementById('fClientNameError').textContent = errors.client_name || '';
    return;
  }

  const editId = document.getElementById('fId').value;
  const { error } = editId
    ? await supabase.from('projects').update(fields).eq('id', editId)
    : await supabase.from('projects').insert(fields);

  if (error) {
    showErrorToast('Could not save project — please try again.');
    return;
  }

  closeProjectModal();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('projectForm').addEventListener('submit', handleProjectFormSubmit);
  document.getElementById('projectModalClose').addEventListener('click', closeProjectModal);
  document.getElementById('projectModalCancel').addEventListener('click', closeProjectModal);
  document.getElementById('projectModalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'projectModalBackdrop') closeProjectModal();
  });
});
