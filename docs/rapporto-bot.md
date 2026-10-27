# Rapporto dei bot

Seme iniziale 1; 9000 partite in 708 s.
Generato con `npm run simula -- --miste normale,semplice`. Decisione D47 in `docs/motore.md`.

## Tavoli misti

A ogni partita i posti ruotano di uno, così ogni politica siede ovunque lo stesso numero di volte. Vittorie: quota delle partite vinte da chi usa quella politica (le vittorie condivise contano in frazione); "atteso" è la quota dei posti. Eliminazioni: per giocatore e per partita.

| Giocatori | Tavolo | Partite | Round medi | Politica | Posti | Vittorie | Atteso | Vittorie per posto | Eliminazioni per posto |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 1 normale + 1 semplice | 1000 | 10.5 | normale | 1 | 55.3% | 50.0% | 55.3% (atteso 50.0%) | 0.09 |
| 2 | 1 normale + 1 semplice | 1000 | 10.5 | semplice | 1 | 44.7% | 50.0% | 44.7% (atteso 50.0%) | 0.12 |
| 3 | 2 normale + 1 semplice | 1000 | 9.4 | normale | 2 | 73.0% | 66.7% | 36.5% (atteso 33.3%) | 0.07 |
| 3 | 2 normale + 1 semplice | 1000 | 9.4 | semplice | 1 | 27.0% | 33.3% | 27.0% (atteso 33.3%) | 0.08 |
| 3 | 1 normale + 2 semplice | 1000 | 9.3 | normale | 1 | 41.9% | 33.3% | 41.9% (atteso 33.3%) | 0.07 |
| 3 | 1 normale + 2 semplice | 1000 | 9.3 | semplice | 2 | 58.1% | 66.7% | 29.0% (atteso 33.3%) | 0.08 |
| 4 | 3 normale + 1 semplice | 1000 | 7.0 | normale | 3 | 76.8% | 75.0% | 25.6% (atteso 25.0%) | 0.01 |
| 4 | 3 normale + 1 semplice | 1000 | 7.0 | semplice | 1 | 23.2% | 25.0% | 23.2% (atteso 25.0%) | 0.01 |
| 4 | 2 normale + 2 semplice | 1000 | 7.1 | normale | 2 | 55.4% | 50.0% | 27.7% (atteso 25.0%) | 0.01 |
| 4 | 2 normale + 2 semplice | 1000 | 7.1 | semplice | 2 | 44.6% | 50.0% | 22.3% (atteso 25.0%) | 0.01 |
| 4 | 1 normale + 3 semplice | 1000 | 7.0 | normale | 1 | 30.9% | 25.0% | 30.9% (atteso 25.0%) | 0.01 |
| 4 | 1 normale + 3 semplice | 1000 | 7.0 | semplice | 3 | 69.1% | 75.0% | 23.0% (atteso 25.0%) | 0.02 |

## Tutti i posti con la stessa politica

Seme iniziale 1; 3000 partite.
Durata in minuti stimata con l'ipotesi di 1.5 minuti per round.

- **normale**: il bot del gioco (D47): come semplice, ma Trovate pesate sul quadrato del valore e, con un Guaio che lo eliminerebbe, la più alta; Belati +2/−2 per non restare in fondo quando c'è un Guaio e per lanciare il dado da solo; Finta svenuta verso chi ha più agnellini prima di Faccio finta di niente; Garzina anche quando l'Angolo è molto esposto; Beee-NO! tenuto per l'Ovile pieno, i furti e le Testate che costano almeno 2 agnellini, i Guai deviati che lo eliminerebbero, i −2 che lo mandano in fondo e, a 2 giocatori, i dadi da 3 o più agnellini che portano l'avversario davanti.

### Criteri di accettazione

| Politica | Giocatori | Nessun errore o stallo | Media round 6–12 | Nessun modo > 70% |
| --- | --- | --- | --- | --- |
| normale | 2 | ✅ 0 | ✅ 10.1 | ✅ 52.9% |
| normale | 3 | ✅ 0 | ✅ 9.3 | ✅ 53.3% |
| normale | 4 | ✅ 0 | ✅ 7.0 | ✅ 67.8% |

### Durata e modi di vittoria

| Politica | Giocatori | Round medi (mediana, p10–p90, min–max) | Partite tra 6 e 12 round | Minuti stimati | Ovile pieno | Ultima pecora | Mazzo finito | Vittorie condivise |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| normale | 2 | 10.1 (10, 6–13, 4–15) | 74.1% | 15.1 | 52.9% | 22.4% | 24.7% | 0.1% |
| normale | 3 | 9.3 (10, 6–11, 3–13) | 93.8% | 13.9 | 45.4% | 1.3% | 53.3% | 2.4% |
| normale | 4 | 7.0 (7, 5–8, 2–10) | 87.5% | 10.6 | 32.2% | 0.0% | 67.8% | 2.9% |

### Dinamiche

| Politica | Giocatori | Eliminazioni / partita | Partite con eliminazioni | Guai presi / partita | Belati Finali / partita | Beee-NO! / partita | Annullamenti / partita | Vittorie del primo giocatore |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| normale | 2 | 0.2 | 22.4% | 8.9 | 0.00 | 2.7 | 2.3 | 51.7% (atteso 50.0%) |
| normale | 3 | 0.2 | 19.5% | 8.5 | 0.66 | 2.9 | 2.5 | 32.8% (atteso 33.3%) |
| normale | 4 | 0.1 | 5.8% | 6.7 | 0.71 | 2.8 | 2.4 | 24.3% (atteso 25.0%) |

### Vittorie per pecora

Quota di vittorie sulle partite in cui la pecora era in gioco (atteso: 1 / giocatori).

| Politica | Giocatori | brontolana | nerina | ricciolo | sospirella |
| --- | --- | --- | --- | --- | --- |
| normale | 2 | 50.9% | 48.2% | 49.6% | 51.3% |
| normale | 3 | 32.4% | 35.8% | 34.5% | 30.6% |
| normale | 4 | 25.7% | 25.9% | 23.9% | 24.5% |

### Facce del dado uscite

| Politica | Giocatori | furto_grande | furto_piccolo | pascolo_grande | pascolo_piccolo | testata |
| --- | --- | --- | --- | --- | --- | --- |
| normale | 2 | 16.4% | 16.9% | 17.5% | 16.0% | 33.2% |
| normale | 3 | 16.2% | 16.9% | 17.2% | 16.5% | 33.2% |
| normale | 4 | 16.4% | 17.0% | 16.8% | 16.7% | 33.1% |
