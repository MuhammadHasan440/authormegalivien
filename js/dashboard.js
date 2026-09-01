import {
  addDoc,
  auth,
  collection,
  db,
  deleteDoc,
  doc,
  getDoc,
  getDownloadURL,
  onAuthStateChanged,
  onSnapshot,
  ref,
  serverTimestamp,
  setDoc,
  signInWithEmailAndPassword,
  signOut,
  storage,
  updateDoc,
  uploadBytes
} from './firebase.js';
import { DEFAULT_BOOKS } from './default-books.js';
import {
  isShopOpen,
  normalizeShopSettings,
  SETTINGS_DOC
} from './shop-settings.js';
import { escapeHtml, formatDate, formatMoney, toast } from './toast.js';

const titles = {
  overview: ['Overview', 'Live snapshot of the store and newsletter'],
  subscribers: ['Newsletter', 'Everyone who subscribed on the site'],
  orders: ['Orders', 'Books purchased from the shop'],
  books: ['Shop books', 'Add, edit, or remove what appears on Shop All'],
  shop: ['Shop open/close', 'Open the store now, close it, or keep the Nov 1 schedule']
};

let subscribers = [];
let orders = [];
let books = [];
let shopSettings = normalizeShopSettings(null);
let editingBookId = null;
let liveUnsubs = [];

const loginScreen = document.getElementById('loginScreen');
const appShell = document.getElementById('appShell');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const loginBtn = document.getElementById('loginBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');

function showApp(user) {
  loginScreen.classList.add('hidden');
  appShell.classList.remove('hidden');
  document.getElementById('userEmail').textContent = user.email || '';
}

function showLogin() {
  appShell.classList.add('hidden');
  loginScreen.classList.remove('hidden');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('open');
}

function setView(name) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${name}`));
  document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === name));
  const [title, subtitle] = titles[name];
  document.getElementById('pageTitle').textContent = title;
  document.getElementById('pageSubtitle').textContent = subtitle;
  closeSidebar();
}

function tableMarkup(headers, rowsHtml, emptyText) {
  if (!rowsHtml) {
    return `<div class="empty">${emptyText}</div>`;
  }
  return `
    <table>
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

function statusBadge(status) {
  const key = status || 'pending';
  return `<span class="badge badge-${escapeHtml(key)}">${escapeHtml(key)}</span>`;
}

function renderOverview() {
  document.getElementById('statSubscribers').textContent = String(subscribers.length);
  document.getElementById('statOrders').textContent = String(orders.length);
  document.getElementById('statBooks').textContent = String(books.length);
  const revenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  document.getElementById('statRevenue').textContent = formatMoney(revenue);

  const recentOrderRows = orders.slice(0, 6).map((order) => `
    <tr>
      <td>${escapeHtml(order.bookTitle)}</td>
      <td>${escapeHtml(order.customerName)}</td>
      <td>${formatMoney(order.total)}</td>
      <td>${statusBadge(order.status)}</td>
    </tr>
  `).join('');
  document.getElementById('recentOrders').innerHTML = tableMarkup(
    ['Book', 'Customer', 'Total', 'Status'],
    recentOrderRows,
    'No orders yet.'
  );

  const recentSubRows = subscribers.slice(0, 8).map((sub) => `
    <tr>
      <td>${escapeHtml(sub.email)}</td>
      <td>${escapeHtml(sub.source || 'site')}</td>
      <td>${formatDate(sub.createdAt)}</td>
    </tr>
  `).join('');
  document.getElementById('recentSubscribers').innerHTML = tableMarkup(
    ['Email', 'Source', 'Joined'],
    recentSubRows,
    'No subscribers yet.'
  );
}

