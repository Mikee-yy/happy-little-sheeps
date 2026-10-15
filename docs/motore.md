# Motore di Happy Little Sheeps — specifica

Questa è la specifica normativa del modulo `engine`. Le regole vengono dal brief (`brief-codice2.md`, sezioni 3 e 4); dove il brief è muto o ambiguo vale la sezione **Decisioni** in fondo (D1…D44). I tipi sono in `engine/src/tipi.ts`, i dati in `engine/data/cards.json` e `engine/data/setup.json`.

## 1. Principi

- **Funzione pura.** `applica(stato, azione)` restituisce un nuovo stato e non modifica mai l'argomento. Niente rete, tempo, `Math.random`, `Date`, interfaccia.
- **Casualità con seme.** Ogni estrazione (mescolate, dado, spareggi casuali) passa dal generatore in `stato.rng` (mulberry32, uint32). Stesso stato + stessa azione ⇒ stesso risultato.
- **Dati, non codice.** Carte, facce del dado, numeri della preparazione, tratti delle pecore e soglie di eliminazione vengono da `cards.json` e `setup.json`. `nuovaPartita` copia in `stato.config` i numeri della partita.
- **Azioni non valide.** `applica` lancia `ErroreRegola` (con `codice`) e lo stato originale resta intatto.
- **Fine partita.** Con `stato.esito` impostato e `fase.nome === 'fine_partita'` ogni azione viene rifiutata (`partita_finita`).

## 2. API pubblica (`engine/src/index.ts`)

```ts
// Catalogo
CATALOGO: { carte: Record<IdTipoCarta, DefCarta>; pecore: Record<IdPecora, DefPecora> }
SETUP: contenuto di setup.json
tipoDi(carta: IdCarta | IdTipoCarta): IdTipoCarta          // "calzino-gemello#2" → "calzino-gemello"
defCarta(carta: IdCarta | IdTipoCarta): DefCarta            // lancia se il tipo non esiste
creaMazzoPrincipale(numeroGiocatori: number): IdCarta[]     // istanze non mescolate, in ordine di catalogo; a 2 giocatori senza le Trovate di valore 1, 2, 3
creaMazzoGuai(): IdCarta[]                                  // 24 istanze non mescolate
configPer(numeroGiocatori: number): ConfigPartita

// Partita
nuovaPartita(o: { giocatori: Array<{ id: IdGiocatore; nome: string; pecora: IdPecora }>; seme: number; preparazione?: Preparazione }): Stato
                                                            // preparazione: solo la partita di prova (PROVA, da prova.json), vedi §3
applica(stato: Stato, azione: Azione): Stato
tentaApplica(stato: Stato, azione: Azione): { ok: true; stato: Stato } | { ok: false; errore: ErroreRegola }
vistaPer(stato: Stato, giocatore: IdGiocatore | null): Vista
inAttesaDi(stato: Stato): Attesa
azioniPossibili(stato: Stato, chi: IdGiocatore | 'sistema'): Azione[]

// Aiuti per interfaccia, bot e test (funzioni pure)
punteggioTotale(stato: Stato, giocatore: IdGiocatore): number          // somma dei delta delle righe del round (0 se non partecipa)
postiLiberi(stato: Stato, giocatore: IdGiocatore): number
angoloElimina(tipi: TipoGuaioCarta[], regole: RegolaEliminazione[]): boolean
tipiCheEliminano(stato: Stato, giocatore: IdGiocatore): TipoGuaioCarta[] // tipi di Guaio che, aggiunti all'Angolo, eliminerebbero (vuoto = non a rischio)
eFaseAutomatica(nome: NomeFase): boolean                                // guaio, rivelazione, guaio_al_peggiore, fine_round, ultimo_round
```

`azioniPossibili(stato, chi)` elenca **tutte** le azioni valide per `chi` in quello stato (per il sistema: `prosegui` e/o `scadenza`). Ogni azione elencata deve essere accettata da `applica`. Per i Belati e le carte uguali basta una istanza per tipo; per il furto elenca tutte le ripartizioni valide; per `scarta_fino_a_tre` tutti i sottoinsiemi da 0 a 3 carte; per l'esito della Testata tutti i valori ammessi.

## 3. Preparazione (`nuovaPartita`)

1. Valida: da 2 a 4 giocatori; id unici, non vuoti e diversi dai nomi di `Object.prototype` (`__proto__`, `constructor`…); nomi testuali non vuoti; pecore valide e diverse tra loro (`giocatori_non_validi`).
2. `config = configPer(n)`: posti dell'Ovile, agnellini totali e iniziali, mano iniziale, regole di eliminazione (`dueGiocatori` se n = 2, altrimenti `normale`), facce del dado, esito massimo della Testata.
3. `rng = seme >>> 0`. Mescola il mazzo principale (`creaMazzoPrincipale(n)`) e il mazzo Guai con Fisher–Yates sul generatore.
4. Ogni giocatore riceve 3 agnellini; `gregge = agnelliniTotali − 3·n`.
5. Distribuisci 5 carte a testa, una alla volta in ordine di posto partendo dal primo giocatore.
6. `primoGiocatore` è estratto a caso con il generatore (prima della distribuzione).
7. Avvia il round 1 (sezione 4.1). Lo stato restituito è in fase `guaio` con il Guaio già scoperto.

