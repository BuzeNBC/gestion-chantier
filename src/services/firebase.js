import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBuyjUNzGUUW2PdmKG1VVxQMjayKYitsSE",
  authDomain: "bddchantier-79508.firebaseapp.com",
  projectId: "bddchantier-79508",
  storageBucket: "bddchantier-79508.firebasestorage.app",
  messagingSenderId: "369927070248",
  appId: "1:369927070248:web:47c6a3d90c092373540b1d",
  measurementId: "G-Y1YR26R69F"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };