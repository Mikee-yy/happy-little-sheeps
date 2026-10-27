# Schermata delle Regole: progetto (da approvare)

Stato: bozza di progetto, nessun piano e nessun codice finché non è approvata.

## Scopo
Chi non ha mai visto il gioco deve capire in 3-4 minuti come si gioca, guardando le carte vere, senza leggere un muro di testo. Oggi la schermata è un elenco di punti uguali (`REGOLE` in `testi.ts`, mostrata da `Regole` in `schermate.tsx`) e viene sostituita per intero.

## Da dove si apre
- Home, pulsante "Regole" (come oggi).
- Menu della partita ("Regole" nel cassetto), con la partita ferma e ritorno al punto in cui si era.
- Dalla partita di prova (stesso menu).
- Il link "Regole" in fondo alla preparazione resta.

## Aspetto sul telefono (375 px)
Una colonna sola, margini 16 px. Titolo "Regole" e sotto otto titoli numerati a fisarmonica: tocco sul titolo apre/chiude. Si apre la sezione 1 per default; le altre sono chiuse, se ne possono aprire più insieme. Le figure stanno accanto al testo (carta piccola a sinistra, 90 px, spiegazione a destra) o sopra, in fila scorrevole, se sono più di due. Pulsante "Indietro" fisso in fondo.

## Le otto sezioni (testi in bozza, figure per id)

1. **Lo scopo.** "Vince chi riempie per primo il proprio Ovile di agnellini (18 posti in 2, 15 in 3, 12 in 4 giocatori). Vince anche l'ultima pecora rimasta in gioco. Se il mazzo finisce, si gioca un ultimo round e vince chi ha più agnellini; a parità, chi ha meno Guai." Figure: `agnellino.svg`, `montone.svg`, le quattro pecore (`ricciolo`, `brontolana`, `sospirella`, `nerina`) con il loro tratto (+1/−1).

2. **Un round in 5 passi.** Cinque righe illustrate: (1) Si scopre un Guaio. (2) Tutti giocano coperta una Trovata. (3) Si scoprono: valore + tratto della pecora + effetti + Belati = punteggio. (4) Il punteggio più alto lancia il Dado del Pastore. (5) Il più basso prende il Guaio, riceve 1 agnellino di consolazione e può scartare una carta; poi tutti ripescano fino a 5. Figure: un Guaio (`fulmine-curioso`), una Trovata (`carriola`), `dado-3d.svg`.

3. **Le carte.** Tre blocchi.
   - Trovate: valore da 0 a 9, a volte con un effetto. Esempi con effetto: `fischietto-da-richiamo` (valore 2, prendi 1 agnellino), `cannocchiale` (7, guarda 2 carte). Senza effetto, con la scritta "Nessun effetto": `carriola` (8), `balla-di-fieno` (5). Gemelle: `calzino-gemello` e `pantofola-gemella`, si giocano in coppia e i valori si sommano.
   - Belati: si giocano fuori turno, quando lo dice la carta. Esempi: `belato-di-gruppo` (+2), `pernacchia` (−2), `visita-di-garzina`.
   - Guai: quattro tipi, `grandine-a-sorpresa` (Meteo), `volpe-gentile` (Predatori), `crisi-esistenziale` (Drammi), `tosatura-a-sorpresa` (Tosatura).

4. **Il dado.** "Sei facce: quattro numeri e due Testate." Pascolo 3 o 5: prendi agnellini dal Gregge. Furto 2 o 4: li rubi agli altri, divisi come vuoi. Testata del Montone (2 facce su 6): scegli un avversario, tira indietro il Montone come una fionda e lascialo andare. Cerchi del bersaglio: centro 3 agnellini, anello di mezzo 2, bordo del recinto 1, fuori 0; mai più di quanti ne ha. Gli agnellini oltre l'ultimo posto libero non si prendono. Figure: le 5 facce (`faccia-pascolo-3`, `-5`, `faccia-furto-2`, `-4`, `faccia-testata`) e un disegno dei tre anelli (da fare con i colori della guida di stile).

