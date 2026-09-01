export function toast(message, type = 'success') {
  const existing = document.querySelector('.ma-toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = 'ma-toast';
  el.innerHTML = message;
  el.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    background: ${type === 'error'
      ? 'linear-gradient(135deg, #632c2a, #4a1f1e)'
      : 'linear-gradient(135deg, #ffdad9, #f5b5ba)'};
    color: ${type === 'error' ? '#ffdad9' : '#632c2a'};
    padding: 16px 32px;
    border-radius: 30px;
    font-weight: 600;
    box-shadow: 0 10px 40px rgba(0,0,0,0.25);
    z-index: 99999;
    transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    font-family: 'DM Sans', sans-serif;
    max-width: min(90vw, 420px);
    text-align: center;
    line-height: 1.4;
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    el.style.transform = 'translateX(-50%) translateY(100px)';
    setTimeout(() => el.remove(), 500);
  }, 3200);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function formatDate(value) {
  if (!value) return '—';
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function formatMoney(amount) {
  const n = Number(amount);
  if (Number.isNaN(n)) return '$0.00';
  return `$${n.toFixed(2)}`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
