# Testata a fionda, seconda versione — piano di lavoro

> **Per chi esegue:** SOTTO-PROCEDURA OBBLIGATORIA: superpowers:subagent-driven-development, compito per compito. I passi usano le caselle (`- [ ]`).

**Scopo:** la seconda versione della fionda decisa con l'utente il 26 ottobre: partenza vicino alla pecora di chi tira con una piccola variazione, nuove zone (centro 3, dentro 2, staccionata e appena fuori 1), cerchi e bollini solo mentre si carica, e il Montone animato (si dimena, vola aerodinamico con la scia, testata con la testa, stordito con gli occhi a spirale, scuote la testa e corre via arrabbiato).

**Architettura:** la parte pura (`client/src/scena/fionda/tiro.ts` + `fionda.json`) calcola partenza, zone e punto di scena; un nuovo modulo disegna il Montone a pezzi (`client/src/scena/fionda/montone.ts`) con pose e animazioni CSS; la mira (`mira.ts`) e la regia (`ordini.ts`) lo usano. Motore, regole e `sync/` non cambiano.

**Progetto:** `bozze/testata-fionda-progetto.md`, sezione "Seconda versione" (e le sezioni precedenti per ciò che non cambia). Prima versione: piano `bozze/testata-fionda-piano.md`.

## Vincoli generali

- Motore e `sync/` non si toccano; l'azione resta `esitoTestata` 0–3, gli agnellini tornano nel Gregge.
- Numeri della fionda (variazione della partenza, fascia della zona 1, tempi dello stordimento se legati al gioco) in `fionda.json`; testi in `client/src/testi.ts`; nomi e commenti in italiano.
- Il Montone nuovo è disegnato nello stile del pacchetto grafico (tratto Notte, colori pieni, come il simbolo `#montone` di `design/svg/sprite.svg`, che va guardato e rispettato nelle proporzioni); `design/` non si modifica.
- La durata della battuta Testata in `client/src/scena/regia/durate.json` va misurata (chi ospita la usa per tutti i telefoni); colpo e mancato durano uguale.
- Movimento ridotto: niente dimenarsi, volo, stordimento o corsa; il Montone compare fermo al punto d'arrivo per un attimo.
- Solo prove mirate durante il lavoro; niente commit.

## Da guardare in revisione

1. **Partenza vicino alla propria pecora:** la zona di tocco del Montone non deve finire sotto la mano delle carte né sopra il dado o i pulsanti; con 2, 3 e 4 giocatori. Prova nel compito 1/3.
2. **Zona 1 fuori dal recinto:** un punto appena fuori dalla staccionata (entro la fascia) vale 1, oltre vale 0; mai più degli agnellini. Prova nel compito 1.
3. **Stessa variazione su tutti i telefoni:** il punto di partenza di scena dipende solo dal numero della mossa e dalla postazione. Prova nel compito 1.
4. **Animazioni lunghe interrotte:** una ricostruzione o un ritorno da un'altra scheda durante lo stordimento o la corsa toglie tutto pulito. Prova nel compito 4.
5. **Durata uguale per colpo e mancato**, e uguale al file delle durate. Prova nel compito 4.

---

### Compito 1: partenza, zone e punto di scena (calcolo puro)

**File:** `client/src/scena/fionda/tiro.ts`, `fionda.json`, `tiro.test.ts`.

**Interfacce prodotte:**
- `partenzaDi(base: Punto, variazione: number): Punto` — la base è il punto vicino alla pecora di chi tira (vedi compito 3), `variazione` un numero in [0,1) (a caso su chi tira, da `seq` sugli altri); sposta la partenza entro un raggio `variazionePartenza` (unità del mondo) in `fionda.json`.
- `variazioneDaSeq(seq: number): number` in [0,1), fissa.
- `zonaDi(p, r)`: 3 nel cerchio centrale (`cerchi.centro`), 2 nel resto dell'interno del recinto, 1 sulla staccionata e fuori fino a `fasciaBordo` unità del mondo dal bordo (circa mezzo Montone: proporre il valore dalla larghezza reale del Montone in scena a quella profondità e scriverlo nel report), 0 oltre. (Il cerchio di mezzo `cerchi.mezzo` non serve più come zona: toglierlo da json e codice se nessuno lo usa.)
- `puntoDiScena(r, esito, seq)`: 1 → un punto sulla staccionata o nella fascia appena fuori.
- La fascia di forza (`fasciaDi`/`puntoArrivo`) resta misurata sul recinto bersaglio, dalla nuova partenza.

**Prove (scritte prima):** zone 3/2/1/0 ai bordi delle fasce (dentro vicino alla staccionata = 2; appena fuori entro la fascia = 1; oltre = 0); `esitoTiro` limitato agli agnellini; `partenzaDi` sempre entro il raggio; `variazioneDaSeq` uguale per lo stesso seq e diversa per seq diversi (su 20 valori almeno 10 distinti); `puntoDiScena` nella zona giusta per ogni esito e seq 1–40.

---

### Compito 2: il Montone disegnato a pezzi e le sue pose

**File:** nuovo `client/src/scena/fionda/montone.ts`, stili in `client/src/scena/scena.css` (sezione commentata "Montone animato"), prove `client/src/scena/fionda/montone.test.ts`.

