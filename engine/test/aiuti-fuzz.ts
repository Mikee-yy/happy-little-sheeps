// Aiuti comuni delle partite casuali complete (fuzz): invarianti, controlli di fine partita e la prova per numero di giocatori,
// che sta in file separati (uno per numero di giocatori) così i tre pezzi lunghi girano su fili diversi.
import { describe, expect, it } from 'vitest';
import type { Azione, IdCarta, IdPecora, ModoVittoria, Stato } from '../src';
import {
  applica,
  azioniPossibili,
  creaMazzoGuai,
  creaMazzoPrincipale,
  inAttesaDi,
  nuovaPartita,
  tentaApplica,
  vistaPer,
} from '../src';

const PECORE: IdPecora[] = ['ricciolo', 'brontolana', 'sospirella', 'nerina'];
const MASSIMO_AZIONI = 5000;
const PARTITE_PER_NUMERO = 60;
const TEMPO_MASSIMO_MS = 180_000;

/** Generatore locale con seme (mulberry32), indipendente da quello del motore. */
function generatore(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Controlli in JS semplice: `expect` a ogni passo e per ogni carta renderebbe il test troppo lento.
function verifica(condizione: boolean, messaggio: () => string): void {
  if (!condizione) throw new Error(messaggio());
}

function controllaOgniIstanzaUnaVolta(trovate: IdCarta[], attese: IdCarta[], cosa: string): void {
  const conta = new Map<IdCarta, number>();
  for (const c of trovate) conta.set(c, (conta.get(c) ?? 0) + 1);
  for (const c of attese) verifica(conta.get(c) === 1, () => `${cosa}: ${c} presente ${conta.get(c) ?? 0} volte`);
  verifica(conta.size === attese.length, () => `${cosa}: carte estranee ${[...conta.keys()].filter((c) => !attese.includes(c))}`);
}

const cacheMazzi = new Map<number, IdCarta[]>();
const TUTTI_GUAI = creaMazzoGuai();

function controllaInvarianti(s: Stato): void {
  const n = s.giocatori.length;
  const agnellini = s.giocatori.reduce((somma, g) => somma + g.agnellini, 0);
  verifica(s.gregge + agnellini === s.config.agnelliniTotali, () => `agnellini non conservati: ${s.gregge} + ${agnellini}`);
  verifica(s.gregge >= 0, () => `Gregge negativo: ${s.gregge}`);
  for (const g of s.giocatori) {
    verifica(g.agnellini >= 0 && g.agnellini <= s.config.postiOvile, () => `${g.id} ha ${g.agnellini} agnellini`);
    if (g.eliminato) {
      verifica(g.agnellini === 0 && g.mano.length === 0 && g.angolo.length === 0, () => `${g.id} eliminato con risorse`);
    }
  }

  const principali = [
    ...s.mazzo,
    ...s.scarti,
    ...s.giocatori.flatMap((g) => g.mano),
    ...s.datiRound.tavolo,
    ...(s.richiesta?.tipo === 'guarda_due' ? s.richiesta.carte : []),
  ];
  if (!cacheMazzi.has(n)) cacheMazzi.set(n, creaMazzoPrincipale(n));
  controllaOgniIstanzaUnaVolta(principali, cacheMazzi.get(n)!, 'mazzo principale');

  const guai = [...s.mazzoGuai, ...s.guaiFuoriGioco, ...s.giocatori.flatMap((g) => g.angolo)];
  if (s.datiRound.guaio !== null && !guai.includes(s.datiRound.guaio)) guai.push(s.datiRound.guaio);
  controllaOgniIstanzaUnaVolta(guai, TUTTI_GUAI, 'Guai');

  verifica(s.eventi.length <= 200, () => `troppi eventi: ${s.eventi.length}`);
  for (let i = 1; i < s.eventi.length; i++) {
    verifica(s.eventi[i]!.seq > s.eventi[i - 1]!.seq, () => `seq non crescente all'indice ${i}`);
  }
  const cima = s.pila[s.pila.length - 1];
  verifica(cima ? s.finestra?.voce === cima.id : s.finestra === null, () => 'finestra incoerente con la pila');
}

function controllaVista(s: Stato): void {
  for (const g of s.giocatori) {
    const v = vistaPer(s, g.id);
    for (const vg of v.giocatori) {
      if (vg.id === g.id) expect(vg.mano).toEqual(g.mano);
      else expect(vg.mano).toBeNull();
    }
    expect(v).not.toHaveProperty('mazzo');
    expect(v).not.toHaveProperty('rng');
    for (const e of v.eventi) if (e.tipo === 'pescate' && e.giocatore !== g.id) expect(e.carte).toBeUndefined();
  }
  const tavolo = vistaPer(s, null);
  expect(tavolo.giocatori.every((vg) => vg.mano === null)).toBe(true);
}

function candidati(s: Stato, tutti: boolean): Azione[] {
  const azioni: Azione[] = [...azioniPossibili(s, 'sistema')];
  const chi = tutti ? s.giocatori.map((g) => g.id) : inAttesaDi(s).giocatori;
  for (const id of chi) azioni.push(...azioniPossibili(s, id));
  return azioni;
}

interface Opzioni {
  /** Ogni quanti passi provare con tentaApplica ogni azione elencata per tutti (0 = mai). */
  verificaTutteOgni: number;
  /** Ogni quanti passi confrontare il JSON dell'argomento prima e dopo applica e controllare le viste. */
  campione: number;
}

interface Risultato {
  stato: Stato;
  passi: number;
}

function giocaPartita(numero: number, seme: number, opzioni: Opzioni): Risultato {
  const giocatori = Array.from({ length: numero }, (_, i) => ({ id: `p${i + 1}`, nome: `P${i + 1}`, pecora: PECORE[i]! }));
  let s = nuovaPartita({ giocatori, seme });
  controllaInvarianti(s);
  const rnd = generatore(seme * 31 + numero);
  let passi = 0;
  while (s.esito === null) {
    verifica(passi < MASSIMO_AZIONI, () => `seme ${seme}: oltre ${MASSIMO_AZIONI} azioni`);
    const attesa = inAttesaDi(s);
    verifica(attesa.sistema || attesa.giocatori.length > 0, () => `seme ${seme}: nessuno in attesa in ${s.fase.nome}`);

    if (opzioni.verificaTutteOgni > 0 && passi % opzioni.verificaTutteOgni === 0) {
      for (const a of candidati(s, true)) {
        const r = tentaApplica(s, a);
        verifica(r.ok, () => `seme ${seme}, ${s.fase.nome}: azione elencata rifiutata ${JSON.stringify(a)}: ${!r.ok && r.errore.message}`);
      }
    }

    // Di solito agisce chi è atteso; ogni tanto chiunque (Belati di punteggio fuori turno, cambi di scelta).
    const elenco = rnd() < 0.1 ? candidati(s, true) : candidati(s, false);
    verifica(elenco.length > 0, () => `seme ${seme}: nessuna azione possibile in ${s.fase.nome}`);
    const azione = elenco[Math.floor(rnd() * elenco.length)]!;

    const controlla = passi % opzioni.campione === 0;
    const prima = controlla ? JSON.stringify(s) : '';
    const r = tentaApplica(s, azione);
    verifica(r.ok, () => `seme ${seme}, ${s.fase.nome}: rifiutata ${JSON.stringify(azione)}: ${!r.ok && r.errore.message}`);
    if (!r.ok) break;
    if (controlla) {
      verifica(JSON.stringify(s) === prima, () => `seme ${seme}: applica ha modificato l'argomento (${azione.tipo})`);
      controllaVista(r.stato);
    }
    s = r.stato;
    controllaInvarianti(s);
    passi++;
  }
  return { stato: s, passi };
}

function controllaFine(s: Stato): void {
  expect(s.fase.nome).toBe('fine_partita');
  const esito = s.esito!;
  expect(esito.vincitori.length).toBeGreaterThan(0);
  const vivi = s.giocatori.filter((g) => !g.eliminato);
  for (const id of esito.vincitori) expect(vivi.map((g) => g.id)).toContain(id);
  if (esito.modo === 'ovile_pieno') {
    for (const id of esito.vincitori) expect(vivi.find((g) => g.id === id)!.agnellini).toBe(s.config.postiOvile);
  } else if (esito.modo === 'ultima_pecora') {
    expect(vivi.length).toBe(1);
    expect(esito.vincitori).toEqual([vivi[0]!.id]);
  } else {
    expect(s.mazzo).toEqual([]);
    expect(s.round).toBe(s.ultimoRound);
    const massimo = Math.max(...vivi.map((g) => g.agnellini));
    for (const id of esito.vincitori) expect(vivi.find((g) => g.id === id)!.agnellini).toBe(massimo);
  }
  expect(s.pila).toEqual([]);
  expect(s.finestra).toBeNull();
  expect(s.richiesta).toBeNull();
  expect(s.eventi[s.eventi.length - 1]?.tipo).toBe('fine_partita');
  expect(inAttesaDi(s)).toEqual({ sistema: false, giocatori: [] });
  expect(azioniPossibili(s, 'sistema')).toEqual([]);
  for (const g of s.giocatori) expect(azioniPossibili(s, g.id)).toEqual([]);
  expect(() => applica(s, { tipo: 'prosegui' })).toThrow();
}

/**
 * Le prove di partite casuali per un numero di giocatori (stesse prove di quando erano un unico `describe.each`).
 * `da` e `fino` (escluso) scelgono le partite del primo test: i file più lunghi le dividono in due intervalli;
 * la prova di determinismo gira solo con `conDeterminismo`.
 */
export function provaFuzzPerGiocatori(numero: 2 | 3 | 4, da = 0, fino = PARTITE_PER_NUMERO, conDeterminismo = true): void {
  const suffisso = da === 0 && fino === PARTITE_PER_NUMERO ? '' : ` (semi ${da}–${fino - 1})`;
  describe(`partite casuali a ${numero} giocatori`, () => {
    it(
      `${PARTITE_PER_NUMERO} partite terminano con esito valido e invarianti rispettati${suffisso}`,
      () => {
        const modi: Record<ModoVittoria, number> = { ovile_pieno: 0, ultima_pecora: 0, mazzo_finito: 0 };
        for (let k = da; k < fino; k++) {
          const seme = 1000 * numero + k * 7 + 1;
          // Le prime partite provano ogni azione elencata a ogni passo; le altre a campione.
          const completa = k < 10;
          const { stato } = giocaPartita(numero, seme, { verificaTutteOgni: completa ? 1 : 4, campione: completa ? 1 : 40 });
          controllaFine(stato);
          modi[stato.esito!.modo] += 1;
        }
        expect(modi.ovile_pieno + modi.ultima_pecora + modi.mazzo_finito).toBe(fino - da);
      },
      TEMPO_MASSIMO_MS,
    );

    if (conDeterminismo) {
      it(
        'stesso seme e stesse scelte danno lo stesso stato finale',
        () => {
          for (let k = 0; k < 4; k++) {
            const seme = 77_000 + numero * 13 + k;
            const a = giocaPartita(numero, seme, { verificaTutteOgni: 0, campione: 1_000_000 });
            const b = giocaPartita(numero, seme, { verificaTutteOgni: 0, campione: 1_000_000 });
            expect(b.passi).toBe(a.passi);
            expect(JSON.stringify(b.stato)).toBe(JSON.stringify(a.stato));
          }
        },
        TEMPO_MASSIMO_MS,
      );
    }
  });
}
