import {
  db,
  doc,
  serverTimestamp,
  setDoc
} from './firebase.js';
import { toast, isValidEmail } from './toast.js';

function subscriberId(email) {
  return email.toLowerCase().trim().replace(/\//g, '_');
}

function pageSource() {
  const page = (window.location.pathname || '').replace(/^\//, '').replace(/\.html$/, '');
  return page || 'home';
}

async function subscribeEmail(email) {
  const key = email.toLowerCase().trim();
  await setDoc(doc(db, 'subscribers', subscriberId(key)), {
    email: key,
    source: pageSource(),
    createdAt: serverTimestamp()
  }, { merge: true });
  toast("🎉 Thank you for subscribing to Meg's newsletter! 💌");
}

async function handleSubscribe(input, btn) {
  const email = (input?.value || '').trim();

  if (!isValidEmail(email)) {
    if (input) {
      input.style.borderColor = '#ef969c';
      input.style.animation = 'shake 0.5s ease';
      setTimeout(() => {
        input.style.borderColor = '';
        input.style.animation = '';
      }, 500);
    }
    toast('Please enter a valid email address.', 'error');
    return;
  }

  const original = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving...';
  }

  try {
    await subscribeEmail(email);
    if (input) input.value = '';
  } catch (error) {
    console.error('Newsletter subscribe failed:', error);
    const denied = error?.code === 'permission-denied';
    toast(
      denied
        ? 'Could not save this email yet. Publish the Firestore rules, then try again.'
        : 'Could not subscribe right now. Please try again.',
      'error'
    );
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = original;
    }
  }
}

function bindNewsletterForm() {
  const btn = document.getElementById('newsletterBtn');
  const input = document.getElementById('newsletterEmail');
  if (!btn || !input || btn.dataset.firebaseBound === 'true') return;

  btn.dataset.firebaseBound = 'true';

  const submit = (event) => {
    event.preventDefault();
    handleSubscribe(input, btn);
  };

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submit(event);
  });

  const form = btn.closest('form');
  if (form) form.addEventListener('submit', submit);
}

if (!document.getElementById('ma-shake-style')) {
  const style = document.createElement('style');
  style.id = 'ma-shake-style';
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-8px); }
      75% { transform: translateX(8px); }
    }
  `;
  document.head.appendChild(style);
}

bindNewsletterForm();