5. **Guai ed eliminazione.** I tipi sono 4 (Meteo, Predatori, Drammi, Tosatura). Ogni pecora ha un tratto: +1 al punteggio con i Guai del tipo che ama, −1 con quelli del tipo che teme (es. Ricciolo +1 Meteo, −1 Predatori). Sei eliminata con 3 Guai uguali o 4 diversi; in due giocatori con 4 uguali o 4 diversi. La Tosatura a Sorpresa è jolly: vale come il tipo che ti manca, una sola combinazione per carta. Chi esce lascia la mano e restituisce gli agnellini al Gregge. Figure: icone dei 4 tipi, `ricciolo.svg`, tre Guai uguali accanto a quattro diversi.

6. **Il Beee-NO!** "Annulla l'effetto di una Trovata, di un Belato o del dado appena dichiarato. Anche un altro Beee-NO!" Esempio: Ada usa Beee-NO! contro la Testata di Bea; Bea risponde con un altro Beee-NO!; la Testata torna valida. Figure: `beee-no` ×2 accanto a `faccia-testata`. Finestra di reazione di 6 secondi.

7. **Come finisce.** Quattro modi: Ovile pieno (vince subito, anche con l'agnellino di consolazione); ultima pecora; mazzo finito (ultimo round in più, poi più agnellini, poi meno Guai). Parità: al primo posto del round lanciano tutti, ordine a caso (D10); all'ultimo, Belato Finale: una Trovata coperta, conta solo il valore stampato; tutti pari: il Guaio torna in fondo e nessuno lancia.

8. **Tre esempi.** (a) Round da 3 giocatori con punteggi 7, 7, 4: i due alti lanciano in ordine a caso, la più bassa prende il Guaio. (b) Eliminazione: Nerina ha Meteo, Meteo e Tosatura: la Tosatura vale come Meteo, 3 uguali, fuori. (c) Beee-NO! contro Beee-NO! (vedi 6). Ogni esempio con 2-3 carte disegnate.

## Accessibilità
Ogni titolo è un vero pulsante con intestazione (h2), stato aperto/chiuso annunciato, Invio e Spazio per aprire, Tab per spostarsi. Ogni carta ha un testo alternativo: nome, valore, effetto (lo stesso dell'altra interfaccia), senza ripetere il disegno. Con "riduci movimento" le carte restano ferme (`cartaSVG(id, false)`); senza, nelle Regole le carte stanno comunque ferme: l'animazione serve nella partita, qui no. Contrasto e dimensione del testo come in partita.

## Cosa resta in `testi.ts`
Tutti i testi: titoli, paragrafi, esempi, testi alternativi. `REGOLE` diventa una struttura con titolo, paragrafi e elenco di figure (id carta o file). I numeri (18/15/12, 3/4 uguali/diversi, anelli 3/2/1) sono letti dai file dati, non scritti a mano, dove possibile.

## Domande per te
1. Le carte nelle Regole sono sempre ferme, va bene (consigliato), o vuoi una carta animata per sezione?
2. Per Belato Finale e parità, bastano due righe in fondo alla sezione 7 o serve una sezione propria?
3. Va bene una sola sezione aperta alla volta, o lasciare aprirne più insieme (consigliato)?
4. Gli esempi usano nomi fissi (Ada, Bea) o i nomi dei giocatori in partita?

## Risposte dell'utente (26 ottobre 2026)

1. **Carte nelle regole:** si muovono (animate come in primo piano; ferme solo con "Riduci movimento").
2. **Belato Finale e parità:** nella sezione "Come finisce la partita".
3. **Sezioni:** se ne possono aprire più insieme.
4. **Nomi negli esempi:** i nomi dei giocatori della partita in corso. Quando le regole si aprono fuori da una partita (dalla Home) non ci sono giocatori: lì si usano nomi di esempio.
