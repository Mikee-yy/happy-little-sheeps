# Happy Little Sheeps — cose da fare

Aggiornato il 13 ottobre 2026. Il contesto di ogni voce è in `bozze/passaggio-di-consegne.md`.

Spunta le voci man mano (`- [x]`). Le voci nuove vanno nella sezione giusta.

---

## 1. Chiudere le migliorie A e B (da fare per prima)

- [ ] **Prove complete finali della bozza** sul codice definitivo, una alla volta, con la scheda della prova sempre in primo piano (circa 15 minuti l'una):
  - [ ] `provaCompleta('normale')`
  - [ ] `provaCompleta('veloci')`
  - [ ] `provaCompleta('salto')`
  - [ ] `provaCompleta('normale')` con `RISPARMIO.leggero = true` e la classe `leggero` su `#scena`

  Come si fa: avvia "bozza-scena" con `preview_start`, poi `await import('/prove.js?'+Date.now()); PROVE.installaOrologio(); PROVE.lancia('provaCompleta', 'normale')`, e leggi il risultato con `PROVE.stato()`. Ogni prova vuole 72 casi e `falliti: []`.
- [ ] **Rilanciare le prove brevi** su una pagina appena caricata: `provaOrologio`, `provaSalto`, `provaOpzioni`, `provaVibrazione`, `provaDito`, `provaRisparmio`. Ognuna deve dare `[]`.
- [ ] **Controllo con "Riduci movimento"** (`RIDOTTO = true`): un meteo saltato e uno con animazioni veloci finiscono senza errori.
- [ ] **Gioco vero:** `npm test` e `npm run typecheck` verdi.
- [ ] **Revisione finale** di tutto il lavoro: bozza, gioco e aggiunte chieste in corsa. Le scelte fatte sono nel registro `.superpowers/sdd/migliorie-piano/progress.md`.
- [ ] **Stop di fase:** riassunto all'utente con le foto, poi aspettare il via libera.

## 2. Decisioni che spettano all'utente

- [ ] Approvare le **eccezioni alla guida di stile** (`bozze/guida-stile-eccezioni.md`). Una volta approvate, aggiungerle a `design/guida-stile.md` in una sezione "Scena di gioco".
- [ ] Decidere se la **tovaglia** a quadri rossi e bianchi è definitiva.
- [ ] Approvare o far ridisegnare le **6 illustrazioni meteo** disegnate in bozza: grandine, pioggia, vento, nebbia, fulmine, gelata.
- [ ] Rivedere le **decisioni D1–D45** in `docs/motore.md`.
- [ ] Fare la **prova reale della fase 4 con 3 telefoni**.
- [ ] **Scollegare Google Analytics** da Firebase.
- [ ] **Limitare la chiave Firebase** al dominio del sito e chiudere l'avviso di GitHub.
- [x] Decidere **quando pubblicare** le modifiche al gioco. *Pubblicate il 13 ottobre su richiesta dell'utente, insieme alla cartella `bozze/`. Per il futuro: commit e push solo su richiesta esplicita.*

## 3. Prossimi lavori (ognuno inizia solo dopo la conferma dell'utente)

- [ ] **Partita di prova** (parte C), dalla schermata principale. Già approvata come idea, va fatta nel gioco di oggi, con un suo progetto scritto da far approvare:
  - tu contro 2 bot, su un solo dispositivo (servono i bot con un telefono);
  - mazzo preparato nel motore, perché nei primi round succedano le cose importanti (Guaio, dado, furto, Beee-NO!);
  - suggerimenti col pensiero della tua pecora (nuvoletta a pallini) che spiegano ogni momento;
  - non cancella una partita salvata.
- [ ] **Portare la scena nel gioco vero** (`client/`): una regia legge gli eventi del motore e li trasforma in animazioni uguali su tutti i telefoni. Regole già decise:
  - il pannello "Prova eventi" esiste solo nella versione di sviluppo;
  - il conto alla rovescia del Beee-NO! parte quando le animazioni sono finite (durata normale, presa da un file di dati), e non aspetta le decorazioni come il bruciacchiato;
  - salto e animazioni veloci valgono solo sul proprio telefono;
  - la parte degli agnellini va riscritta con dei test;
  - un telefono che torna da un'altra scheda deve saltare allo stato attuale invece di recitare tutto;
  - i recinti degli avversari, con 3 o 4 giocatori, sono stretti e affollati: le proporzioni vanno riviste.
- [ ] **5–6 giocatori:** limiti del motore, numeri bilanciati col simulatore, 2 pecore nuove, disposizioni sul telefono.
- [ ] **Orizzontale** (PC e telefono girato): una nuova tabella `DISPOSIZIONI.orizzontale`. Se servirà, anche una disposizione per schermi molto bassi.
- [ ] **Illustrazioni delle carte:** circa 36 illustrazioni originali che mancano. Il pacchetto grafico ne copre 9 su 51 tipi.
- [ ] **Fase 6, rifinitura:** bot, schermata delle regole (già c'è, da rifinire), LEGGIMI che spiega come pubblicare il sito e giocare senza installare nulla.

## 4. Rischi da verificare

- [ ] **iPhone e Safari:** effetto 3D di tovaglia e dado, vibrazione assente (previsto).
- [ ] **Telefoni Android economici:** fluidità della scena e scatto del modo leggero.
- [x] **Rete aziendale:** Google Fonts, GitHub Pages o Firebase bloccati. Se succede, servono alternative gratuite. *Confermato dall'utente il 13 ottobre: funziona.*