Mazzo principale: 44 Trovate + 18 Belati (16 del brief + 2 "Visita di Garzina") = 62 carte; a 2 giocatori 50 carte. Mazzo Guai: 24.


**Partita di prova (preparazione facoltativa).** Con `preparazione` (dati in `engine/data/prova.json`, esportati come `PROVA`), dopo la mescolata normale `nuovaPartita` dà a ogni giocatore la mano indicata (completata dalla cima del mazzo se più corta), mette in cima al mazzo e al mazzo Guai le carte indicate, fissa il primo giocatore e salva in `stato.dadoPreparato` le facce dei primi tiri: `lanciaDado` le usa per prime, poi torna al caso. Tipo sconosciuto, copie insufficienti, giocatore o faccia sconosciuti: `preparazione_non_valida`. `dadoPreparato` non compare mai nelle viste. Senza preparazione il risultato è identico a prima.

## 4. Macchina a stati del round

Le fasi **automatiche** (`guaio`, `rivelazione`, `guaio_al_peggiore`, `fine_round`, `ultimo_round`) aspettano l'azione di sistema `prosegui`, che serve all'interfaccia per dare il ritmo. Tutte le altre aspettano giocatori. "Entrare in una fase" significa eseguire subito i passi automatici descritti; se una fase non ha nessuno da aspettare si passa oltre immediatamente.

