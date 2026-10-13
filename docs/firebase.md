# Creare il progetto Firebase (piano gratuito Spark)

Serve solo per giocare con un dispositivo per giocatore. Si fa tutto dal browser, in circa 10 minuti, senza installare nulla e senza carta di credito.

> Il piano **Spark** è gratuito e non chiede un metodo di pagamento. Non passare mai al piano **Blaze** e non attivare servizi che lo richiedono (per esempio Cloud Functions): il gioco non ne ha bisogno.

## 1. Crea il progetto
1. Apri **https://console.firebase.google.com** e accedi con un account Google.
2. Clicca **Crea un progetto** (o "Aggiungi progetto").
3. Nome: per esempio `happy-little-sheeps`. Accetta i termini.
4. **Google Analytics: disattivalo** (non serve). Clicca **Crea progetto** e poi **Continua**.

## 2. Attiva l'accesso anonimo
I giocatori non hanno account: ogni dispositivo riceve un'identità anonima.
1. Nel menu a sinistra: **Build → Authentication → Inizia**.
2. Scheda **Metodo di accesso** (Sign-in method): scegli **Anonimo**, attiva l'interruttore, **Salva**.
3. Scheda **Impostazioni → Domini autorizzati**: clicca **Aggiungi dominio** e scrivi `mikee-yy.github.io`.

## 3. Crea il database
1. Nel menu a sinistra: **Build → Realtime Database → Crea database**.
2. Posizione: **Belgio (europe-west1)**. Avanti.
3. Scegli **Avvia in modalità bloccata**. **Abilita**.
4. Scheda **Regole**: cancella tutto il testo, incolla il contenuto del file `database.rules.json` del repository e clicca **Pubblica**.

## 4. Registra l'app web e copia la configurazione
1. In alto a sinistra clicca l'ingranaggio → **Impostazioni progetto**.
2. In fondo, sezione **Le tue app**: clicca l'icona **Web** (`</>`).
3. Nome dell'app: `happy-little-sheeps`. **Non** spuntare Firebase Hosting. Clicca **Registra app**.
4. Compare un blocco di codice con `const firebaseConfig = { ... }`. Copia tutto ciò che sta tra le graffe:
   `apiKey`, `authDomain`, `databaseURL`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
   Se manca `databaseURL`, ricarica la pagina dopo aver creato il database.

Queste chiavi sono **pubbliche per natura** (finiscono comunque nel sito): la sicurezza la danno le regole del punto 3.
Vanno nel file `client/src/configurazione-firebase.ts`.

## Limiti del piano gratuito
- 100 dispositivi collegati insieme, 1 GB di dati, 10 GB scaricati al mese: per partite tra amici bastano ampiamente.
- Le stanze ferme da più di 24 ore vengono cancellate da sole quando qualcuno crea una stanza nuova.

## Se la rete aziendale blocca il gioco
Firebase usa connessioni sicure verso `*.firebaseio.com` e `*.firebasedatabase.app`. Se dalla rete aziendale le stanze non si collegano, prova dal telefono con la rete mobile: se lì funziona, è il firewall.
