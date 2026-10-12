// Sessione locale: salvataggio automatico, ripresa, viste filtrate, rifiuto delle azioni non valide.
import { describe, expect, it } from 'vitest';
import { archivioInMemoria, SessioneLocale } from './locale';

const GIOCATORI = [
  { id: 'a', nome: 'Ada', pecora: 'ricciolo' as const },
  { id: 'b', nome: 'Bea', pecora: 'nerina' as const },
  { id: 'c', nome: 'Cleo', pecora: 'sospirella' as const },
];

describe('SessioneLocale', () => {
  it('salva a ogni azione e si riprende dallo stesso punto', () => {
    const archivio = archivioInMemoria();
    const s = SessioneLocale.nuova(GIOCATORI, 5, archivio);
    expect(archivio.leggi()).not.toBeNull();
    expect(s.invia({ tipo: 'prosegui' })).toEqual({ ok: true });
    const ripresa = SessioneLocale.riprendi(archivio);
    expect(ripresa?.vista(null)).toEqual(s.vista(null));
  });

  it('avvisa gli ascoltatori e rifiuta le azioni non valide senza cambiare nulla', () => {
    const s = SessioneLocale.nuova(GIOCATORI, 5, archivioInMemoria());
    let avvisi = 0;
    const smetti = s.ascolta(() => avvisi++);
    const prima = s.vista(null);
    const esito = s.invia({ tipo: 'lanciaDado', giocatore: 'a' });
    expect(esito.ok).toBe(false);
    expect(s.vista(null)).toEqual(prima);
    s.invia({ tipo: 'prosegui' });
    expect(avvisi).toBe(1);
    smetti();
    s.invia({ tipo: 'scegliTrovata', giocatore: 'a', carte: [] });
    expect(avvisi).toBe(1);
  });

  it('la vista di un giocatore mostra solo la sua mano; le azioni sono quelle del motore', () => {
    const s = SessioneLocale.nuova(GIOCATORI, 5, archivioInMemoria());
    s.invia({ tipo: 'prosegui' });
    const v = s.vista('a');
    expect(v.giocatori.find((g) => g.id === 'a')?.mano).toHaveLength(5);
    expect(v.giocatori.find((g) => g.id === 'b')?.mano).toBeNull();
    expect(s.azioni('a').every((x) => x.tipo === 'scegliTrovata')).toBe(true);
    expect(s.azioni('sistema')).toEqual([]);
  });

  it('un salvataggio illeggibile o di un\'altra versione non si riprende', () => {
    const archivio = archivioInMemoria();
    archivio.scrivi('{non json');
    expect(SessioneLocale.riprendi(archivio)).toBeNull();
    archivio.scrivi(JSON.stringify({ versione: 99, stato: {} }));
    expect(SessioneLocale.riprendi(archivio)).toBeNull();
  });
});