Mentre la pila non è vuota (o c'è una `richiesta`) sono accettate solo le azioni della sezione 5 (o `completaEffetto` del giocatore della richiesta): tutto il resto è `pila_non_vuota` / `richiesta_in_corso`.

### 4.1 Inizio round (`iniziaRound(numero)`)

- `round = numero`. Dal round 2 in poi `primoGiocatore` passa al successivo non eliminato in ordine di posto.
- `datiRound` azzerato (partecipanti vuoti, nessuna giocata, `guaio: null`).
- Evento `round_iniziato`.
- Se `numero === ultimoRound` → fase `ultimo_round` (il Guaio non è ancora scoperto); `prosegui` → scopri il Guaio ed entra in `guaio`.
- Altrimenti scopri il Guaio ed entra in `guaio`.

**Scoprire il Guaio:** se `mazzoGuai` è vuoto e `guaiFuoriGioco` non lo è, mescola `guaiFuoriGioco` nel mazzo Guai (evento `guai_rimescolati`). Se c'è almeno una carta, la cima diventa `datiRound.guaio`; altrimenti `datiRound.guaio = null` e il round si gioca senza Guaio. Evento `guaio_rivelato`.

### 4.2 `guaio` → `prosegui` → `scelta`

Entrando in `scelta`, per ogni giocatore non eliminato in ordine di posto a partire da `primoGiocatore`:
- se ha almeno una Trovata in mano, è partecipante;
- altrimenti: se il mazzo principale è vuoto, non scarta nulla, resta fuori dal round (evento `fuori_dal_round`); se non è vuoto, scarta tutta la mano e pesca 5 carte (o quelle che restano), e ripete finché ha una Trovata o il mazzo è vuoto (evento `ripescata` per ogni giro). Le pescate possono far scattare l'ultimo round (sezione 9).

`datiRound.partecipanti` = i partecipanti in ordine di posto. `fase.scelte` = `{ partecipante: null }`. Se non ci sono partecipanti si entra subito in `rivelazione`.

**`scegliTrovata { giocatore, carte }`** (solo partecipanti): `carte` è una Trovata in mano, oppure due Trovate Gemelle distinte in mano (due Gemelle qualsiasi). Si può cambiare scelta finché non hanno scelto tutti. Evento `ha_scelto`. Quando tutti i partecipanti hanno scelto si entra in `rivelazione`.

### 4.3 `rivelazione`

Entrando: le carte scelte passano dalla mano a `datiRound.giocate` e a `datiRound.tavolo`; evento `rivelazione`. Per ogni partecipante si scrivono le righe di base:
- una riga `valore` per ogni carta giocata (delta = valore stampato, `carta` = la carta);
- una riga `tratto` se il Guaio attivo è di tipo `meteo`/`predatori`/`drammi` e coincide con il bonus (+1) o il malus (−1) della pecora. Tosatura a Sorpresa o nessun Guaio: nessuna riga.

`prosegui` → `effetti`.

### 4.4 `effetti`

Entrando si costruisce `fase.coda`: una voce per ogni carta giocata che ha un effetto (anche entrambe le Gemelle, se avessero effetti). Ordine: gruppo (`round`, poi `normale`, poi `punteggio`), poi valore stampato crescente, poi meno agnellini (contati all'ingresso nella fase), poi un ordine casuale dei giocatori estratto con il generatore all'ingresso, **solo se** due voci di giocatori diversi sono ancora pari (altrimenti il generatore non avanza); a parità di giocatore, ordine delle carte in `giocate`.

Avanzamento: finché c'è una voce corrente,
- se `datiRound.ignoraEffetti` è impostato e la voce non è quella carta → esito `ignorato`, avanti;
- se l'effetto non è attivabile (tabella 6) → esito `saltato`, avanti;
- altrimenti si aspetta il proprietario.

**`attivaEffetto { giocatore, carta, bersaglio? }`**: solo la voce corrente e il suo proprietario; `bersaglio` obbligatorio e valido per `sposta_agnellino`, vietato negli altri casi. Mette in pila una voce `effetto_trovata` (esito `attivato`) e apre la finestra (sezione 5).
**`rinunciaEffetto { giocatore, carta }`**: esito `rinunciato`, avanti.

Quando la voce si risolve: se annullata → esito `annullato`; altrimenti si applica l'effetto (sezione 6), eventualmente con una `richiesta` privata da completare con `completaEffetto`. Poi si passa alla voce successiva. Esaurita la coda: se i partecipanti sono almeno 2 si entra in `belati_punteggio`, altrimenti si chiude il punteggio (4.6).

Un effetto annullato non toglie il valore della carta: conta comunque nel punteggio.

### 4.5 `belati_punteggio`

Entrando: `fase.inAttesa` = tutti i non eliminati. Con la pila vuota:
- chiunque non eliminato (anche chi ha già passato, anche chi non partecipa) può giocare un Belato con `quando = 'punteggio'`: `modifica_punteggio` con `bersaglio` partecipante, oppure `scambia_punteggi`. Il Belato va in pila (sezione 5). Dopo la sua risoluzione, annullato o no, `inAttesa` torna a contenere tutti i non eliminati.
- **`passa { giocatore }`** toglie il giocatore da `inAttesa`; quando è vuota si chiude il punteggio.
- **`scadenza`** (sistema, pila vuota) chiude subito il punteggio.

### 4.6 Chiusura del punteggio

Totali = somma delle righe dei partecipanti. Sia P l'insieme dei partecipanti:
- |P| = 0 → `piuAlti = []`, `piuBassi = []`.
- |P| = 1 → `piuAlti = P`, `piuBassi = []` (D23).
- |P| ≥ 2 e tutti pari → `piuAlti = []`, `piuBassi = []` ("tutti pari": nessuno lancia, il Guaio va in fondo).
- altrimenti `piuAlti` = chi ha il massimo, `piuBassi` = chi ha il minimo.

`lanciatori` = `piuAlti` ordinati per meno agnellini, poi a caso col generatore (usato solo per i gruppi con gli stessi agnellini). Se ci sono lanciatori → `dado` con indice 0, altrimenti "dopo il dado" (4.8).

### 4.7 `dado` e `risoluzione_dado`

**`lanciaDado { giocatore }`** (solo il lanciatore corrente): estrae una faccia dal generatore pesando le `copie` (6 facce), evento `dado_lanciato`, entra in `risoluzione_dado`.
- **Pascolo**: quantità = min(q, gregge, posti liberi). Se 0 → nessun effetto, prossimo lanciatore. Altrimenti dichiarazione automatica `{ pascolo, quantita }` in pila.
- **Furto** (q = 2 o 4): `eff = min(q, postiLiberi)`, `daAvversari = min(eff, agnellini totali degli avversari non eliminati)`, `dalGregge = min(eff − daAvversari, gregge)`. Se `daAvversari + dalGregge = 0` → nessun effetto. Se la ripartizione è obbligata (gli avversari con agnellini sono al più uno, oppure si devono prendere tutti i loro agnellini) la dichiarazione è automatica; altrimenti `passo = 'dichiarazione'` e si aspetta **`dichiaraDado { giocatore, furto }`**: interi ≥ 0, solo avversari non eliminati, ciascuno ≤ agnellini di quell'avversario, somma = `daAvversari`.
- **Testata**: i bersagli validi sono avversari non eliminati con almeno 1 agnellino. Nessuno → nessun effetto. Uno solo → dichiarazione automatica. Altrimenti si aspetta **`dichiaraDado { giocatore, bersaglio }`**.
- Dichiarata la faccia: voce `dado` in pila, `passo = 'reazione'`, finestra aperta. Se la voce si risolve annullata → nessun effetto. Altrimenti:
  - pascolo e furto si applicano (prima gli avversari, poi il Gregge), poi controllo Ovile pieno;
  - Testata → `passo = 'esito_testata'` e si aspetta **`esitoTestata { giocatore, esito }`**: intero 0 ≤ esito ≤ min(esitoMassimoTestata, agnellini del bersaglio), altrimenti `esito_non_valido`. Gli agnellini tornano nel Gregge. Evento `testata`.
- Poi il prossimo lanciatore (`dado` con indice + 1) o "dopo il dado".

### 4.8 Dopo il dado → `guaio_al_peggiore`

Se `datiRound.guaio` è null → `fine_round`. Altrimenti si entra in `guaio_al_peggiore` con `destinatario = piuBassi[0]` se `piuBassi` ha un solo elemento, `spareggio = piuBassi` se ne ha due o più, entrambi null se è vuoto. `prosegui`:
- `destinatario` → `belati_salvataggio`;
- `spareggio` → `belato_finale`;
- nessuno dei due → il Guaio va in fondo al mazzo Guai (evento `guaio_in_fondo`) → `fine_round`.

### 4.9 `belato_finale`

Entrando (e a ogni ripetizione) con i partecipanti allo spareggio:
- chi non ha Trovate in mano: se è uno solo prende il Guaio → `belati_salvataggio` con lui; se sono due o più → Guaio in fondo, `fine_round`;
- altrimenti `scelte` tutte null e si aspetta **`sceltaFinale { giocatore, carta }`**: una sola Trovata dalla mano (anche una Gemella, da sola; mai due). Si può cambiare scelta finché non hanno scelto tutti.

Quando tutti hanno scelto: le carte vanno dalla mano a `tavolo`, si aggiunge una voce a `storico`, evento `belato_finale`. Conta solo il valore stampato: niente tratti, effetti, Gemelle, Belati, scambi. Il minimo, se è di uno solo, prende il Guaio → `belati_salvataggio`; se è di più giocatori, si ripete tra loro. Chi partecipa al Belato Finale non lancia il dado (lo spareggio avviene dopo il dado).

### 4.10 `belati_salvataggio`

Si aspetta il `destinatario`:
- **`passa`** → prende il Guaio → `consolazione`;
- **`giocaBelato`** con `guaio_in_fondo` → in pila; se si risolve: Guaio in fondo al mazzo Guai, `fine_round` (niente consolazione);
- **`giocaBelato`** con `devia_guaio` e `bersaglio` (un altro partecipante del round, non eliminato) → in pila; se si risolve: evento `guaio_deviato`, si resta in `belati_salvataggio` con il nuovo destinatario, che può a sua volta salvarsi. Il ritorno al mittente è ammesso.
- Se il Belato viene annullato si resta in `belati_salvataggio` con lo stesso destinatario, che può giocare un altro Belato o passare.

### 4.11 `consolazione`

Entrando: il Guaio va nell'Angolo del destinatario (`datiRound.presoDa`, evento `guaio_preso`); il destinatario prende 1 agnellino dal Gregge se ce n'è e ha posto; controllo Ovile pieno (può vincere qui, D30). Poi si aspetta il destinatario:
- **`giocaBelato`** con `cura` (Visita di Garzina) e `guaio` = un Guaio del proprio Angolo → in pila; se si risolve il Guaio torna in fondo al mazzo Guai (evento `guaio_curato`). Si può giocare più volte.
- **`concludiConsolazione { giocatore, scarta }`**: `scarta` è null o una carta della propria mano, che va negli scarti. Poi **controllo eliminazione** del destinatario (sezione 8) → eventuale fine partita "ultima pecora" → `fine_round`.

### 4.12 `fine_round`

Entrando:
1. `datiRound.tavolo` va negli scarti.
2. Se `round === ultimoRound` → fine partita per mazzo finito (sezione 9) e stop.
3. Altrimenti ogni non eliminato, in ordine di posto da `primoGiocatore`, pesca fino ad avere 5 carte (finché il mazzo ne ha). Eventi `pescate`.

`prosegui` → `iniziaRound(round + 1)`.

## 5. Pila di reazione e Beee-NO!

- **Voci annullabili**: effetti di Trovata (`attivaEffetto`), ogni Belato (compreso Beee-NO!), ogni risultato del dado dichiarato. Ogni voce ha un id progressivo (`prossimaVoce`) e un evento `dichiarazione`.
- La pila contiene sempre: in fondo una voce base, sopra solo Beee-NO!, ciascuno contro la voce subito sotto.
- **Finestra**: quando una voce va in cima, `finestra = { voce: id, inAttesa: tutti i non eliminati tranne l'autore della cima }`.
- **`giocaBelato` con Beee-NO!**: ammesso solo con pila non vuota, `voce` = id della cima (altrimenti `voce_non_in_cima`), giocatore in `finestra.inAttesa`, carta Beee-NO! in mano. Diventa la nuova cima con una finestra nuova. Chi non è in `inAttesa` (autore della cima, chi ha già passato su questa cima, eliminati) non può giocarlo.
- **`passa`** con finestra aperta: il giocatore deve essere in `inAttesa` e ne esce. Quando `inAttesa` è vuota la cima si risolve.
- **`passa.voce`**: id della cima a cui si risponde, oppure `null` per passare nella fase (Belati di punteggio, salvataggio). Se non corrisponde a ciò che è aperto adesso l'azione è rifiutata (`voce_non_in_cima`): con più dispositivi un "Lascia passare" non deve finire su una finestra aperta nel frattempo. Senza `voce` non si controlla. `azioniPossibili` la compila sempre.
- **`scadenza`** (sistema): tutti i rimasti passano, la cima si risolve. Chiude solo la finestra corrente.
- **Risoluzione della cima**:
  - se è un Beee-NO!: annulla la voce subito sotto (eventi `annullata` e `risolta`) e la toglie dalla pila. Se resta qualcosa nella pila, si apre una finestra nuova sulla nuova cima (tutti possono rispondere di nuovo); se la pila è vuota, la voce base è stata annullata e la fase prosegue di conseguenza.
  - se è la voce base: si applica (evento `risolta`) e la fase prosegue.
- Le carte Belato giocate (annullate o no) vanno subito da mano a `datiRound.tavolo`.
- Un risultato del dado che non può fare nulla (es. Pascolo con Gregge vuoto) non viene messo in pila (D22); un effetto di Trovata che non può cambiare nulla viene saltato (D11, tabella 6). Un Belato invece si può sempre giocare se il suo momento lo consente, anche quando non cambierebbe nulla.

## 6. Effetti delle Trovate

| Effetto | Gruppo | Attivabile se | Dichiarazione | Applicazione |
| --- | --- | --- | --- | --- |
| `ignora_effetti` | round | c'è almeno un'altra voce in `attesa` dopo di lei nella coda | — | `datiRound.ignoraEffetti = { giocatore, carta }`: le voci successive della coda sono `ignorato`. Non tocca valori, tratti, Belati. |
| `scarta_e_somma` | normale | il proprietario ha almeno una Trovata in mano | — | `richiesta scarta_e_somma`: `completaEffetto` con 1 Trovata della mano → scarti; riga `effetto` con delta = valore stampato della carta scartata (`carta` = carta scartata). La carta scartata non attiva effetti. |
| `prendi_agnellino` | normale | Gregge ≥ 1 | — | 1 agnellino dal Gregge (nei limiti dei posti), controllo Ovile pieno. |
| `scarta_fino_a_tre` | normale | almeno 1 carta in mano | — | `richiesta scarta_fino_a_tre`: `completaEffetto` con 0–3 carte distinte della mano → scarti. |
| `sposta_agnellino` | normale | esiste un avversario non eliminato con ≥ 1 agnellino | `bersaglio` = quell'avversario | 1 agnellino del bersaglio torna nel Gregge (se ne ha ancora). |
| `guarda_due` | normale | mazzo principale ≥ 1 | — | Prende le prime 2 carte (o 1). Con 2 carte: `richiesta guarda_due` con le carte (segrete): `completaEffetto` con 1 di esse → in mano, l'altra → scarti. Con 1 carta: va in mano senza richiesta. Conta come pescata per l'ultimo round. |
| `scambia_punteggi` | punteggio | almeno 2 partecipanti con totali non tutti uguali | — | Scambio (sezione 7). |
| `raddoppia_belati` | punteggio | il raddoppio non è già attivo | — | `datiRound.raddoppioBelati = true` (non cumulabile). |

## 7. Belati

| Effetto | Quando | Chi | Parametri | Applicazione |
| --- | --- | --- | --- | --- |
| `modifica_punteggio` (+2 / −2) | `belati_punteggio`, pila vuota | qualsiasi non eliminato | `bersaglio`: un partecipante | riga `belato` sul bersaglio, delta = valore × (2 se `raddoppioBelati`, altrimenti 1) |
| `scambia_punteggi` | `belati_punteggio`, pila vuota | qualsiasi non eliminato | — | scambio |
| `guaio_in_fondo` | `belati_salvataggio`, pila vuota | il destinatario | — | Guaio in fondo al mazzo Guai, `fine_round` |
| `devia_guaio` | `belati_salvataggio`, pila vuota | il destinatario | `bersaglio`: altro partecipante non eliminato | nuovo destinatario |
| `beee_no` | pila non vuota | in `finestra.inAttesa` | `voce` = cima | annulla la voce sotto |
| `cura` | `consolazione`, pila vuota | il destinatario | `guaio`: un Guaio del proprio Angolo | quel Guaio va in fondo al mazzo Guai |

Parametri: `bersaglio` solo per `modifica_punteggio` e `devia_guaio`, `voce` solo per `beee_no`, `guaio` solo per `cura`; un parametro non previsto è rifiutato (`scelta_non_valida`), come in `attivaEffetto` e in `dichiaraDado` (`furto` solo per il Furto, `bersaglio` solo per la Testata). Così `azioniPossibili` elenca davvero tutte le azioni valide.

**Scambio dei punteggi** (Trovata o Belato, si applica nel momento in cui si risolve, sui totali correnti): fra i partecipanti, M = massimo, m = minimo. Se M = m non succede nulla. Altrimenti ogni giocatore con totale M riceve una riga `scambio` con delta m − M, e ogni giocatore con totale m una riga con delta M − m. I giocatori intermedi non cambiano. Due scambi di fila si compensano. Non si applica mai al Belato Finale.

Punteggi negativi ammessi.

## 8. Eliminazione

Si controlla solo per chi ha appena preso un Guaio, alla fine della consolazione. Ogni Tosatura a Sorpresa vale come un solo Guaio del tipo che serve. Con c(t) = Guai di tipo t (meteo, predatori, drammi) e j = Tosature:
- `uguali k`: esiste t con c(t) + j ≥ k;
- `diversi k` (k = 3): (numero di tipi con c(t) ≥ 1) + j ≥ 3;
- `perTipo k`: Σ max(0, k − c(t)) ≤ j.

Regole: 3–4 giocatori `uguali 3` o `diversi 3`; 2 giocatori `uguali 4` o `perTipo 2` (a 2 giocatori tre tipi diversi non eliminano).

L'eliminato: evento `eliminato`, la mano va negli scarti, i suoi agnellini tornano nel Gregge, il suo Angolo va in `guaiFuoriGioco`, `eliminato = true`. Se resta un solo non eliminato → fine partita `ultima_pecora`.

`tipiCheEliminano(stato, g)` = i tipi tra `meteo`, `predatori`, `drammi`, `tosatura` che, aggiunti all'Angolo di g, lo eliminerebbero.

## 9. Fine partita

1. **Ovile pieno** — dopo ogni spostamento di agnellini: se un non eliminato ha `agnellini ≥ postiOvile`, la partita finisce subito (anche a metà round o con la pila piena). Vince l'autore dell'azione se è tra i pieni, altrimenti tutti i pieni. Gli agnellini oltre i posti liberi non si prendono mai.
2. **Ultima pecora** — dopo un'eliminazione, se resta un solo non eliminato.
3. **Mazzo finito** — appena viene pescata l'ultima carta del mazzo principale (in qualunque momento: ripescata, effetto `guarda_due`, pescata di fine round), se `ultimoRound` è null diventa `round + 1` (evento `ultimo_round_annunciato`). Il round in corso si completa, si gioca il round `ultimoRound` (preceduto dalla fase `ultimo_round`), poi alla sua `fine_round` vince il non eliminato con più agnellini; a parità chi ha meno Guai nell'Angolo; a ulteriore parità vittoria condivisa. Gli scarti non si rimescolano mai.

Alla fine: `esito = { modo, vincitori }`, `fase = { nome: 'fine_partita' }`, pila, finestra e richiesta svuotate, evento `fine_partita`.

## 10. Informazioni nascoste (`vistaPer`)

`vistaPer(stato, g)` restituisce una `Vista` senza:
- le mani degli altri (`mano: null`, resta `carteInMano`);
- l'ordine e il contenuto dei mazzi (solo `carteNelMazzo`, `carteNelMazzoGuai`);
- `rng`;
- le scelte segrete in `scelta` e `belato_finale` (solo `haScelto` per tutti e `miaScelta` per g);
- le carte della `richiesta guarda_due` se non è di g (resta la richiesta con `carte: []`);
- le carte degli eventi `pescate` se non sono di g.

Con `g = null` si ottiene la vista tavolo: nessuna mano. Scarti, Angoli, Guai fuori gioco, pila, punteggi e giocate rivelate sono pubblici. `vista.attesa = inAttesaDi(stato)`.

## 11. `inAttesaDi`

- `fine_partita` → nessuno.
- `richiesta` → il suo giocatore.
- finestra aperta → `finestra.inAttesa`.
- fasi automatiche → `sistema: true`.
- `scelta` / `belato_finale` → chi non ha ancora scelto.
- `effetti` → il proprietario della voce corrente.
- `belati_punteggio` → `fase.inAttesa`.
- `dado` → il lanciatore corrente; `risoluzione_dado` in `dichiarazione` o `esito_testata` → il lanciatore.
- `belati_salvataggio`, `consolazione` → il destinatario.

## 12. Eventi

`stato.eventi` contiene gli ultimi 200 eventi con `seq` crescente (`prossimoEvento`). Servono all'interfaccia per animare gli spostamenti (`agnellini` con `da`, `a`, `quanti`, `causa`) e al registro. Gli eventi non contengono informazioni segrete, tranne `pescate.carte`, filtrato da `vistaPer`.

## 13. Codici di errore

`partita_finita`, `fase_errata`, `non_tocca_a_te`, `carta_non_in_mano`, `carta_non_valida`, `scelta_non_valida`, `bersaglio_non_valido`, `voce_non_in_cima`, `pila_non_vuota`, `richiesta_in_corso`, `ripartizione_non_valida`, `esito_non_valido`, `giocatori_non_validi`, `azione_sconosciuta`. I test controllano soprattutto che venga lanciato `ErroreRegola`; il codice è indicativo.

## 14. Aiuti per i test (`engine/test/aiuti.ts`)

```ts
interface OpzioniScenario {
  giocatori?: number | Array<{ id?: IdGiocatore; nome?: string; pecora?: IdPecora }>; // predefinito 3; id 'g1','g2',…; pecore nell'ordine ricciolo, brontolana, sospirella, nerina
  seme?: number;                                           // predefinito 1
  mani?: Record<IdGiocatore, Array<IdTipoCarta | IdCarta>>; // predefinito: mano vuota
  mazzo?: Array<IdTipoCarta | IdCarta>;                    // cima per prima; predefinito: tutte le altre istanze del mazzo principale (per n giocatori) in ordine di catalogo
  mazzoGuai?: Array<IdTipoCarta | IdCarta>;                // cima per prima; predefinito: tutti gli altri Guai in ordine di catalogo
  guaio?: IdTipoCarta | IdCarta | null;                    // Guaio attivo del round; predefinito: il primo di mazzoGuai, tolto dal mazzo
  agnellini?: Record<IdGiocatore, number>;                 // predefinito 3
  gregge?: number;                                         // predefinito agnelliniTotali − somma degli agnellini
  angoli?: Record<IdGiocatore, Array<IdTipoCarta | IdCarta>>;
  eliminati?: IdGiocatore[];
  scarti?: Array<IdTipoCarta | IdCarta>;
  guaiFuoriGioco?: Array<IdTipoCarta | IdCarta>;
  round?: number;                                          // predefinito 1
  ultimoRound?: number | null;                             // predefinito null
  primoGiocatore?: IdGiocatore;                            // predefinito il primo
}
scenario(o?: OpzioniScenario): Stato     // fase 'guaio' del round, Guaio attivo già scoperto (o null)
```
Un id di tipo diventa l'istanza successiva non ancora usata nello scenario ("tipo#1", "tipo#2", …, anche oltre le copie del catalogo); un id di istanza si usa così com'è.

```ts
prosegui(s): Stato                                  // applica { tipo: 'prosegui' }
avanza(s): Stato                                    // prosegui finché inAttesaDi(s).sistema è vero
carta(s, giocatore, tipo): IdCarta                  // prima istanza di quel tipo nella mano (lancia se manca)
scegli(s, scelte: Record<IdGiocatore, Array<IdTipoCarta | IdCarta>>): Stato  // scegliTrovata per ciascuno (tipi risolti sulla mano)
nessunaReazione(s): Stato                           // scadenza finché c'è una finestra aperta
totale(s, giocatore): number                        // punteggioTotale
rinunciaTutti(s): Stato                             // in 'effetti' rinuncia a ogni voce finché si esce dalla fase
chiudiPunteggio(s): Stato                           // in 'belati_punteggio' con pila vuota: scadenza
conFaccia(s, idFaccia: string): Stato               // copia di s con un valore di rng tale che il prossimo lanciaDado dia quella faccia (id di setup.json)
```

## Decisioni sui casi ambigui

Prese seguendo lo spirito del brief e i regolamenti originali; tutte da confermare in revisione.

- **D1 Ordine delle fasi**: guaio → scelta → rivelazione → effetti → belati_punteggio → dado/risoluzione_dado (un ciclo per lanciatore) → guaio_al_peggiore → belato_finale (se serve) → belati_salvataggio → consolazione (con il controllo eliminazione alla fine) → fine_round → [ultimo_round] → round successivo. `consolazione` è una fase in più rispetto all'elenco del brief.
- **D2 Fasi automatiche**: aspettano `prosegui` per dare il ritmo all'interfaccia; l'host lo invia da solo dopo le animazioni.
- **D3 Beee-NO! "in qualsiasi momento"**: giocabile in qualunque fase, ma solo se la pila non è vuota (c'è qualcosa di appena dichiarato e non ancora applicato).
- **D4 Momento della finestra**: le scelte pubbliche (bersaglio di Campanaccio, ripartizione del furto, bersaglio della Testata) si dichiarano prima della finestra, così chi reagisce sa cosa succede; le scelte private (carta da scartare o da tenere) e il minigioco della Testata vengono dopo, se la voce non è annullata.
- **D5 Chi risponde**: tutti i non eliminati tranne l'autore della cima, anche chi non partecipa al round. L'autore di un'azione può annullare il Beee-NO! giocato contro di lui.
- **D6 Riapertura**: dopo che un Beee-NO! annulla un altro Beee-NO!, sulla voce tornata in cima si apre una finestra nuova.
- **D7 Bersaglio esplicito**: Beee-NO! indica l'id della cima; se nel frattempo la cima è cambiata viene rifiutato (gestisce i Beee-NO! quasi simultanei).
- **D8 Effetto annullato**: la Trovata conta comunque con il suo valore; il Belato annullato va negli scarti a fine round.
- **D9 Gemelle**: due Gemelle qualsiasi (non serve la coppia uguale). Le Gemelle del catalogo non hanno altri effetti.
- **D10 Ordine a parità di valore**: meno agnellini contati all'ingresso negli effetti, poi ordine casuale estratto una volta sola.
- **D11 Effetti facoltativi**: il proprietario attiva o rinuncia; gli effetti che non possono cambiare nulla vengono saltati in automatico (esito `saltato`, nessuna finestra), secondo la colonna "Attivabile se" della tabella 6.
- **D12 Ignora gli effetti**: si risolve per primo; se viene annullato gli altri effetti valgono; con due copie la prima nell'ordine ignora la seconda. Non tocca valori, tratti e Belati.
- **D13 Scambio**: si applica quando si risolve, sui totali correnti (anche quello della Trovata 5, nel gruppo "punteggio", prima della finestra dei Belati). Riga `scambio` nel riepilogo.
- **D14 Raddoppio**: non cumulabile, vale per tutti i Belati ±2 del round.
- **D15 Bersagli**: solo non eliminati; i Belati ±2 solo su chi ha un punteggio nel round.
- **D16 Scarta e somma**: si somma il valore stampato della carta scartata, senza effetti.
- **D17 Guarda le prime 2**: con una sola carta la si tiene; le carte guardate contano come pescate per l'ultimo round.
- **D18 Finestra dei Belati di punteggio**: libera; si chiude quando tutti i non eliminati hanno passato di seguito, o con `scadenza`. Saltata se i partecipanti sono meno di 2.
- **D19 Più lanciatori**: ordine fissato prima del primo lancio (meno agnellini, poi caso); ogni lancio ha la sua finestra; se un Ovile si riempie la partita finisce e gli altri non lanciano.
- **D20 Furto**: si ruba il massimo possibile (limitato ai posti liberi), prima dagli avversari, dal Gregge solo i mancanti; la ripartizione è libera se non è obbligata.
- **D21 Testata**: bersaglio tra gli avversari con almeno 1 agnellino; se non ce ne sono la faccia non ha effetto. L'esito si gioca dopo la finestra.
- **D22 Voci senza effetto**: un risultato del dado che non può fare nulla non apre la finestra.
- **D23 Un solo partecipante**: lancia il dado; il Guaio va in fondo. Nessun partecipante: niente dado, Guaio in fondo.
- **D24 Belato Finale**: dopo il dado; senza ripescata; il controllo "senza Trovate" vale a ogni ripetizione; una Gemella si può giocare da sola.
- **D25 Belato Finale e salvataggio**: il salvataggio viene dopo il Belato Finale, quando si sa chi prende il Guaio.
- **D26 Guaio deviato**: a un altro partecipante del round non eliminato, scelto da chi gioca il Belato; il ritorno al mittente è ammesso.
- **D27 Mazzo Guai finito**: un Guaio messo in fondo resta nel mazzo; quando il mazzo è vuoto si rimescolano i Guai fuori gioco (Angoli degli eliminati); se non ce ne sono il round si gioca senza Guaio (niente tratti, niente Belato Finale, niente Guaio al peggiore).
- **D28 Guai dell'eliminato**: escono dal gioco in `guaiFuoriGioco`.
- **D29 Tosatura**: ogni Tosatura completa una sola combinazione, come un Guaio di un tipo a scelta.
- **D30 Consolazione e vittoria**: l'agnellino di consolazione arriva prima del controllo eliminazione; se riempie l'Ovile, quel giocatore vince.
- **D31 Ultimo round**: scatta alla pescata dell'ultima carta, in qualunque momento; si completa il round in corso e se ne gioca uno in più.
- **D32 Ripescata con mazzo corto o vuoto**: si pesca quel che resta; con il mazzo vuoto non si scarta e si resta fuori dal round.
- **D33 Primo giocatore**: estratto a caso all'inizio, poi ruota a ogni round; apre ripescate e pescate.
- **D34 Chi resta fuori dal round**: non ha punteggio, non lancia, non prende né riceve Guai; può giocare Beee-NO! e Belati di punteggio sugli altri e subire furti e Testate.
- **D35 Priorità di vittoria**: Ovile pieno (immediato) prima di Ultima pecora prima di Mazzo finito; nel Mazzo finito contano solo i non eliminati.
- **D36 Variante a 2**: restano solo le Gemelle di valore 4; il Belato Finale non può capitare (una parità al minimo è "tutti pari").
- **D37 Garzina**: non è una pecora ma il Belato "Visita di Garzina" (2 copie): si gioca nella consolazione, prima del controllo eliminazione; toglie un Guaio a scelta dal proprio Angolo e lo mette in fondo al mazzo Guai; annullabile con Beee-NO!.
- **D38 Carte d'esempio del design**: valgono nomi e illustrazioni, ma i testi seguono gli effetti del brief (Finta svenuta devia a scelta; Campanaccio stonato = sposta 1 agnellino; Ombrello bucato e Sasso comodo senza effetto; Belato di gruppo = +2).
- **D39 Gregge vuoto**: per consolazione e "prendi 1 agnellino" si prende quel che c'è.
- **D40 Cambio di scelta**: nella scelta segreta e nel Belato Finale si può cambiare carta finché non hanno scelto tutti.

- **D41 Belato Finale nell'ultimo round**: la riga dei Casi limite ("senza Trovate nell'ultimo round non gioca") riguarda chi non ha Trovate al momento della scelta. Un partecipante che ha giocato la sua ultima Trovata e finisce pari al minimo è nel Belato Finale: se non ha Trovate prende il Guaio, come dice la regola delle Parità.
- **D42 Partita che resta con 2 pecore**: le regole decise all'inizio (Ovile, mazzo, soglie di eliminazione) restano quelle della partita a 3 o 4; la variante a 2 vale solo per le partite iniziate in 2.
- **D43 Esito casuale della Testata (simulatore e bot)**: si estrae con le probabilità di `setup.json` (0: 20%, 1: 40%, 2: 30%, 3: 10%) e si tronca agli agnellini del bersaglio: esito = min(estratto, agnellini).
- **D44 Evento `ha_scelto`**: arriva solo alla prima scelta del giocatore; i cambi di carta (D40) non sono visibili agli altri.
- **D45 Bilanciamento (fase 2, approvato dall'utente)**: con i numeri del brief l'Ovile pieno vinceva l'81–94% delle partite a 2 e 3 giocatori e a 3–4 giocatori le partite duravano circa 6 round. In `setup.json`: Ovile da 18 posti con 36 agnellini a 2 giocatori, da 15 con 45 a 3 giocatori, invariato (12 e 44) a 4; sul dado una seconda Testata prende il posto di uno dei due Pascoli piccoli. Dati e confronto in `docs/rapporto-simulatore.md` e `docs/rapporto-simulatore-brief-originale.md`.

## Note di implementazione

- **Id dei giocatori (§3.1)**: oltre a "id unici", `nuovaPartita` rifiuta con `giocatori_non_validi` gli id vuoti e quelli che coincidono con una proprietà di `Object.prototype` (`__proto__`, `constructor`, `toString`, `hasOwnProperty`…). Lo stato indicizza per id oggetti semplici (`giocate`, `punteggi`, `scelte`, ripartizione del furto), dove quei nomi non sono chiavi sicure: `__proto__` non crea una chiave propria e si perde in `structuredClone`.
- **Elenco dei giocatori**: la validazione legge ogni posizione, anche i buchi di un array sparso; una voce mancante dà `giocatori_non_validi`.
- **Ricerche per nome**: catalogo (carte e pecore), `scelte` e `punteggi` si leggono solo per chiave propria. Un tipo come `constructor` non è una carta (`defCarta` lancia, `cartaEsiste` è falso) né una pecora valida; per un id estraneo, anche `toString`, `punteggioTotale` vale 0 e `miaScelta` è `null`.
- **Dati congelati**: `CATALOGO` e `SETUP` sono congelati in profondità al caricamento; `configPer` restituisce copie. Il motore rilegge valori ed effetti delle carte dal catalogo durante la partita: una partita salvata va ripresa con gli stessi file dati.
