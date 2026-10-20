# Scena nel gioco, pezzo 2: la regia — progetto (15 ottobre 2026)

Progetto approvato a voce, parte per parte, nella chat del 15 ottobre. Questo file lo mette per iscritto. È il secondo dei quattro pezzi del punto 3 (vedi `bozze/scena-gioco-1-progetto.md` per la divisione e le scelte comuni).

## Lo scopo

Ciò che succede nella partita si vede recitato nella scena invece di leggerlo nella cronaca:
- il dado rotola;
- gli agnellini corrono o volano;
- il Guaio arriva con il suo meteo o il Lupo;
- il Beee-NO! esplode;
- le carte si girano alla rivelazione;
- alla fine c'è la festa.

Le regole sono già applicate dal motore: la scena le racconta. Dopo ogni racconto la scena si rimette in pari con la partita, come nel pezzo 1.

**Criterio di riuscita:**
- in una partita a 2, 3 e 4 giocatori e nella prova, ogni momento della tabella del § 1 si vede recitato;
- il pannello della mossa successiva e la schermata "Passa il dispositivo" compaiono solo quando la scena ha finito di recitare, o dopo i primi 5 secondi di un meteo, o subito dopo un tocco sul prato;
- a fine animazioni gli agnellini in scena coincidono sempre con la partita (prova del "conto giusto" con la regia accesa);
- chi torna da un'altra scheda vede subito lo stato attuale.

**Fuori dal pezzo 2:**
- scelte fatte con i gesti nella scena (pezzo 3);
- stanze con più telefoni (pezzo 4).

## Decisioni dell'utente (15 ottobre)

- **I meteo hanno sempre la durata piena della bozza** (nebbia circa 18 s, pioggia circa 14 s).
- **I primi 5 secondi di un meteo la partita aspetta.** Poi il pannello successivo compare e si gioca, mentre il meteo continua sullo sfondo fino alla fine. Se il meteo è più corto di 5 secondi, si aspetta solo fino alla sua fine. Vale anche per il Lupo.
- **Lo zoom sull'avversario colpito torna indietro allo scadere dei 5 secondi:** si sceglie vedendo tutto il tavolo, e il meteo continua sulla sua postazione vista da lontano.
- **Un tocco sul prato salta:** l'animazione in corso corre veloce fino alla fine e il pannello compare subito. Resta l'opzione "Animazioni veloci".
- **Fine partita:** prima qualche secondo di festa nella scena (si salta con un tocco), poi la schermata di oggi con la classifica, "Rigioca" e "Torna alla home".
- **Per il pezzo 4:** nelle stanze il conto alla rovescia del Beee-NO! resta fermo mentre la scena recita.

---

## 1. Cosa si vede

| Momento (evento del motore) | In scena |
|---|---|
| Inizio round (`round_iniziato`) e Guaio del round (`guaio_rivelato`) | La carta del Guaio arriva sulla tovaglia e si gira. All'ultimo round (`ultimo_round_annunciato`, o `round_iniziato` con `ultimo`) compare per un momento la scritta "Ultimo round!". |
| Scelta (`ha_scelto`) | Davanti a chi ha scelto compare la carta coperta (come oggi, con calma). |
| Rivelazione (`rivelazione`, poi le righe `punteggio`) | Le carte coperte si girano una dopo l'altra. Poi sopra ogni pecora compare un fumetto con il suo punteggio del round. |
| Trovata con effetto, Belato, Beee-NO! dichiarati (`dichiarazione`) | La carta vola dalla postazione di chi la gioca al centro della tovaglia, con un fumetto breve (per esempio "+2 a Bea", "Beee-NO!"). |
| Annullamento (`annullata`) | Esplosione "BEEE-NO!" e la carta annullata si scuote. |
| Effetto risolto (`effetto`, `risolta`) e Belati di punteggio (`punteggio` con Belato) | Fumetto con il risultato sopra la pecora toccata (per esempio "+2", "−2"). La carta va negli scarti con calma. |
| Dado (`dado_lanciato`) | Il dado rotola e si ferma sulla faccia uscita. |
| Pascolo (`agnellini` dal gregge, causa `pascolo`) | Gli agnellini corrono dal gregge al recinto. |
| Furto (`agnellini` causa `furto`) | Il ladro salta, gli agnellini corrono verso di lui, la vittima si scuote. |
| Testata (`testata` e il suo `agnellini`) | Il montone carica e gli agnellini volano nel gregge. |
| Belato Finale (`belato_finale`) | Le carte dei giocatori coinvolti si girano. |
| Guaio preso (`guaio_preso`) | La carta vola nell'angolo di chi la prende, con il suo meteo o il Lupo e lo zoom se è un avversario (regola dei 5 secondi). Poi l'agnellino di consolazione arriva dal gregge. |
| Guaio deviato (`guaio_deviato`) | Chi lo devia fa la finta svenuta, poi il Guaio va all'altra pecora come sopra. |
| Guaio curato (`guaio_curato`) | Fumetto di sollievo; la carta lascia l'angolo con calma. |
| Eliminazione (`eliminato`) | La pecora sviene, i suoi agnellini tornano al gregge, la targa diventa "eliminata". |
| Fine partita (`fine_partita`) | Festa: la vincitrice salta, i suoi agnellini saltano, coriandoli, fanfara se i suoni sono accesi. Poi la schermata con la classifica. |
| Carte pescate o scartate, ripescata, Guaio in fondo, Guai rimescolati, fuori dal round | Nessuna animazione propria: la scena si mette in pari con calma, come oggi. |