**Interfacce prodotte:**
- `montoneSVG(): string` — il Montone di profilo verso destra, nello stile del simbolo `#montone` del pacchetto (stesse proporzioni e colori), ma con le parti separate in gruppi con classi: `mt-corpo`, `mt-vello` (ciuffi), `mt-testa`, `mt-corna`, `mt-occhi` (normali) e `mt-spirale` (occhi a spirale, nascosti di base), `mt-zampe-av`, `mt-zampe-dt`, `mt-coda`, `mt-sbuffi` (nascosti), `mt-scia` (scia del vento, nascosta), `mt-stelline` (facoltative, nascoste).
- Pose come classi sull'elemento contenitore: `posa-riposo`, `posa-carica` (si dimena; intensità con la variabile CSS `--carica` da 0 a 1), `posa-volo` (zampe all'indietro, vello al vento, scia visibile), `posa-botta` (testa in avanti, schiacciata), `posa-stordito` (occhi a spirale che girano, oscilla, stelline), `posa-scuote` (scuote la testa), `posa-corre` (corsa, sbuffi dalle narici, aria arrabbiata).
- Movimento ridotto: le pose cambiano l'aspetto senza animazioni.

**Prove:** il disegno contiene tutte le parti; ogni posa ha regole CSS; `mt-spirale` visibile solo in `posa-stordito`; `mt-scia` solo in `posa-volo`. Un foglio di prova `.superpowers/confronti/montone-pose.html` (generato da uno script tsx) mostra le pose animate una accanto all'altra, da guardare nel pannello del browser e da mostrare all'utente.

---

### Compito 3: la mira — partenza vicino alla propria pecora, cerchi solo mentre si carica

**File:** `client/src/scena/fionda/mira.ts`, `mira.test.ts`, `client/src/scena/servizi/regia.ts` (tipo di `tiroLocale`).

- La base della partenza è vicino alla pecora di chi sta in basso (da `palco.posto(io)`: accanto alla pecora, sul prato davanti al recinto, scegliendo un punto che non stia sotto la mano delle carte, il dado o i pulsanti — misurare con 2, 3, 4 giocatori); a ogni nuova mira `partenzaDi(base, Math.random())`. `tiroLocale` porta anche la `partenza` usata.
- Il Montone è quello nuovo del compito 2: `posa-riposo`, `posa-carica` mentre si tira con `--carica` = forza/forza massima (anche con le frecce).
- Cerchi e bollini si vedono **solo mentre si carica** (elastico tirato o mira con le frecce attiva); a riposo e dopo il tiro non ci sono.

**Prove:** partenza diversa tra due mire e entro il raggio; zona di tocco non sovrapposta alla mano e al dado (rettangoli) con 2/3/4 giocatori; cerchi assenti a riposo, presenti mentre si tira, assenti dopo il lancio; `--carica` segue la forza; `tiroLocale.partenza`.

---

### Compito 4: la regia — volo aerodinamico, testata, stordimento, corsa via

**File:** `client/src/scena/ordini.ts`, `ordini.test.ts`, `client/src/scena/regia/durate.json`, `durate.test.ts`.

- Partenza: su chi tira `tiroLocale.partenza`; sugli altri vicino alla pecora di chi tira (`palco.posto(chi)`, stessa regola di base del compito 3) con `partenzaDi(base, variazioneDaSeq(seq))`.
- Togliere i cerchi dopo il tiro (introdotti nella prima versione): durante volo e atterraggio si vede solo il recinto; la nuvoletta di polvere resta.
- Sequenza: volo in `posa-volo` (scia), **testata** in `posa-botta` sul punto d'arrivo (la testa davanti, con il colpo, la scossa e gli agnellini che volano nel Gregge se esito > 0; con esito 0 un colpo più leggero a terra), **stordito** circa 2 s in `posa-stordito`, **scuote** la testa, **corre via arrabbiato** in `posa-corre` verso il lato più vicino. Ombra a terra durante il volo come oggi; livelli come oggi (dietro la staccionata davanti dopo l'atterraggio).
- Durata misurata, uguale per colpo e mancato, scritta in `durate.json`.
- Movimento ridotto: Montone fermo al punto d'arrivo circa 800 ms, poi via.

**Prove:** partenza su chi tira e sugli altri; nessun cerchio dopo il tiro; sequenza delle pose nell'ordine giusto; agnellini al momento della testata; interruzione a metà stordimento e a metà corsa toglie tutto; durata = file, uguale nei due rami; movimento ridotto.

---

### Compito 5: insieme, testi, prova a occhio

**File:** pagina di prova (`client/src/scena/sviluppo/*`, pulsante "Testata a fionda" già presente), `client/src/testi.ts` (consiglio della partita di prova e REGOLE, solo se cambia qualcosa da dire: le zone 3/2/1), note in `bozze/da-fare.md`, `bozze/passaggio-di-consegne.md`.

- REGOLE, Dado del Pastore: "Centro del recinto 3 agnellini, dentro il recinto 2, sulla staccionata o appena fuori 1, più in là nessuno (mai più di quanti ne ha)."
- Prova a occhio nel browser (pagina di prova, pulsante "Testata a fionda", 375×812): partenza vicino alla propria pecora che cambia, il Montone che si dimena, il volo con la scia, la testata, gli occhi a spirale, la corsa via; un colpo per zona; foto in `.superpowers/confronti/fionda3-*.png|jpg`.
- Prove mirate: `fionda/`, `ordini.test.ts`, `regia/`, `chiedi.test.ts`, `teatro.test.ts`, `App.test.tsx`, `remoto/Stanza.test.tsx`, `prova/`, `testi.test.ts`; `npm run typecheck`.