function renderSubscribers() {
  const q = (document.getElementById('subscriberSearch').value || '').toLowerCase();
  const filtered = subscribers.filter((s) => s.email.includes(q));
  const rows = filtered.map((sub) => `
    <tr>
      <td>${escapeHtml(sub.email)}</td>
      <td>${escapeHtml(sub.source || 'site')}</td>
      <td>${formatDate(sub.createdAt)}</td>
      <td><button class="btn btn-danger" data-del-sub="${escapeHtml(sub.id)}">Remove</button></td>
    </tr>
  `).join('');
  document.getElementById('subscribersTable').innerHTML = tableMarkup(
    ['Email', 'Source', 'Joined', ''],
    rows,
    'No matching subscribers.'
  );
}

function renderOrders() {
  const filter = document.getElementById('orderStatusFilter').value;
  const filtered = orders.filter((o) => filter === 'all' || o.status === filter);
  const rows = filtered.map((order) => `
    <tr>
      <td>${formatDate(order.createdAt)}</td>
      <td>
        <strong>${escapeHtml(order.customerName)}</strong><br>
        <small>${escapeHtml(order.email)}</small>
      </td>
      <td>${escapeHtml(order.bookTitle)} × ${escapeHtml(order.quantity || 1)}</td>
      <td>${formatMoney(order.total)}</td>
      <td>
        <select class="select" data-order-status="${escapeHtml(order.id)}">
          ${['pending', 'confirmed', 'shipped', 'cancelled'].map((s) =>
            `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`
          ).join('')}
        </select>
      </td>
      <td>
        <small>${escapeHtml([order.address, order.city, order.state, order.zip, order.country].filter(Boolean).join(', '))}</small>
      </td>
    </tr>
  `).join('');
  document.getElementById('ordersTable').innerHTML = tableMarkup(
    ['Date', 'Customer', 'Book', 'Total', 'Status', 'Ship to'],
    rows,
    'No orders in this filter.'
  );
}

function renderBooks() {
  const grid = document.getElementById('booksGrid');
  if (!books.length) {
    grid.innerHTML = `<div class="empty">No books yet. Add one, or seed the current shop titles.</div>`;
    return;
  }
  grid.innerHTML = books.map((book) => `
    <article class="book-admin-card">
      <img src="${escapeHtml(book.imageUrl || '')}" alt="${escapeHtml(book.title)}">
      <div class="info">
        <h3>${escapeHtml(book.emoji || '')} ${escapeHtml(book.title)}</h3>
        <div>${escapeHtml(book.type || '')}</div>
        <div><strong>${formatMoney(book.price)}</strong></div>
        ${book.available
          ? '<span class="badge badge-yes">Available</span>'
          : '<span class="badge badge-no">Coming soon</span>'}
        <div class="row-actions">
          <button class="btn btn-soft" data-edit-book="${escapeHtml(book.id)}">Edit</button>
          <button class="btn btn-danger" data-del-book="${escapeHtml(book.id)}">Remove</button>
        </div>
      </div>
    </article>
  `).join('');
}

function renderShopSettings() {
  const shop = normalizeShopSettings(shopSettings);
  const live = isShopOpen(shop);
  document.querySelectorAll('.shop-mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.shopMode === shop.status);
  });
  const dateInput = document.getElementById('shopOpenDate');
  if (dateInput && document.activeElement !== dateInput) {
    dateInput.value = shop.openDate;
  }
  const badge = document.getElementById('shopLiveBadge');
  if (badge) {
    badge.textContent = live ? 'Shop is OPEN' : 'Shop is CLOSED';
    badge.className = `badge ${live ? 'badge-yes' : 'badge-no'}`;
  }
  const copy = live
    ? 'Customers can buy books on the Shop page right now.'
    : shop.status === 'closed'
      ? 'The shop is closed until you open it from this dashboard.'
      : `The shop stays closed until ${shop.openDate}. Auto mode is set to November 1, 2026 unless you change the date.`;
  ['overviewShopCopy', 'shopSettingsCopy'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = copy;
  });
  const stat = document.getElementById('statShop');
  if (stat) stat.textContent = live ? 'Open' : 'Closed';
}

