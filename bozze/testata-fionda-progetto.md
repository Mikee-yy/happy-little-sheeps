# Testata a fionda: progetto

*Scritto il 21 ottobre 2026 dalle decisioni prese con l'utente. Da approvare prima del piano e del codice.*

## Lo scopo

Oggi la Testata del Montone si gioca in un riquadro a parte, sopra la scena: un disegno del recinto avversario a casette, si trascina e si lascia andare. L'idea dell'utente è giocarla **sul prato**, come una fionda: si tira indietro il Montone e lo si lancia verso il recinto dell'avversario, che sta in alto nella scena.

## Le decisioni prese

| Domanda | Scelta |
|---|---|
| Cosa decide il risultato | Come oggi forza e punto d'arrivo, ma sul prato: la forza decide quanto lontano vola il Montone |
| Cosa vedono gli altri telefoni | Un volo "di scena" uguale per tutti, coerente con il risultato (non il tiro esatto) |
| Come si contano gli agnellini | A bersaglio: tre cerchi sul recinto, centro 3, anello di mezzo 2, bordo 1, fuori 0 (mai più degli agnellini dell'avversario) |
| Aiuto per la mira | Una scia di puntini con l'inizio della traiettoria, non il punto d'arrivo |
| Tremolio della mira | Tolto |
| Partenza del Montone | Dal centro della tovaglia; il recinto bersaglio si ingrandisce dov'è e mostra i cerchi |
| Limite di tempo | Nessuno, come oggi |
| Tastiera e mouse | Mouse come il dito; tastiera: frecce per direzione e forza, Invio per lanciare |
| Bot | Tirano come oggi (D43), tutti vedono il volo di scena |
| Riquadro di oggi | Resta solo nei pannelli di riserva (scena non caricata) |

Il bersaglio si sceglie **prima**, toccando la pecora, come oggi: va dichiarato prima che gli altri possano rispondere col Beee-NO! (D4). La fionda arriva dopo, solo se la Testata non è annullata.

## Come si gioca, passo per passo

1. Esce la Testata. Tocchi la pecora da colpire (come oggi). Gli altri hanno il loro momento per il Beee-NO!.
2. Se nessuno annulla, sulla tovaglia, davanti a te, compare il **Montone** con un elastico. Il recinto dell'avversario **si ingrandisce** al suo posto (lo stesso zoom che la scena usa già per i recinti lontani) e mostra **tre cerchi** a bersaglio, con il numero di agnellini che vale ogni zona.
3. Appoggi il dito sul Montone e **tiri indietro**, cioè verso il basso: l'elastico si tende, il Montone si schiaccia un poco, e parte una **scia di puntini** nella direzione opposta che mostra l'inizio del volo. Più tiri, più lontano andrà.
4. **Lasci andare**: il Montone vola ad arco, con un "beee" e una piccola ombra a terra che segue il volo, e atterra.
5. Dove atterra decide il colpo: nel cerchio centrale 3 agnellini, nell'anello di mezzo 2, nel resto del recinto 1, fuori 0. Mai più di quanti ne ha l'avversario. Gli agnellini colpiti volano nel Gregge come oggi.
6. Se tiri poco cade corto, se tiri troppo vola oltre: in entrambi i casi è fuori, nessun agnellino.

Se tocchi fuori dal Montone o lasci andare quasi senza tirare (elastico quasi a riposo), il tiro non parte e puoi riprovare: un tocco per sbaglio non deve sprecare la Testata.

## Il bersaglio

I cerchi sono **ellissi**, perché il recinto è visto in prospettiva. Sono centrate al centro del recinto:

- **centro**: un quarto della larghezza e dell'altezza del recinto, vale 3;
- **anello di mezzo**: poco più della metà, vale 2;
- **bordo**: tutto il resto del recinto, vale 1.

Su ogni zona c'è il suo numero, già limitato agli agnellini dell'avversario. Con un avversario che ha 1 solo agnellino le tre zone mostrano 1, 1, 1: si capisce subito che basta prendere il recinto.

I recinti lontani sono più piccoli e quindi più difficili da centrare: è giusto così, ed è l'unica difficoltà in più rispetto all'elastico (niente tremolio).

## La forza e il volo

- La **direzione** è quella opposta al tiro dell'elastico: tiri in basso a sinistra, il Montone va in alto a destra.
- La **forza** è quanto tiri, fino a un massimo, ed è **misurata sul recinto bersaglio** (decisione dell'utente del 26 ottobre, dopo la revisione finale): tirando poco cadi corto, a metà tiro arrivi al centro del recinto, a tutta forza vai lungo. Il recinto occupa circa un terzo della corsa del dito; i recinti lontani restano più difficili solo nella direzione.
- **Tastiera:** la mira parte dal bordo davanti del recinto (Invio subito = 1 agnellino), e con le frecce si cerca il centro; il passo delle frecce è piccolo, legato alla grandezza del recinto.
- Il punto d'arrivo si calcola sul prato, in pianta; l'arco è solo il disegno del volo (sale e scende, il Montone si ingrandisce un poco a metà volo e si rimpicciolisce arrivando lontano, come la prospettiva della scena).
- La **scia di puntini** mostra circa il primo 40% del percorso: dice dove stai mirando, non dove atterrerai.

## Cosa vedono gli altri

Il motore riceve solo il risultato (0–3), come oggi. Gli altri telefoni vedono:

- la nuvoletta "Ada prende la mira sull'Ovile di Bea…" mentre si mira (come oggi);
- il **volo di scena**: il Montone parte dalla tovaglia davanti a chi tira e atterra in un punto coerente con il risultato:
  - 3: al centro del recinto;
  - 2: nell'anello di mezzo;
  - 1: sul bordo, dentro il recinto;
  - 0: appena fuori dal recinto (un po' corto o un po' lungo).
  Il punto preciso dentro la zona si sceglie in modo fisso dal numero della mossa, così è lo stesso su tutti i telefoni e anche rivedendo la partita.

Su chi tira, il volo segue esattamente il suo tiro. La durata del volo è la stessa per tutti, così il conto alla rovescia e le fasi automatiche delle stanze restano allineati (si aggiorna il file delle durate).

## Bot, partita di prova, riserva

- I **bot** e la partita di prova tirano con le probabilità di oggi (D43); il loro tiro si vede come volo di scena.
- La **partita di prova** ha una Testata preparata nei primi round: il consiglio della nuvoletta va riscritto per la fionda ("Tira indietro il Montone e lascialo andare verso il recinto: più sei vicina al centro, più agnellini cadono").
- I **pannelli di riserva** (scena non caricata) tengono il riquadro di oggi.

## Testi da aggiornare (tutti in `client/src/testi.ts`)

- Riassunto delle regole e pagina Regole: come si tira e i tre cerchi.
- Consiglio della partita di prova sulla Testata.
- Etichette dei cerchi (i numeri) e un'etichetta per lettori di schermo sul Montone ("Montone: trascina indietro e lascia andare. Frecce per mirare, Invio per lanciare").

## Cosa cambia nel codice (a grandi linee)

- **Motore e regole delle stanze: niente.** L'azione resta `esitoTestata` con il risultato.
- **Scena, scelte:** la domanda della Testata (oggi il riquadro in `GiocoInScena.tsx`) diventa una domanda dentro la scena, come le altre scelte (`client/src/scena/scelte/` per il momento, `chiedi.ts` per gesto e disegno): Montone con elastico, scia di puntini, recinto ingrandito con i cerchi, calcolo del punto d'arrivo e del risultato. Il calcolo (dal tiro al punto, dal punto al risultato) è una funzione pura, provata a parte.
- **Scena, regia:** la battuta della Testata (`copione.ts`, `ordini.ts`) oggi fa correre il Montone a terra fino al recinto; diventa il volo ad arco verso il punto d'arrivo. Su chi tira il punto è quello vero; sugli altri si ricava dal risultato. Durata nel file delle durate.
- **Riserva:** `Testata.tsx` resta per i pannelli.

## Prove

- Funzione pura: dal tiro (vettore dell'elastico) al punto d'arrivo; dal punto al risultato con le tre zone e il limite agli agnellini; tiri troppo deboli o troppo forti fuori; tiro quasi a riposo che non parte.
- Volo di scena: per ogni risultato il punto cade nella zona giusta, ed è lo stesso a parità di mossa.
- Scena: il gesto con dito, mouse e tastiera manda l'azione giusta; il recinto si ingrandisce e torna normale; niente doppio invio.
- Stanze: la durata del volo è uguale su tutti i telefoni; il conto alla rovescia non cambia.
- Partita di prova: la Testata preparata si gioca e il consiglio è quello nuovo.

## Schizzo

```
   ┌──────────────────────────────────────┐
   │  [BEA]                      [CLEO]   │
   │  ┌────────────┐                      │
   │  │  ( (●3) )  │  ← recinto di Bea    │
   │  │ (  2   )  1│    ingrandito, con   │
   │  └────────────┘    i tre cerchi      │
   │          ·                           │
   │         ·    ← scia di puntini       │
   │        ·       (inizio del volo)     │
   │   ╔═══════════ tovaglia ════════╗    │
   │   ║        🐏  ← Montone         ║    │
   │   ║        ╲                     ║    │
   │   ╚═════════╲═══════════════════╝    │
   │              ✋ ← tiri indietro       │
   │  [ADA]  il tuo recinto               │
   └──────────────────────────────────────┘
```

## Rischi

- **Precisione sul telefono piccolo:** i recinti lontani con 4 giocatori sono piccoli. Lo zoom sul bersaglio aiuta; se in prova risulta troppo difficile si allargano i cerchi (un numero in un file di dati, non nel codice).
- **Il dito copre il Montone:** si tira verso il basso, quindi il dito sta sotto il Montone e la scia sale verso l'alto, libera.
- **Spazio tra tovaglia e mano:** il Montone parte dalla tovaglia, sopra il tuo recinto; mentre si mira la mano resta abbassata come già succede durante le scelte nella scena.

## Seconda versione (decisa con l'utente il 26 ottobre 2026, dopo la prima prova)

**Partenza.** Il Montone non parte più dal centro della tovaglia ma **vicino alla pecora di chi tira**, ogni volta da una posizione leggermente diversa (una piccola variazione a caso a ogni tiro), così la traiettoria non si impara a memoria. Sugli altri telefoni parte vicino alla pecora di chi tira (la sua postazione), con la stessa variazione (ricavata in modo fisso dal numero della mossa, così è uguale su tutti i telefoni).

**Zone.** Gli agnellini colpiti tornano **nel Gregge, come oggi** (la regola non cambia):
- **centro del recinto: 3**;
- **dentro il recinto, verso i lati: 2**;
- **sulla staccionata o appena fuori, fino a circa mezzo Montone dal bordo: 1**;
- più in là: mancato.

**Bollini e cerchi.** Si vedono solo mentre si carica il tiro (elastico tirato, o mira con le frecce). Appena il Montone parte, cerchi e numeri spariscono: durante il volo e l'atterraggio si vede solo il recinto con gli agnellini. Resta la nuvoletta di polvere dove atterra.

**Il Montone animato.**
- **Mentre carichi:** si dimena (si agita, scalpita) più l'elastico è tirato.
- **In volo:** posa aerodinamica, zampe all'indietro, il vello che si muove al vento, e una scia di vento dietro di lui.
- **All'arrivo:** colpisce il recinto **con la testa** (testata vera sulla staccionata o sul punto d'arrivo), poi è **stordito per circa 2 secondi**: occhi a spirale, aria confusa (oscilla, stelline o uccellini che girano facoltativi). Poi **scuote la testa** e **corre via arrabbiato** (sbuffi dalle narici, passo deciso).
- Con "Riduci movimento": nessuna di queste animazioni, il Montone compare fermo al punto d'arrivo per un attimo.

**Durata.** La scena della Testata dura circa 4–5 secondi (prima 2,1): il valore nel file delle durate va misurato, ed è quello che chi ospita usa nelle stanze.
