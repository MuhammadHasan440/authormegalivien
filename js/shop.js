import {
  addDoc,
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from './firebase.js';
import { toast, isValidEmail, escapeHtml, formatMoney } from './toast.js';
import {
  countdownLabel,
  isShopOpen,
  normalizeShopSettings,
  SETTINGS_DOC
} from './shop-settings.js';

const FALLBACK_PRODUCTS = [
  { id: 'howl', title: 'HOWL', type: 'Signed Paperback', price: 20, imageUrl: 'images/HOWL new.png', emoji: '🐺', available: false },
  { id: 'hunt', title: 'HUNT', type: 'Signed Paperback', price: 20, imageUrl: 'images/HUNT new.png', emoji: '🧛', available: false },
  { id: 'haunt', title: 'HAUNT', type: 'Signed Paperback', price: 20, imageUrl: 'images/haunt new.png', emoji: '👻', available: false },
  { id: 'magic', title: 'Of Magic and Men', type: 'Signed Paperback', price: 20, imageUrl: 'images/Author Wrapped (1)_1777079945.webp', emoji: '🔮', available: false },
  { id: 'boxset', title: 'Monster Boyfriends', type: 'Box Set (Books 1-3)', price: 20, imageUrl: 'images/Cover Reveal_1727202516.webp', emoji: '📚', available: false },
  { id: 'witchy', title: 'Witchy & Shifty Edition', type: 'Limited Edition', price: 20, imageUrl: 'images/author.webp', emoji: '🍑', available: false }
];

let selectedBook = null;
let shopSettings = normalizeShopSettings(null);
let loadedBooks = [];

function shopIsOpen() {
  return isShopOpen(shopSettings);
}

function bookIsBuyable(book) {
  if (!shopIsOpen()) return false;
  if (book.fromFirestore) return book.available !== false;
  return true;
}

function applyShopBanner() {
  const banner = document.getElementById('prelaunchBanner');
  const countdownText = document.getElementById('countdownText');
  if (!banner) return;

  if (shopIsOpen()) {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');
  if (countdownText) countdownText.textContent = countdownLabel(shopSettings);
}

function productCard(book, index) {
  const delay = index % 4 === 0 ? '' : ` reveal-delay-${index % 4}`;
  const buyable = bookIsBuyable(book);
  const price = formatMoney(book.price).replace('.00', '');
  return `
    <div class="product-card reveal${delay} visible" data-book-id="${escapeHtml(book.id)}">
      <span class="product-creature">${escapeHtml(book.emoji || '📚')}</span>
      <div class="product-image-wrap">
        <img src="${escapeHtml(book.imageUrl)}" alt="${escapeHtml(book.title)}">
      </div>
      <div class="product-info">
        <div class="product-name">${escapeHtml(book.title)}</div>
        <div class="product-type">${escapeHtml(book.type || 'Paperback')}</div>
        <div class="product-price">${escapeHtml(price)}</div>
        <button class="buy-btn" data-book-id="${escapeHtml(book.id)}" ${buyable ? '' : 'disabled'}>
          ${buyable ? '🛒 Buy Now' : '🛒 Coming Soon'}
        </button>
      </div>
    </div>
  `;
}

async function loadBooks() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return [];

  try {
    const snap = await getDocs(query(collection(db, 'books'), orderBy('sortOrder')));
    if (snap.empty) {
      return FALLBACK_PRODUCTS;
    }
        return snap.docs.map((d) => ({ id: d.id, ...d.data(), fromFirestore: true }));
  } catch (error) {
    console.error(error);
    try {
      const snap = await getDocs(collection(db, 'books'));
      if (snap.empty) return FALLBACK_PRODUCTS;
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data(), fromFirestore: true }))
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    } catch {
      return FALLBACK_PRODUCTS;
    }
  }
}

