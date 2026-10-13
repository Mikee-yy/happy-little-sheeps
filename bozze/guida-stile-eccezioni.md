# Guida di stile: eccezioni per la scena di gioco (bozza da approvare)

La guida di stile in `design/guida-stile.md` è stata scritta per le **carte**: oggetti piatti, senza luce né ambiente. La scena di gioco (il prato in 2,5D) ha bisogno di alcune regole in più. Qui sotto c'è ogni punto in cui la bozza si allontana dalla guida, con il motivo. Le carte restano sotto la guida originale, senza eccezioni.

Quando le approvi, queste regole si aggiungono a `design/guida-stile.md` in una sezione "Scena di gioco".

## 1. Ombre che seguono il sole

**La guida dice:** ombra a terra solo sotto i personaggi, ellisse Notte al 15%. Nessun'altra ombra.

**Nella scena:**
- Pecore, agnellini e staccionate proiettano la loro **sagoma** a terra, dalla parte opposta al sole. Le ombre si allungano verso sera.
- Il colore resta quello della guida (Notte trasparente), sempre a tinta unita e con bordi netti, mai sfocato.
- Le carte sulla tovaglia hanno una piccola ombra netta sotto, che serve a staccarle dalla tovaglia.

**Perché:** il sole che si muove nel cielo è il segnale che la partita va verso sera ("prima del buio"). Ombre ferme a ellisse lo contraddirebbero.

## 2. Luce del sole

**La guida dice:** niente luci.

**Nella scena:** il sole ha raggi animati, e le nuvole che gli passano davanti abbassano un poco la luce del prato. È solo un cambio di tinta su tutta la scena, senza riflessi o puntini di luce sui personaggi.

## 3. Colori nuovi, solo per l'ambiente

Sono tutti miscele dei colori della palette, tranne il rosso della tovaglia:

| Nome | Dove | Come è fatto |
|---|---|---|
| Rosso tovaglia | quadri della tovaglia da picnic | rosso caldo semitrasparente sul Gesso |
| Sabbia | sterrato davanti agli avversari | Limone 48% + Fango |
| Pavimento | fondo dei recinti | Fango 42% + Prato |
| Collina, erba | colline e ciuffi | Prato mescolato con Nebbia o Notte |
| Cielo e prato per ora del giorno | giorno, pomeriggio, tramonto, sera | Celeste, Lilla e Albicocca, scuriti con Notte verso sera |

**Il rosso della tovaglia non è il Vermiglio di pericolo.** È un tono diverso e semitrasparente, e non compare mai sulle carte né nell'interfaccia. Il Vermiglio resta riservato agli avvisi.

**Perché:** la tovaglia a quadri rossi e bianchi è una tua scelta, ed è il "tavolo" del gioco. Le altre tinte servono a far stare insieme cielo e prato con la palette.

## 4. Più di 3 pastelli nella scena

**La guida dice:** massimo 3 pastelli per carta.

**Nella scena:** il prato intero ne usa di più (cielo, prato, sabbia, pecore di colori diversi). La regola dei 3 pastelli continua a valere per ogni carta e per ogni singolo oggetto: una pozza, una nuvola, una staccionata.

## 5. Effetti del meteo

**La guida dice:** niente sfumature, texture o trasparenze sfocate.

**Nella scena:**
- **Nebbia:** banchi di nuvola chiari e semitrasparenti che attraversano lo schermo. Sono fatti con cerchi a tinta unita, come le nuvole della guida, non con una sfumatura.
- **Temporale:** il cielo si scurisce per qualche secondo.
- **Gelata:** un velo celeste leggero su tutto il prato, più brina e ghiaccioli disegnati con il tratto Notte.
- **Pozze:** ellissi Celeste con il contorno Notte, più il mulinello a spirale.
- **Fulmine:** saetta Limone con il contorno Notte, lampo bianco di un attimo, fumo grigio chiaro.
- **Fuliggine:** il personaggio colpito si scurisce per qualche secondo (bruciacchiato).

**Perché:** sono momenti brevi, legati a un Guaio, e spariscono da soli. Usano sempre forme piene e il tratto unico.

## 6. Tratto più sottile per le cose lontane

**La guida dice:** contorni dello stesso spessore in tutta la scena.

**Nella scena:** le postazioni degli avversari sono più piccole perché sono lontane, quindi il loro tratto è più sottile in proporzione. Lo zoom le riporta alla grandezza della tua, con lo stesso tratto.

**Perché:** è la prospettiva del 2,5D. Senza, le pecore lontane sembrerebbero disegnate con un pennarello più grosso.

## 7. Animazioni

La guida non parla di animazioni. Proposta:
- **Personaggi:** si muovono sempre con `transform` (spostamento, rotazione, scala, inclinazione), senza ridisegnare le forme. È la stessa regola delle pose dell'agnellino.
- **Ritmo:** movimenti morbidi, con un piccolo rimbalzo all'arrivo. Nessun lampeggio rapido, tranne il lampo del fulmine, che dura meno di un secondo.
- **Movimento ridotto:** se il telefono ha attivo "riduci movimento", le animazioni di sfondo si fermano e restano solo quelle che spiegano cosa succede nella partita.

## Da decidere insieme

- **Tovaglia:** la tieni a quadri rossi e bianchi come definitiva, o vuoi rivederla più avanti?
- **Le 6 illustrazioni meteo disegnate da me in bozza:** grandine, pioggia, vento, nebbia, fulmine e gelata. Vanno approvate o ridisegnate.