**Le scritte nuove** (fumetti, "Ultimo round!") vanno in `client/src/testi.ts`.

**Il ritmo:**
- mentre la scena recita, il pannello successivo aspetta;
- aspetta anche la schermata "Passa il dispositivo", così chi ha giocato vede l'effetto della sua mossa prima di passare il telefono. In quei secondi la mano resta coperta, come per ogni passaggio;
- un tocco sul prato salta;
- "Animazioni veloci" fa andare tutto al doppio;
- nella prova le mosse dei bot si recitano allo stesso modo, una dopo l'altra: i bot aspettano che la scena abbia finito prima di muovere di nuovo;
- chi torna da un'altra scheda, o apre una partita salvata, vede direttamente lo stato attuale, senza rivedere niente.

---

## 2. Come è costruito

### 2.1 Il copione (`client/src/scena/regia/copione.ts`, puro)

Il copione è una funzione pura. Riceve:
- gli eventi nuovi della partita, cioè quelli con `seq` maggiore dell'ultimo già recitato;
- la fotografia di prima e quella di dopo.

Restituisce la lista ordinata delle **battute**. Ogni battuta dice:
- quale ordine del teatro eseguire, con i suoi dati (chi, carta, quanti agnellini, da dove a dove…);
- **quanto fa aspettare la partita:**
  - `fine`: fino alla fine dell'animazione;
  - `massimo 5000 ms`: per i Guai con meteo o Lupo;
  - `niente`: per le cose che si possono fare mentre si gioca.

Regole del copione:
- **Eventi che vanno insieme diventano una battuta sola.** Per esempio `testata` e il suo `agnellini`, il furto da più avversari, le righe `punteggio` della rivelazione.
- **Eventi che bastano mettere in pari** non producono battute.
- **I testi dei fumetti** si costruiscono con `T` e con le descrizioni che il gioco già usa (`client/src/partita/descrizioni.ts`).

### 2.2 Il regista (`client/src/scena/regia/regista.ts`)

Il regista vive accanto al teatro e recita le battute una dopo l'altra, usando gli ordini del pezzo 1 più quelli nuovi del § 2.4.
- **Battuta che aspetta "fine":** il regista attende la fine dell'animazione prima di passare alla successiva.
- **Battuta di meteo:**
  - allo scadere dei 5 secondi la camera torna indietro;
  - il regista smette di far aspettare la partita e passa alle battute seguenti;
  - il meteo prosegue sullo sfondo fino alla fine;
  - un meteo nuovo sostituisce quello in corso, come già oggi.
