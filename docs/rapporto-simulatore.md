# Rapporto del simulatore

Seme iniziale 1; 6000 partite in 458 s.
Durata in minuti stimata con l'ipotesi di 1.5 minuti per round.

- **casuale**: ogni giocatore sceglie a caso tra le azioni valide (richiesta del brief).
- **semplice**: buon senso, come il bot del brief: Trovate pesate sul valore, furti e Testate a chi ha più agnellini, Belati di salvataggio solo a rischio di eliminazione, Beee-NO! quando un avversario sta per riempire l'Ovile o quando si è colpiti.

## Criteri di accettazione

| Politica | Giocatori | Nessun errore o stallo | Media round 6–12 | Nessun modo > 70% |
| --- | --- | --- | --- | --- |
| casuale | 2 | ✅ 0 | ✅ 9.3 | ✅ 39.4% |
| casuale | 3 | ✅ 0 | ✅ 8.7 | ✅ 49.0% |
| casuale | 4 | ✅ 0 | ✅ 6.1 | ✅ 50.0% |
| semplice | 2 | ✅ 0 | ✅ 10.8 | ✅ 48.2% |
| semplice | 3 | ✅ 0 | ✅ 9.4 | ✅ 49.4% |
| semplice | 4 | ✅ 0 | ✅ 7.1 | ✅ 62.9% |

## Durata e modi di vittoria

| Politica | Giocatori | Round medi (mediana, p10–p90, min–max) | Partite tra 6 e 12 round | Minuti stimati | Ovile pieno | Ultima pecora | Mazzo finito | Vittorie condivise |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| casuale | 2 | 9.3 (10, 6–12, 3–14) | 91.1% | 13.9 | 30.4% | 39.4% | 30.2% | 0.4% |
| casuale | 3 | 8.7 (9, 6–11, 3–15) | 90.2% | 13.0 | 49.0% | 10.5% | 40.5% | 1.0% |
| casuale | 4 | 6.1 (7, 4–8, 2–10) | 72.5% | 9.2 | 50.0% | 0.0% | 50.0% | 1.3% |
| semplice | 2 | 10.8 (11, 7–14, 4–16) | 63.7% | 16.1 | 48.2% | 21.0% | 30.8% | 0.6% |
| semplice | 3 | 9.4 (10, 6–11, 3–15) | 92.3% | 14.0 | 48.1% | 2.5% | 49.4% | 1.3% |
| semplice | 4 | 7.1 (7, 5–8, 2–10) | 88.1% | 10.7 | 37.1% | 0.0% | 62.9% | 3.4% |

## Dinamiche

| Politica | Giocatori | Eliminazioni / partita | Partite con eliminazioni | Guai presi / partita | Belati Finali / partita | Beee-NO! / partita | Annullamenti / partita | Vittorie del primo giocatore |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| casuale | 2 | 0.4 | 39.4% | 7.1 | 0.00 | 2.7 | 2.5 | 47.6% (atteso 50.0%) |
| casuale | 3 | 0.6 | 44.9% | 7.2 | 0.84 | 3.2 | 2.9 | 34.9% (atteso 33.3%) |
| casuale | 4 | 0.2 | 14.9% | 5.1 | 0.88 | 3.3 | 2.9 | 26.8% (atteso 25.0%) |
| semplice | 2 | 0.2 | 21.0% | 8.0 | 0.00 | 2.7 | 2.3 | 49.4% (atteso 50.0%) |
| semplice | 3 | 0.3 | 24.3% | 8.2 | 0.92 | 3.0 | 2.5 | 31.6% (atteso 33.3%) |
| semplice | 4 | 0.1 | 7.7% | 6.6 | 1.05 | 2.9 | 2.5 | 25.6% (atteso 25.0%) |

## Vittorie per pecora

Quota di vittorie sulle partite in cui la pecora era in gioco (atteso: 1 / giocatori).

| Politica | Giocatori | brontolana | nerina | ricciolo | sospirella |
| --- | --- | --- | --- | --- | --- |
| casuale | 2 | 51.0% | 51.6% | 48.8% | 48.7% |
| casuale | 3 | 36.7% | 31.3% | 32.3% | 32.8% |
| casuale | 4 | 26.3% | 21.8% | 27.2% | 24.6% |
| semplice | 2 | 53.3% | 49.6% | 51.0% | 45.7% |
| semplice | 3 | 32.8% | 33.5% | 32.7% | 34.5% |
| semplice | 4 | 23.6% | 23.9% | 28.6% | 23.8% |

## Facce del dado uscite

| Politica | Giocatori | furto_grande | furto_piccolo | pascolo_grande | pascolo_piccolo | testata |
| --- | --- | --- | --- | --- | --- | --- |
| casuale | 2 | 16.7% | 16.9% | 17.8% | 16.0% | 32.7% |
| casuale | 3 | 16.2% | 17.0% | 17.2% | 16.5% | 33.1% |
| casuale | 4 | 16.2% | 16.8% | 16.9% | 16.7% | 33.4% |
| semplice | 2 | 16.6% | 16.7% | 17.8% | 15.9% | 32.9% |
| semplice | 3 | 16.1% | 17.2% | 16.9% | 16.5% | 33.3% |
| semplice | 4 | 16.1% | 17.0% | 17.4% | 16.5% | 33.0% |