async function saveShopSettings(patch) {
  const next = {
    ...normalizeShopSettings(shopSettings),
    ...patch,
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, 'settings', SETTINGS_DOC), next, { merge: true });
  toast('Shop status saved. The public shop updates immediately.');
}

async function ensureShopSettings() {
  const refDoc = doc(db, 'settings', SETTINGS_DOC);
  const snap = await getDoc(refDoc);
  if (!snap.exists()) {
    await setDoc(refDoc, {
      ...normalizeShopSettings(null),
      updatedAt: serverTimestamp()
    });
  }
}

function sortByDateDesc(items) {
  return [...items].sort((a, b) => {
    const av = a.createdAt?.toMillis?.() || 0;
    const bv = b.createdAt?.toMillis?.() || 0;
    return bv - av;
  });
}

function stopLiveUpdates() {
  liveUnsubs.forEach((unsub) => unsub());
  liveUnsubs = [];
}

function startLiveUpdates() {
  stopLiveUpdates();

  liveUnsubs.push(onSnapshot(collection(db, 'subscribers'), (snap) => {
    subscribers = sortByDateDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderOverview();
    renderSubscribers();
  }, (error) => {
    console.error(error);
    toast('Could not load newsletter subscribers. Publish the Firestore rules.', 'error');
  }));

  liveUnsubs.push(onSnapshot(collection(db, 'orders'), (snap) => {
    orders = sortByDateDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderOverview();
    renderOrders();
  }, (error) => console.error(error)));

  liveUnsubs.push(onSnapshot(collection(db, 'books'), (snap) => {
    books = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    renderOverview();
    renderBooks();
  }, (error) => console.error(error)));

  liveUnsubs.push(onSnapshot(doc(db, 'settings', SETTINGS_DOC), (snap) => {
    shopSettings = normalizeShopSettings(snap.exists() ? snap.data() : null);
    renderShopSettings();
  }, (error) => console.error(error)));
}

function openBookModal(book) {
  editingBookId = book?.id || null;
  const form = document.getElementById('bookForm');
  document.getElementById('bookModalTitle').textContent = book ? 'Edit book' : 'Add book';
  form.reset();
  if (book) {
    form.title.value = book.title || '';
    form.type.value = book.type || '';
    form.price.value = book.price ?? '';
    form.emoji.value = book.emoji || '';
    form.sortOrder.value = book.sortOrder ?? 1;
    form.available.checked = Boolean(book.available);
    form.imageUrl.value = book.imageUrl || '';
    form.description.value = book.description || '';
  }
  document.getElementById('bookModal').classList.add('open');
}

function closeBookModal() {
  document.getElementById('bookModal').classList.remove('open');
  editingBookId = null;
}

