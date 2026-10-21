// Partite casuali complete a 4 giocatori, prime 25 partite e prova di determinismo (un file per intervallo: girano su fili diversi).
import { provaFuzzPerGiocatori } from './aiuti-fuzz';

provaFuzzPerGiocatori(4, 0, 25, true);