- **Finite le battute** il teatro si mette in pari con la fotografia più recente (`allinea` con calma). La verità resta il motore.
- **Il regista dice quando è "occupato"**, cioè quando una battuta fa ancora aspettare la partita, con un ascoltatore, così React può aspettare.
- **Nuove mosse mentre recita:** le battute si accodano.
- **Tempo massimo per ogni battuta:** 25 secondi di tempo vero (non della scena, che si ferma quando il browser non disegna). Se una battuta non finisce, si passa oltre e alla fine ci si rimette in pari.
- **Troppe cose da recitare** (più di 8 battute in coda, o ritorno da un'altra scheda): niente recita, la scena si mette in pari subito (`allinea` "subito").
- **La prima fotografia** (partita nuova o ripresa) si mostra subito, senza recitare gli eventi passati.
- **Salto:**
  - un tocco sul prato porta la battuta in corso alla fine a velocità 6, come nella bozza;
  - le battute già in coda si recitano poi a velocità normale;
  - un tocco quando la scena sta solo facendo il meteo sullo sfondo lo chiude.

### 2.3 Il collegamento con il gioco

- **`Scena.tsx`** passa al teatro, a ogni aggiornamento, la fotografia e gli eventi nuovi. Avvisa `Partita` quando il regista diventa occupato o libero (`onOccupato`).
- **`Partita.tsx`:**
  - finché la scena è occupata non mostra il cassetto dei pannelli né "Passa il dispositivo";
  - mostra la scena e la striscia in alto come sempre;
  - alla fine della partita mostra la schermata della classifica solo dopo la festa.
- **Nella prova** `SessioneProva` riceve una pausa (`pausa(occupata)`): i bot non muovono mentre la scena recita. La pausa vale solo per la prova.
- **Le stanze non cambiano** fino al pezzo 4.

### 2.4 Animazioni da aggiungere al teatro

Si prendono dalla bozza dove ci sono (`bozze/scena/scena.src.html`):
- **`giraCarte(chi, carte)`:** la carta coperta sullo sterrato o davanti a chi sta in basso si gira;
- **`punteggio(chi, testo)`:** il fumetto del punteggio, che riusa `fumetto`;
- **`volaCarta(daChi, carta)`:** la carta vola dalla postazione al centro della tovaglia e poi agli scarti (riprende `gioca` della bozza, senza le regole finte);
- **`annuncio(testo)`:** la scritta "Ultimo round!";
- **`eliminata(chi)`:** la posa svenuta e la targa;
- **`festa(chi)`:** dalla `vittoria` della bozza, senza il riquadro finale della bozza;
- **`guaioRivelato(carta)`:** la carta del Guaio del round arriva sulla tovaglia e si gira;
- **meteo con camera di ritorno anticipato:** `guaio` riceve un'opzione per tornare indietro con la camera dopo 5 secondi lasciando proseguire il meteo.

### 2.5 Velocità e salto

Restano quelli del pezzo 1: velocità 1, 2 con "Animazioni veloci", 6 durante il salto. Valgono solo su questo dispositivo.

---

## 3. Prove

**Prove automatiche (Vitest):**
- **Copione** (puro), per ogni riga della tabella del § 1:
  - le battute giuste, nell'ordine giusto;
  - le attese giuste ("fine", 5 s, "niente");
  - eventi da mettere solo in pari → nessuna battuta;
  - eventi insieme → una battuta;
  - testi dei fumetti presi da `T`.
- **Regista** (teatro in jsdom con il ciclo manuale):
  - una battuta "fine" tiene occupato fino alla fine;
  - un meteo tiene occupato 5 secondi, poi libera, la camera torna a zoom 1 e il meteo continua;
  - un tocco salta;
  - con "Animazioni veloci" i tempi si dimezzano;
  - una battuta che non finisce viene chiusa dopo 25 secondi;
  - oltre 8 battute in coda e ritorno da un'altra scheda → messa in pari "subito";
  - alla fine la scena coincide con la fotografia.
- **Conto giusto con la regia accesa:** le partite simulate del pezzo 1 rifatte passando gli eventi al regista. A fine animazioni gli agnellini coincidono con la partita, recinto per recinto.
- **Gioco** (`App.test.tsx`, con il teatro finto che può dirsi occupato):
  - il cassetto e "Passa il dispositivo" non compaiono mentre la scena è occupata e compaiono quando si libera;
  - la mano resta coperta durante l'attesa del passaggio;
  - la classifica compare dopo la festa.
- **Prova:** i bot non muovono finché la scena è occupata.

**Prove nel browser** (gioco in anteprima, 390×844, pilota automatico come nel pezzo 1):
- partite intere a 2, 3 e 4 giocatori e la partita di prova, guardando a occhio dado, furto, Testata, Guai con meteo, Beee-NO!, rivelazione, eliminazione e festa;
- un meteo su un avversario: zoom, ritorno a 5 secondi, pannello che compare mentre il meteo continua;
- le 72 prove del meteo della pagina di sviluppo ancora verdi.

**Revisione finale** da un revisore separato, poi stop di fase.

---

## Rischi

- **Partite più lunghe:** i meteo pieni allungano il gioco. La regola dei 5 secondi e il tocco per saltare servono a questo; si giudica giocando.
- **Telefoni lenti:** più animazioni insieme (meteo sullo sfondo mentre gli agnellini corrono). Il modo leggero del pezzo 1 resta la rete.
- **Accavallamenti:** una mossa che arriva mentre il meteo è ancora sullo sfondo (per esempio un altro Guaio nello stesso round, raro). Il meteo nuovo sostituisce il vecchio; le prove del regista lo coprono.
- **Finestra coperta sul PC:** con la finestra dietro le altre il browser non disegna, e le animazioni (e quindi l'attesa del pannello) si fermano finché non torna visibile. È un comportamento del browser; il tempo massimo per battuta è misurato in tempo vero, quindi dopo al più 25 secondi il pannello compare comunque e la scena si rimette in pari quando torna visibile.
