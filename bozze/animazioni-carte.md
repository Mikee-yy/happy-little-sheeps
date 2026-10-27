# Animazioni delle illustrazioni delle carte

*Decise con l'utente il 21 ottobre 2026.*

**Quando:** le carte si muovono solo **in primo piano** (carte grandi, come già il meteo) e, una volta sola, **quando vengono pescate**; in mano restano ferme. Movimenti piccoli e ripetuti; con "Riduci movimento" fermi come le altre animazioni della scena.

Le carte del pacchetto grafico (Sasso comodo, Calzino, Campanaccio, Ombrello, Beee-NO!, Belato di gruppo, Finta svenuta, Grandine, Lupo vegetariano) e il meteo disegnato in codice hanno già i loro movimenti.

## Trovate (in prova, da vedere dal vivo)

| Carta | Movimento |
|---|---|
| Scorta nel vello | la carta nascosta spunta dal ciuffo e ci rientra |
| Agnellino smarrito | l'agnellino gira la testa, il punto di domanda dondola |
| Ciliegie appaiate | dondolano dal picciolo |
| Fischietto da richiamo | le note salgono e svaniscono, le onde pulsano |
| Pantofola gemella | il pon pon fa un saltello |
| Pulizie di primavera | la scopa spazza, la polvere si solleva |
| Orecchino gemello | dondola, il luccichio brilla |
| Trifoglio qualunque | la lente cerca sul prato |
| Capriola | la pecorella fa il giro lungo la freccia |
| Balla di fieno | gli occhietti sbattono |
| Megafono di latta | le onde escono a ondate |
| Coperta di lana | il ciuffo in cima "respira" |
| Cannocchiale | la stellina brilla |
| Carriola | la ruota gira, la carriola sobbalza |
| Tappi per le orecchie | la pecora dondola beata, le onde pulsano |
| Corona di margherite | le margherite girano piano |

## Belati (approvati come base)

| Belato | Movimento |
|---|---|
| Pernacchia | lo sbuffo esce a ondate, la codina scodinzola |
| Mondo alla rovescia | la pecora a testa in giù dondola, la nuvoletta passa sotto |
| Faccio finta di niente | le note salgono, la carta del Guaio scivola sotto il mazzo e ricomincia |
| Visita di Garzina | lo specchietto luccica, il cerotto ondeggia, la stellina brilla; a intervalli fa l'occhiolino con un luccichio accanto |

## Guai (approvati come base)

| Guaio | Movimento |
|---|---|
| Volpe gentile | strizza l'occhio, la chiave dondola |
| Aquila con il taccuino | batte le ali piano, la matita scrive |
| Occhi nel cespuglio | i quattro occhi sbattono, sfasati |
| Lupo travestito | la maschera trema, la coda scodinzola |
| Invito nel bosco | la fiamma tremola, la zampa fa "vieni, vieni" |
| Faina con la lista | la zampa segna la lista, la coda ondeggia |
| Figuraccia al pascolo | la nota rotta vola via, il sudore cade |
| Specchio impietoso | il riflesso trema, le goccioline cadono |
| Crisi esistenziale | pensierosa con lo zoccolo sotto il mento, che batte piano a intervalli; i punti di domanda pulsano a turno, il filo d'erba ondeggia |
| Gregge senza di te | una lacrimuccia si forma sotto l'occhio e scivola giù; il punto di domanda dondola, il gregge lontano si muove appena |
| Compleanno dimenticato | la torta si scioglie: la glassa cola piano e la torta si affloscia un poco; il fumo sale, un coriandolo cade |
| Insonnia | le pecorelle saltano lo steccato una dopo l'altra; a intervalli la pecora a letto alza gli occhi al cielo |
| Inciampo al ruscello | le zampe si agitano, gli spruzzi saltano, l'acqua si increspa; il montone sulla riva sorride e a intervalli ridacchia (sorriso più largo, occhi socchiusi, due saltelli della testa) |
| Tosatura a sorpresa | la pecora trema, il rasoio elettrico ronza e passa avanti e indietro sulla lana, i ciuffi cadono (al posto delle forbici che scappano) |
| Spuntatina | le forbici fanno "zac zac", i ciuffi cadono |
| Rasatura integrale | il tratteggio pulsa, la pecora si stringe dal freddo |

