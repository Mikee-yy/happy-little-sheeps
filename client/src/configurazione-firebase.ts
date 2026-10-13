// Configurazione del progetto Firebase (piano gratuito Spark) per giocare con più dispositivi.
// Queste chiavi sono pubbliche per natura: la sicurezza sta nelle regole di accesso (database.rules.json).
// Si copiano dalla console di Firebase: Impostazioni progetto → Le tue app → App web → Configurazione SDK.
import type { FirebaseOptions } from 'firebase/app';

export const CONFIGURAZIONE_FIREBASE: FirebaseOptions | null = {
  apiKey: 'AIzaSyAwt_s5zT1TKtGffvOqBFVwtcefrXJPHNw',
  authDomain: 'happy-little-sheeps.firebaseapp.com',
  databaseURL: 'https://happy-little-sheeps-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'happy-little-sheeps',
  storageBucket: 'happy-little-sheeps.firebasestorage.app',
  messagingSenderId: '125168399550',
  appId: '1:125168399550:web:eb1b9015b37d978082daef',
};
