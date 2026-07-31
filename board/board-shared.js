let currentProfile = { full_name: '', role: 'pm' };

export function setCurrentProfile(profile) {
  currentProfile = profile;
}

export function getCurrentProfile() {
  return currentProfile;
}

function showToast(message, type = 'error') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);

  const dismiss = document.createElement('button');
  dismiss.className = 'toast-dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.textContent = '×';
  dismiss.addEventListener('click', () => toast.remove());
  toast.appendChild(dismiss);

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}

export function showErrorToast(message) {
  showToast(message, 'error');
}

export function showSuccessToast(message) {
  showToast(message, 'success');
}
