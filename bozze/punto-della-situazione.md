# Happy Little Sheeps — punto della situazione (13 ottobre 2026)

## Cosa abbiamo fatto

**Fasi 1–4: consegnate e pubblicate** (commit de36174, sito su GitHub Pages)
- **1. Motore delle regole:** in TypeScript, con carte e numeri nei file dati. I casi ambigui sono decisi e scritti in `docs/motore.md`, dalla D1 alla D45.
- **2. Simulatore:** usato per bilanciare il gioco. Numeri approvati: Ovile da 18/15/12 posti, 36/45/44 agnellini, dado con due Testate.
- **3. Un solo telefono ("Passa il telefono"):** gioco completo, giocabile dal link pubblico.
- **4. Più telefoni:** stanze su Firebase (piano gratuito), mani nascoste dalle regole di accesso, rientro dopo una ricarica, bot al posto di chi esce.

In tutto ci sono 789 test automatici, tutti verdi all'ultimo commit.

**Fase 5, grafica: in corso, come bozza solo locale** (`bozze/scena/`, mai pubblicata né salvata su GitHub)
- **Scena 2,5D:**
  - cielo azzurro unico che va verso il tramonto, sole con raggi;
  - nuvole che cambiano forma e ombre che seguono il sole;
  - vento con raffiche e ciuffi d'erba che si piegano.
- **Personaggi:**
  - pecore animate sul posto, con vello mosso dal vento;
  - agnellini che passeggiano e giocano tra loro (testate, rincorse, cavallina, coro) e verso sera dormono vicini.
- **Tavolo e carte:**
  - tovaglia a quadri rossi e bianchi, con mazzi spessi, scarti disordinati e un dado 3D sempre pieno e sopra la tovaglia;
  - mano a ventaglio: tocchi una carta per sollevarla, la tieni premuta per leggerla, la trascini sulla tovaglia per giocarla;
  - illustrazioni animate quando una carta è in primo piano.
- **Meteo:** tutti e 7 i Guai meteo animati, più il Lupo. Un solo meteo alla volta: quello nuovo sostituisce il precedente.
- **Avversari:**
  - postazione con pecora, recinto e sterrato color sabbia per le carte;
  - disposizioni a 2, 3 e 4 giocatori;
  - zoom sull'avversario colpito: la sua pecora e il suo recinto diventano grandi come i tuoi, e le altre postazioni spariscono per un momento.
- **Strumenti di prova:** pannello "Prova eventi" con la scelta "A chi?", e anteprima con ricarica automatica.
- **Bozza chiusa (aggiornamento del 13 ottobre):**
  - fatta la disposizione a 2 giocatori;
  - sistemata la pioggia, che ora dura 11,5–14 s invece di arrivare a 19;
  - scritte le eccezioni alla guida di stile da approvare (`bozze/guida-stile-eccezioni.md`);
  - passata una prova completa: 72 casi, cioè tutti i meteo su ogni giocatore, con 2, 3 e 4 giocatori, tutti senza errori.

## Cosa manca

1. **Portare la scena nel gioco vero.** Oggi la bozza simula le regole da sola. Va collegata al motore e alle stanze, con una regia che legga gli eventi della partita e li trasformi in animazioni, uguali su tutti i telefoni.
2. ~~Disposizione a 2 giocatori~~: fatta.
3. **5–6 giocatori:**
   - nel motore oggi il limite è 2–4;
   - servono numeri nuovi da bilanciare con il simulatore;
   - servono 2 pecore nuove e le disposizioni sul telefono.
4. **Orizzontale (PC e telefono girato):** si aggiunge come un'altra tabella di disposizioni.
5. **Illustrazioni delle carte.** I tipi di carta sono 51 e il pacchetto grafico ne illustra solo 9. Le 6 carte meteo disegnate in bozza sono da approvare. Restano circa 36 illustrazioni originali da fare: è il lavoro grafico più grande che manca.
6. **Guida di stile:** le eccezioni sono scritte in `bozze/guida-stile-eccezioni.md` e aspettano la tua approvazione.
7. **Fase 6, rifinitura:** bot, schermata delle regole, LEGGIMI.
8. **Cose da confermare da parte tua:**
   - la prova reale della fase 4 con 3 telefoni;
   - le decisioni D1–D45, non ancora riviste una per una;
   - lo scollegamento di Google Analytics da Firebase;
   - la limitazione della chiave Firebase al dominio del sito e la chiusura dell'avviso di GitHub.

## Migliorie (aggiornato il 13 ottobre, seconda chat)

Fatte, solo in locale e senza commit (dettagli nella sezione 4 di `passaggio-di-consegne.md`):
- **Tempi di reazione, parte scena:** tocco per saltare e "animazioni veloci" nella bozza. La parte delle stanze (conto alla rovescia a fine animazione) è scritta come regola per quando la scena entra nel gioco.
- **Schermi piccoli:** mano, pulsanti, fumetti e lettura a misura di dito (sulla larghezza dello schermo).
- **Vibrazione** per Guaio, Beee-NO! e vittoria, spegnibile dal nuovo menu Opzioni.
- **Telefoni modesti:** riposo dopo 20 s senza tocchi, modo leggero automatico sui telefoni lenti.
- **Riassunto delle regole** nella scelta dei giocatori, avviso in cima a "Nuova partita", "?" nella Home.
- **Niente sbirciate** sulle carte altrui nel gioco su un dispositivo.

Da fare:
- Prove finali complete e revisione (rinviate).
- **Partita di prova** contro 2 bot dalla schermata principale (approvata come idea, da progettare).
- **Pannello "Prova eventi"** solo nella versione di sviluppo, quando la scena entra nel gioco.

## Difetti possibili e rischi

- **iPhone non ancora provato:** l'effetto 3D di tovaglia e dado su Safari per iPhone può comportarsi diversamente da Chrome.
- **Prestazioni:** la scena aggiorna ogni frame circa 45 agnellini, 3–4 pecore, nuvole ed erba, e usa le ombre sulle carte in mano. Su un Android economico potrebbe scattare.
- **La bozza non ha test automatici.** L'agnellino incastrato dietro il cartello del gregge, che bloccava scenette e meteo, lo dimostra. C'è una rete di sicurezza (8 secondi), ma nel gioco vero questa parte va riscritta con dei test.
- ~~Pioggia troppo lunga~~: sistemata. Il motivo era che, con 4 giocatori, gli agnellini del gregge attraversavano tutto il prato per ripararsi.
- **Durata degli eventi:** la nebbia dura circa 18 s. Nel gioco vero va accordata con la finestra di 6 s del Beee-NO!.
- **Font da Google:** se una rete aziendale blocca Google Fonts, la scena usa caratteri di riserva e i testi delle carte possono uscire dal loro spazio.
- **Recinti avversari:** sono più stretti del tuo in proporzione e con 12–15 agnellini sembrano affollati, a vista normale.
- **Un telefono resta indietro:** nel gioco a più telefoni, se un telefono va in sottofondo durante un'animazione, al ritorno deve saltare allo stato attuale invece di recitare tutto ciò che si è perso.

## Prossimo passo consigliato

La bozza è chiusa. Il prossimo passo è portare la scena nel gioco vero, dove emergono i problemi reali di tempi e sincronizzazione. Dopo vengono 5–6 giocatori e l'orizzontale.
