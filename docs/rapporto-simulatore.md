# Rapporto del simulatore

Seme iniziale 1; 6000 partite in 586 s.
Durata in minuti stimata con l'ipotesi di 1.5 minuti per round.

- **casuale**: ogni giocatore sceglie a caso tra le azioni valide (richiesta del brief).
- **semplice**: buon senso, come il bot del brief: Trovate pesate sul valore, furti e Testate a chi ha più agnellini, Belati di salvataggio solo a rischio di eliminazione, Beee-NO! quando un avversario sta per riempire l'Ovile o quando si è colpiti.

## Criteri di accettazione

| Politica | Giocatori | Nessun errore o stallo | Media round 6–12 | Nessun modo > 70% |
| --- | --- | --- | --- | --- |
| casuale | 2 | ✅ 0 | ✅ 9.7 | ✅ 36.4% |
| casuale | 3 | ✅ 0 | ✅ 8.5 | ✅ 46.5% |
| casuale | 4 | ✅ 0 | ✅ 6.2 | ✅ 51.8% |
| semplice | 2 | ✅ 0 | ✅ 11.0 | ✅ 51.0% |
| semplice | 3 | ✅ 0 | ✅ 9.3 | ✅ 49.6% |
| semplice | 4 | ✅ 0 | ✅ 7.2 | ✅ 61.8% |

## Durata e modi di vittoria

| Politica | Giocatori | Round medi (mediana, p10–p90, min–max) | Partite tra 6 e 12 round | Minuti stimati | Ovile pieno | Ultima pecora | Mazzo finito | Vittorie condivise |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| casuale | 2 | 9.7 (10, 7–12, 3–14) | 93.9% | 14.5 | 34.3% | 29.3% | 36.4% | 0.3% |
| casuale | 3 | 8.5 (9, 6–11, 3–14) | 90.5% | 12.8 | 46.5% | 28.5% | 25.0% | 0.7% |
| casuale | 4 | 6.2 (7, 4–8, 2–10) | 72.3% | 9.3 | 51.8% | 0.0% | 48.2% | 1.8% |
| semplice | 2 | 11.0 (12, 7–14, 4–16) | 63.5% | 16.4 | 51.0% | 16.8% | 32.2% | 0.7% |
| semplice | 3 | 9.3 (10, 6–12, 3–14) | 90.5% | 13.9 | 49.6% | 8.9% | 41.5% | 0.8% |
| semplice | 4 | 7.2 (7, 5–8, 2–11) | 88.2% | 10.7 | 38.2% | 0.0% | 61.8% | 4.2% |

## Dinamiche

| Politica | Giocatori | Eliminazioni / partita | Partite con eliminazioni | Guai presi / partita | Belati Finali / partita | Beee-NO! / partita | Annullamenti / partita | Vittorie del primo giocatore |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| casuale | 2 | 0.3 | 29.3% | 7.4 | 0.00 | 2.8 | 2.6 | 48.4% (atteso 50.0%) |
| casuale | 3 | 1.0 | 69.5% | 7.0 | 0.77 | 3.0 | 2.7 | 32.1% (atteso 33.3%) |
| casuale | 4 | 0.3 | 30.8% | 5.1 | 0.88 | 3.3 | 2.9 | 25.6% (atteso 25.0%) |
| semplice | 2 | 0.2 | 16.8% | 8.2 | 0.00 | 2.7 | 2.3 | 50.6% (atteso 50.0%) |
| semplice | 3 | 0.6 | 46.1% | 7.7 | 0.89 | 2.9 | 2.5 | 32.6% (atteso 33.3%) |
| semplice | 4 | 0.2 | 17.3% | 6.5 | 1.04 | 2.9 | 2.5 | 25.2% (atteso 25.0%) |

## Vittorie per pecora

Quota di vittorie sulle partite in cui la pecora era in gioco (atteso: 1 / giocatori).

| Politica | Giocatori | brontolana | nerina | ricciolo | sospirella |
| --- | --- | --- | --- | --- | --- |
| casuale | 2 | 51.3% | 49.0% | 49.9% | 49.8% |
| casuale | 3 | 33.7% | 32.1% | 35.6% | 31.8% |
| casuale | 4 | 27.3% | 21.3% | 25.7% | 25.7% |
| semplice | 2 | 55.8% | 51.0% | 47.8% | 45.3% |
| semplice | 3 | 33.9% | 32.2% | 33.0% | 34.3% |
| semplice | 4 | 22.4% | 24.2% | 26.2% | 27.2% |

## Facce del dado uscite

| Politica | Giocatori | furto_grande | furto_piccolo | pascolo_grande | pascolo_piccolo | testata |
| --- | --- | --- | --- | --- | --- | --- |
| casuale | 2 | 16.8% | 16.9% | 17.6% | 15.9% | 32.8% |
| casuale | 3 | 16.4% | 16.8% | 17.1% | 16.8% | 33.0% |
| casuale | 4 | 16.2% | 16.7% | 17.1% | 16.7% | 33.3% |
| semplice | 2 | 16.6% | 16.7% | 17.8% | 16.1% | 32.8% |
| semplice | 3 | 16.1% | 16.8% | 17.1% | 16.5% | 33.5% |
| semplice | 4 | 16.0% | 17.0% | 17.2% | 16.5% | 33.2% |
