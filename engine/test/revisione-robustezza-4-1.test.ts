// Robustezza contro azioni malformate: partita 2 di 2 a 4 giocatori (un file per partita: girano su fili diversi).
import { describe, it } from 'vitest';
import { provaRobustezza } from './aiuti-revisione';

describe('Revisione · robustezza contro azioni malformate (specifica §1 "Azioni non valide", §13)', () => {
  it(
    'partite a 4 giocatori: ogni variante malformata delle azioni valide e ogni azione a caso dà ErroreRegola oppure uno stato integro, mai un\'altra eccezione (seme 350)',
    () => {
      provaRobustezza(4, 1);
    },
    180_000,
  );
});
