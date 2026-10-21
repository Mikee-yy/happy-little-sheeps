// Partite casuali complete a 3 giocatori, partite dalla 26ª alla 60ª (un file per intervallo: girano su fili diversi).
import { provaFuzzPerGiocatori } from './aiuti-fuzz';

provaFuzzPerGiocatori(3, 25, 60, false);
