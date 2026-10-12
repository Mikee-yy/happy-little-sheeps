# Rapporto del simulatore — numeri del brief originale (Ovile 15 / 12 / 12, dado con una Testata)

Seme iniziale 1; 6000 partite in 274 s.
Durata in minuti stimata con l'ipotesi di 1.5 minuti per round.

- **casuale**: ogni giocatore sceglie a caso tra le azioni valide (richiesta del brief).
- **semplice**: buon senso, come il bot del brief: Trovate pesate sul valore, furti e Testate a chi ha più agnellini, Belati di salvataggio solo a rischio di eliminazione, Beee-NO! quando un avversario sta per riempire l'Ovile o quando si è colpiti.

## Criteri di accettazione

| Politica | Giocatori | Nessun errore o stallo | Media round 6–12 | Nessun modo > 70% |
| --- | --- | --- | --- | --- |
| casuale | 2 | ✅ 0 | ✅ 7.6 | ❌ 80.8% |
| casuale | 3 | ✅ 0 | ❌ 5.9 | ❌ 91.9% |
| casuale | 4 | ✅ 0 | ❌ 5.7 | ❌ 71.4% |
| semplice | 2 | ✅ 0 | ✅ 8.2 | ❌ 90.4% |
| semplice | 3 | ✅ 0 | ✅ 6.4 | ❌ 93.7% |
| semplice | 4 | ✅ 0 | ✅ 6.6 | ✅ 60.8% |

## Durata e modi di vittoria

| Politica | Giocatori | Round medi (mediana, p10–p90, min–max) | Partite tra 6 e 12 round | Minuti stimati | Ovile pieno | Ultima pecora | Mazzo finito | Vittorie condivise |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| casuale | 2 | 7.6 (7, 4–11, 3–13) | 79.2% | 11.4 | 80.8% | 10.8% | 8.4% | 0.1% |
| casuale | 3 | 5.9 (6, 3–9, 2–12) | 52.6% | 8.9 | 91.9% | 5.1% | 3.0% | 0.1% |
| casuale | 4 | 5.7 (6, 3–7, 2–9) | 59.9% | 8.5 | 71.4% | 0.0% | 28.6% | 1.1% |
| semplice | 2 | 8.2 (8, 5–12, 3–14) | 76.9% | 12.3 | 90.4% | 4.6% | 5.0% | 0.1% |
| semplice | 3 | 6.4 (6, 4–9, 2–13) | 63.9% | 9.6 | 93.7% | 1.3% | 5.0% | 0.2% |
| semplice | 4 | 6.6 (7, 4–8, 2–10) | 76.1% | 9.9 | 60.8% | 0.0% | 39.2% | 2.7% |

## Dinamiche

| Politica | Giocatori | Eliminazioni / partita | Partite con eliminazioni | Guai presi / partita | Belati Finali / partita | Beee-NO! / partita | Annullamenti / partita | Vittorie del primo giocatore |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| casuale | 2 | 0.1 | 10.8% | 5.5 | 0.00 | 2.2 | 2.1 | 48.0% (atteso 50.0%) |
| casuale | 3 | 0.4 | 33.4% | 4.5 | 0.59 | 2.3 | 2.1 | 33.6% (atteso 33.3%) |
| casuale | 4 | 0.2 | 22.5% | 4.5 | 0.82 | 3.1 | 2.8 | 26.5% (atteso 25.0%) |
| semplice | 2 | 0.0 | 4.6% | 5.9 | 0.00 | 2.0 | 1.7 | 52.5% (atteso 50.0%) |
| semplice | 3 | 0.2 | 18.2% | 5.2 | 0.62 | 2.2 | 1.9 | 34.9% (atteso 33.3%) |
| semplice | 4 | 0.1 | 13.6% | 5.8 | 0.99 | 2.8 | 2.3 | 22.5% (atteso 25.0%) |

## Vittorie per pecora

Quota di vittorie sulle partite in cui la pecora era in gioco (atteso: 1 / giocatori).

| Politica | Giocatori | brontolana | nerina | ricciolo | sospirella |
| --- | --- | --- | --- | --- | --- |
| casuale | 2 | 49.1% | 52.5% | 51.2% | 47.0% |
| casuale | 3 | 33.4% | 32.0% | 34.5% | 33.4% |
| casuale | 4 | 22.9% | 23.0% | 29.0% | 25.1% |
| semplice | 2 | 51.5% | 50.9% | 52.1% | 45.0% |
| semplice | 3 | 32.7% | 33.5% | 33.6% | 33.6% |
| semplice | 4 | 26.5% | 21.9% | 25.5% | 26.1% |

## Facce del dado uscite

| Politica | Giocatori | furto_grande | furto_piccolo | pascolo_grande | pascolo_piccolo | testata |
| --- | --- | --- | --- | --- | --- | --- |
| casuale | 2 | 16.9% | 16.4% | 16.7% | 33.6% | 16.4% |
| casuale | 3 | 16.1% | 16.1% | 16.6% | 34.0% | 17.2% |
| casuale | 4 | 15.9% | 16.0% | 16.9% | 34.0% | 17.2% |
| semplice | 2 | 16.7% | 16.4% | 17.0% | 33.8% | 16.1% |
| semplice | 3 | 16.3% | 16.1% | 16.9% | 33.6% | 17.1% |
| semplice | 4 | 16.0% | 16.0% | 16.8% | 33.9% | 17.2% |
