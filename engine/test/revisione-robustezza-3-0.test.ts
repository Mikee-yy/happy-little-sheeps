// Robustezza contro azioni malformate: partita 1 di 2 a 3 giocatori (un file per partita: girano su fili diversi).
import { describe, it } from 'vitest';
import { provaRobustezza } from './aiuti-revisione';

describe('Revisione · robustezza contro azioni malformate (specifica §1 "Azioni non valide", §13)', () => {
  it(
    'partite a 3 giocatori: ogni variante malformata delle azioni valide e ogni azione a caso dà ErroreRegola oppure uno stato integro, mai un\'altra eccezione (seme 342)',
    () => {
      provaRobustezza(3, 0);
    },
    180_000,
  );
});