## Movimento una volta sola alla pesca (fatto il 26 ottobre)

- In mano le carte sono ferme; la carta **appena pescata** fa il suo movimento una volta e poi si ferma. Sollevata (in primo piano) si muove senza fine, come prima.
- Come funziona (`client/src/scena/mano.ts`): una carta è "pescata" se entra in un ventaglio **già scoperto**. Restano ferme la prima mano mostrata, la mano appena scoperta (dopo i dorsi del "Passa il telefono"), le carte arrivate con la scheda nascosta (ritorno da un'altra scheda), quelle date con `mostra(carte, dorsi, { ferme: true })` e tutto con "Riduci movimento".
- La carta pescata prende il disegno animato (`cartaSVG(id, true)`, classe `anima`, vale anche per le parti animate dello sprite) e la classe `una-volta`: in `carte/animazioni.css` la regola `.teatro .cm.una-volta .anima .an { animation-iteration-count: 1; }` fa fare a ogni parte un giro solo. A ogni `animationend` la mano chiede al browser se qualche parte gira ancora; quando nessuna gira (o al più tardi dopo 15 s, `UNA_VOLTA_MAX_MS`) torna il disegno fermo. Si muove solo la carta nuova.
- Fatto (26 ottobre): in `teatro.ts` la ricostruzione (`mostraMano(f, true)`) e la recita con `{ subito: true }` dovrebbero passare `{ ferme: true }` alla mano; oggi la ricostruzione "subito" con carte nuove nel ventaglio scoperto le farebbe muovere una volta (caso raro: tra un giocatore e l'altro la mano è coperta).

## Stato al 21 ottobre sera

- Trovate: animate e **approvate** dall'utente (comprese le modifiche: sudore dell'agnellino, fischietto che soffia, pecorella che sparisce nella balla con i fili di fieno, pecora sotto la coperta, tappi senza zampe).
- Belati e Guai: animati (prova in `.superpowers/confronti/belati-guai-animate.html`, generata da `.superpowers/confronti/genera-animate.ts`). L'utente ha chiesto 7 modifiche; il lavoro è stato **fermato a metà** (prove delle carte e typecheck verdi, ma non si sa quali delle 7 siano già fatte): alla ripresa controllare la pagina e completare:
  1. Visita di Garzina: occhiolino con luccichio, a intervalli.
  2. Crisi esistenziale: la pecora si tocca il muso con la zampa, pensierosa (animato).
  3. Gregge senza di te: lacrimuccia di tristezza animata.
  4. Compleanno dimenticato: la torta si scioglie (glassa che cola).
  5. Insonnia: la pecora a letto alza gli occhi al cielo (eye roll), a intervalli.
  6. Inciampo al ruscello: il montone sulla riva sorride, animato.
  7. Tosatura a sorpresa: rasoio elettrico che passa sulla pecora con i ciuffi che cadono (al posto delle forbici che scappano), come la Spuntatina.
- **Ripresa (26 ottobre):** al controllo nessuna delle 7 risultava fatta; ora sono **fatte tutte e 7** (da vedere con l'utente nella pagina di prova): occhiolino con luccichio (1), zampa al mento che batte piano (2), lacrimuccia che scivola (3), glassa che cola e torta che si affloscia (4), occhi al cielo (5), montone che ridacchia (6), rasoio elettrico con i ciuffi che cadono (7). Classi nuove in `client/src/scena/carte/animazioni.css`; tolta `an-scappa`.
- La pagina animata si vede nel pannello del browser dell'app (il riquadro dei file mostra le pagine ferme).
- Il movimento una volta sola alla pesca: fatto il 26 ottobre (sezione sopra).

**Completato (26 ottobre, con prove in `teatro.test.ts`):** in `client/src/scena/teatro.ts` passare `{ ferme: true }` a `mano.mostra` nella ricostruzione (`mostraMano`, ramo `subito || f.mano === null`) e far contare come "subito" anche `recita(…, { subito: true })` (ritorno da un'altra scheda), così le carte non si muovono quando la mano si rimette in pari. Rimandato perché teatro.ts era occupato dal giro della fionda; poi una revisione insieme al giro completo prima di pubblicare.
