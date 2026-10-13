// Trasporto su Firebase Realtime Database (piano gratuito Spark): solo HTTPS e WebSocket sicure, niente WebRTC.
// Identità anonima: nessun account per i giocatori.
import { getApps, initializeApp } from 'firebase/app';
import type { FirebaseOptions } from 'firebase/app';
import { browserLocalPersistence, browserSessionPersistence, getAuth, setPersistence, signInAnonymously } from 'firebase/auth';
import {
  endAt,
  get,
  getDatabase,
  limitToFirst,
  onChildAdded,
  onDisconnect,
  onValue,
  orderByValue,
  push,
  query,
  ref,
  set,
  update,
} from 'firebase/database';
import type { Smetti, Trasporto } from './trasporto';

/**
 * @param perScheda identità diversa per ogni scheda del browser (utile per provare più giocatori sullo stesso PC);
 *   normalmente l'identità resta salvata nel browser e permette di rientrare dopo averlo chiuso.
 */
export async function collegaFirebase(config: FirebaseOptions, perScheda = false): Promise<Trasporto> {
  const app = getApps()[0] ?? initializeApp(config);
  const auth = getAuth(app);
  await setPersistence(auth, perScheda ? browserSessionPersistence : browserLocalPersistence);
  await auth.authStateReady();
  const utente = auth.currentUser ?? (await signInAnonymously(auth)).user;
  const db = getDatabase(app);

  // Scarto tra l'orologio del telefono e quello del server: si aspetta il primo valore (al massimo 3 secondi)
  // perché serve subito per i conti alla rovescia e per cercare le stanze vecchie.
  let scarto = 0;
  let smettiScarto: Smetti = () => undefined;
  await new Promise<void>((pronto) => {
    const limite = setTimeout(pronto, 3000);
    smettiScarto = onValue(ref(db, '.info/serverTimeOffset'), (s) => {
      scarto = Number(s.val()) || 0;
      clearTimeout(limite);
      pronto();
    });
  });
  const chiusure = new Set<Smetti>([smettiScarto]);

  const t: Trasporto = {
    uid: utente.uid,
    async leggi(percorso) {
      return (await get(ref(db, percorso))).val() ?? null;
    },
    async scrivi(percorso, valore) {
      await set(ref(db, percorso), valore);
    },
    async aggiorna(valori) {
      await update(ref(db), valori);
    },
    async aggiungi(percorso, valore) {
      const r = push(ref(db, percorso));
      await set(r, valore);
      return r.key ?? '';
    },
    ascolta(percorso, cb, errore) {
      const smetti = onValue(
        ref(db, percorso),
        (s) => cb(s.val() ?? null),
        (e) => errore?.(e),
      );
      chiusure.add(smetti);
      return () => {
        smetti();
        chiusure.delete(smetti);
      };
    },
    ascoltaFigli(percorso, cb, errore) {
      const smetti = onChildAdded(
        ref(db, percorso),
        (s) => cb(s.key ?? '', s.val()),
        (e) => errore?.(e),
      );
      chiusure.add(smetti);
      return () => {
        smetti();
        chiusure.delete(smetti);
      };
    },
    presente(percorso) {
      // A ogni (ri)connessione una chiave nuova: prima si prenota la cancellazione alla disconnessione, poi si scrive.
      let r: ReturnType<typeof push> | null = null;
      const smetti = onValue(ref(db, '.info/connected'), (s) => {
        if (s.val() !== true) return;
        const mia = push(ref(db, percorso));
        r = mia;
        void onDisconnect(mia)
          .remove()
          .then(() => set(mia, true))
          .catch(() => undefined);
      });
      chiusure.add(smetti);
      return () => {
        smetti();
        chiusure.delete(smetti);
        if (r) {
          void onDisconnect(r).cancel().catch(() => undefined);
          void set(r, null).catch(() => undefined);
        }
      };
    },
    connessione(cb) {
      const smetti = onValue(ref(db, '.info/connected'), (s) => cb(s.val() === true));
      chiusure.add(smetti);
      return () => {
        smetti();
        chiusure.delete(smetti);
      };
    },
    async chiaviSotto(percorso, limite) {
      // Un minuto di margine: le regole permettono la ricerca solo per stanze ferme da almeno 24 ore secondo l'ora del server.
      const s = await get(query(ref(db, percorso), orderByValue(), endAt(limite - 60_000), limitToFirst(20)));
      const chiavi: string[] = [];
      s.forEach((figlio) => {
        if (figlio.key) chiavi.push(figlio.key);
      });
      return chiavi;
    },
    scartoOrologio: () => scarto,
    chiudi() {
      for (const c of chiusure) c();
      chiusure.clear();
    },
  };
  return t;
}