async function uploadCover(file) {
  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const fileRef = ref(storage, `book-covers/${Date.now()}-${safeName}`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

async function saveBook(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const saveBtn = document.getElementById('saveBookBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    let imageUrl = form.imageUrl.value.trim();
    const file = form.imageFile.files[0];
    if (file) {
      imageUrl = await uploadCover(file);
    }
    if (!imageUrl) {
      throw new Error('Please add an image URL or upload a cover.');
    }

    const payload = {
      title: form.title.value.trim(),
      type: form.type.value.trim(),
      price: Number(form.price.value) || 0,
      emoji: form.emoji.value.trim() || '📚',
      sortOrder: Number(form.sortOrder.value) || 1,
      available: form.available.checked,
      imageUrl,
      description: form.description.value.trim(),
      updatedAt: serverTimestamp()
    };

    if (editingBookId) {
      await updateDoc(doc(db, 'books', editingBookId), payload);
      toast('Book updated.');
    } else {
      await addDoc(collection(db, 'books'), { ...payload, createdAt: serverTimestamp() });
      toast('Book added to the shop.');
    }
    closeBookModal();
  } catch (error) {
    console.error(error);
    toast(error.message || 'Could not save this book.', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save book';
  }
}

async function seedBooks() {
  if (books.length) {
    toast('Shop already has books. Add or edit them instead.', 'error');
    return;
  }
  const btn = document.getElementById('seedBooksBtn');
  btn.disabled = true;
  try {
    await Promise.all(DEFAULT_BOOKS.map((book) => addDoc(collection(db, 'books'), {
      ...book,
      createdAt: serverTimestamp()
    })));
    toast('Current shop books were added. You can edit them anytime.');
  } catch (error) {
    console.error(error);
    toast('Could not seed books. Check Firestore rules.', 'error');
  } finally {
    btn.disabled = false;
  }
}

function exportSubscribers() {
  const rows = [['email', 'source', 'joined'], ...subscribers.map((s) => [
    s.email,
    s.source || '',
    s.createdAt?.toDate?.()?.toISOString?.() || ''
  ])];
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'newsletter-subscribers.csv';
  a.click();
  URL.revokeObjectURL(url);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById('loginEmail').value.trim(),
      document.getElementById('loginPassword').value
    );
  } catch (error) {
    loginError.textContent = error.code === 'auth/invalid-credential'
      ? 'Wrong email or password.'
      : (error.message || 'Could not sign in.');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign in';
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
document.getElementById('menuToggle').addEventListener('click', () => {
  sidebar.classList.add('open');
  overlay.classList.add('open');
});
overlay.addEventListener('click', closeSidebar);

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

document.getElementById('subscriberSearch').addEventListener('input', renderSubscribers);
document.getElementById('exportSubscribers').addEventListener('click', exportSubscribers);
document.getElementById('orderStatusFilter').addEventListener('change', renderOrders);
document.getElementById('addBookBtn').addEventListener('click', () => openBookModal(null));
document.getElementById('seedBooksBtn').addEventListener('click', seedBooks);
document.getElementById('cancelBookBtn').addEventListener('click', closeBookModal);
document.getElementById('bookForm').addEventListener('submit', saveBook);
document.getElementById('bookModal').addEventListener('click', (event) => {
  if (event.target.id === 'bookModal') closeBookModal();
});

document.getElementById('subscribersTable').addEventListener('click', async (event) => {
  const id = event.target.dataset.delSub;
  if (!id) return;
  if (!confirm('Remove this subscriber?')) return;
  await deleteDoc(doc(db, 'subscribers', id));
  toast('Subscriber removed.');
});

document.getElementById('ordersTable').addEventListener('change', async (event) => {
  const id = event.target.dataset.orderStatus;
  if (!id) return;
  await updateDoc(doc(db, 'orders', id), { status: event.target.value });
  toast('Order status updated.');
});

document.getElementById('booksGrid').addEventListener('click', async (event) => {
  const editId = event.target.dataset.editBook;
  const delId = event.target.dataset.delBook;
  if (editId) {
    openBookModal(books.find((b) => b.id === editId));
  }
  if (delId) {
    if (!confirm('Remove this book from the shop?')) return;
    await deleteDoc(doc(db, 'books', delId));
    toast('Book removed from shop.');
  }
});

document.querySelectorAll('.shop-mode-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    try {
      await saveShopSettings({ status: btn.dataset.shopMode });
    } catch (error) {
      console.error(error);
      toast('Could not update shop status.', 'error');
    }
  });
});

document.getElementById('saveShopDateBtn').addEventListener('click', async () => {
  const value = document.getElementById('shopOpenDate').value || '2026-11-01';
  try {
    await saveShopSettings({ openDate: value, status: 'scheduled' });
  } catch (error) {
    console.error(error);
    toast('Could not save the opening date.', 'error');
  }
});

onAuthStateChanged(auth, async (user) => {
  stopLiveUpdates();
  if (!user) {
    showLogin();
    return;
  }
  showApp(user);
  try {
    await ensureShopSettings();
    startLiveUpdates();
  } catch (error) {
    console.error(error);
    toast('Could not load dashboard data. Enable Firestore and paste the project rules.', 'error');
  }
});
