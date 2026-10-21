// Partite casuali complete a 3 giocatori, prime 25 partite e prova di determinismo (un file per intervallo: girano su fili diversi).
import { provaFuzzPerGiocatori } from './aiuti-fuzz';

provaFuzzPerGiocatori(3, 0, 25, true);
