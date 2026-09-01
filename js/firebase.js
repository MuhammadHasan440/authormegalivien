import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBq_pPyosA1wzLOzizV1liYb5SVVCdpAQw',
  authDomain: 'author-meg.firebaseapp.com',
  projectId: 'author-meg',
  storageBucket: 'author-meg.firebasestorage.app',
  messagingSenderId: '35742366130',
  appId: '1:35742366130:web:267a11c7e674c5f1578cab',
  measurementId: 'G-K1BYVHXYSF'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };

export {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';

export {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

export {
  getDownloadURL,
  ref,
  uploadBytes
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js';