function renderBooks(books) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  grid.innerHTML = books.map((book, i) => productCard(book, i)).join('');

  grid.querySelectorAll('.buy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const book = books.find((item) => item.id === btn.dataset.bookId);
      if (book) openCheckout(book);
    });
  });
}

function openCheckout(book) {
  selectedBook = book;
  const modal = document.getElementById('checkoutModal');
  const summary = document.getElementById('checkoutSummary');
  const qty = document.getElementById('orderQty');
  if (!modal || !summary) return;
  qty.value = 1;
  updateSummary();
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  const modal = document.getElementById('checkoutModal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
  selectedBook = null;
  const form = document.getElementById('checkoutForm');
  if (form) form.reset();
}

function updateSummary() {
  const summary = document.getElementById('checkoutSummary');
  const qtyInput = document.getElementById('orderQty');
  if (!summary || !selectedBook) return;
  const qty = Math.max(1, Number(qtyInput.value) || 1);
  const total = Number(selectedBook.price) * qty;
  summary.innerHTML = `
    <div class="checkout-book">
      <img src="${escapeHtml(selectedBook.imageUrl)}" alt="">
      <div>
        <strong>${escapeHtml(selectedBook.title)}</strong>
        <p>${escapeHtml(selectedBook.type || '')}</p>
        <p>${qty} × ${formatMoney(selectedBook.price)} = <b>${formatMoney(total)}</b></p>
      </div>
    </div>
  `;
}

async function submitOrder(event) {
  event.preventDefault();
  if (!selectedBook) return;

  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const qty = Math.max(1, Number(data.quantity) || 1);

  if (!data.customerName?.trim() || !isValidEmail(data.email) || !data.address?.trim()) {
    toast('Please fill in name, email, and shipping address.', 'error');
    return;
  }

  const submitBtn = document.getElementById('placeOrderBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Placing order...';

  try {
    const title = selectedBook.title;
    await addDoc(collection(db, 'orders'), {
      bookId: selectedBook.id,
      bookTitle: title,
      bookType: selectedBook.type || '',
      bookPrice: Number(selectedBook.price) || 0,
      quantity: qty,
      total: (Number(selectedBook.price) || 0) * qty,
      customerName: data.customerName.trim(),
      email: data.email.trim().toLowerCase(),
      phone: (data.phone || '').trim(),
      address: data.address.trim(),
      city: (data.city || '').trim(),
      state: (data.state || '').trim(),
      zip: (data.zip || '').trim(),
      country: (data.country || 'United States').trim(),
      status: 'pending',
      createdAt: serverTimestamp()
    });
    closeCheckout();
    toast(`🛒 Order placed for ${title}! We will email you soon.`);
  } catch (error) {
    console.error(error);
    toast('Could not place this order. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Place Order';
  }
}

function bindCheckout() {
  const modal = document.getElementById('checkoutModal');
  const form = document.getElementById('checkoutForm');
  const qty = document.getElementById('orderQty');
  if (!modal || !form) return;

  form.addEventListener('submit', submitOrder);
  qty?.addEventListener('input', updateSummary);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeCheckout();
  });
  modal.querySelectorAll('[data-close-checkout]').forEach((el) => {
    el.addEventListener('click', closeCheckout);
  });
}

async function refreshShop() {
  loadedBooks = await loadBooks();
  applyShopBanner();
  renderBooks(loadedBooks);
}

async function initShop() {
  bindCheckout();
  try {
    const snap = await getDoc(doc(db, 'settings', SETTINGS_DOC));
    shopSettings = normalizeShopSettings(snap.exists() ? snap.data() : null);
  } catch (error) {
    console.error(error);
    shopSettings = normalizeShopSettings(null);
  }

  await refreshShop();

  try {
    onSnapshot(doc(db, 'settings', SETTINGS_DOC), (snap) => {
      shopSettings = normalizeShopSettings(snap.exists() ? snap.data() : null);
      applyShopBanner();
      renderBooks(loadedBooks);
    });
  } catch (error) {
    console.error(error);
  }
}

initShop();
