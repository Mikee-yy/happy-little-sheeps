import { describe, expect, it } from 'vitest';
import { H, W } from '../misure';
import {
  arrivoInScena,
  basePartenza,
  cieloDaSeq,
  colpoLungo,
  coperto,
  esitoTiro,
  fasciaDi,
  fineDietroLaCollina,
  FIONDA,
  forzaPerDistanza,
  latoCorsa,
  lunghezzaElastico,
  partenzaDi,
  posizioneInVolo,
  puntoArrivo,
  puntoDiScena,
  puntoInCielo,
  riportaSuRecinto,
  scansa,
  scia,
  spazioPerTirare,
  strisciaCorsa,
  tiroPieno,
  uscitaDallaFascia,
  valoriCerchi,
  variazioneDaSeq,
  ventaglio,
  yRitorno,
  zonaDi,
  type Punto,
  type Rett,
} from './tiro';

describe('fionda: dal tiro al punto d\'arrivo, misurato sul recinto bersaglio', () => {
  const P0 = { x: 195, y: 360 };
  // Dritto davanti: centro (195, 130) a 230 dalla partenza, profondità lungo la mira 60 (l'altezza del recinto)
  const R = { x0: 95, y0: 100, x1: 295, y1: 160 };
  it('la fascia: distanza del centro ∓ (½ + margine) × profondità lungo la mira', () => {
    expect(FIONDA.margine).toBe(1);
    const f = fasciaDi(P0, R);
    expect(f.distanza).toBeCloseTo(230);
    expect(f.profondita).toBeCloseTo(60);
    expect(f.vicino).toBeCloseTo(230 - 1.5 * 60);
    expect(f.lontano).toBeCloseTo(230 + 1.5 * 60);
  });
  it('elastico quasi a riposo: il tiro non parte', () => {
    expect(puntoArrivo(P0, { x: 0, y: FIONDA.tiroMinimo - 1 }, R)).toBeNull();
  });
  it('poco tiro cade corto, a metà tiro arriva al centro, a tutta forza va lungo', () => {
    const meta = (FIONDA.tiroMinimo + FIONDA.tiroMassimo) / 2;
    expect(puntoArrivo(P0, { x: 0, y: FIONDA.tiroMinimo }, R)).toEqual({ x: 195, y: 360 - 140 });
    const centro = puntoArrivo(P0, { x: 0, y: meta }, R)!;
    expect(centro.x).toBeCloseTo(195);
    expect(centro.y).toBeCloseTo(130);
    expect(zonaDi(centro, R)).toBe(3);
    const lungo = puntoArrivo(P0, { x: 0, y: FIONDA.tiroMassimo }, R)!;
    expect(lungo.y).toBeCloseTo(360 - 320);
    expect(zonaDi(lungo, R)).toBe(0);
  });
  it('oltre la forza piena non va più lontano', () => {
    expect(puntoArrivo(P0, { x: 0, y: 400 }, R)).toEqual(puntoArrivo(P0, { x: 0, y: FIONDA.tiroMassimo }, R));
  });
  it('il recinto occupa circa un terzo della corsa del dito', () => {
    let dentro = 0;
    const passi = 1000;
    for (let i = 0; i <= passi; i++) {
      const l = FIONDA.tiroMinimo + ((FIONDA.tiroMassimo - FIONDA.tiroMinimo) * i) / passi;
      if (zonaDi(puntoArrivo(P0, { x: 0, y: l }, R)!, R) >= 2) dentro++;
    }
    expect(dentro / (passi + 1)).toBeCloseTo(1 / 3, 1);
  });
  it('mira di sbieco: la profondità è il tratto del recinto attraversato dalla linea verso il centro', () => {
    // Centro (50, 20); la partenza è a 100 lungo la direzione (0.6, -0.8): il tratto è limitato dall'altezza, 40 / 0.8 = 50
    const r = { x0: 0, y0: 0, x1: 100, y1: 40 };
    const p = { x: 50 - 60, y: 20 + 80 };
    const f = fasciaDi(p, r);
    expect(f.distanza).toBeCloseTo(100);
    expect(f.profondita).toBeCloseTo(50);
    const meta = (FIONDA.tiroMinimo + FIONDA.tiroMassimo) / 2;
    const c = puntoArrivo(p, { x: -0.6 * meta, y: 0.8 * meta }, r)!;
    expect(c.x).toBeCloseTo(50);
    expect(c.y).toBeCloseTo(20);
  });
  it('forza e lunghezza dell\'elastico: l\'una il contrario dell\'altra', () => {
    const f = fasciaDi(P0, R);
    expect(forzaPerDistanza(f.vicino, f)).toBeCloseTo(0);
    expect(forzaPerDistanza(f.distanza, f)).toBeCloseTo(0.5);
    expect(forzaPerDistanza(f.lontano, f)).toBeCloseTo(1);
    expect(lunghezzaElastico(0)).toBe(FIONDA.tiroMinimo);
    expect(lunghezzaElastico(1)).toBe(FIONDA.tiroMassimo);
    const a = puntoArrivo(P0, { x: 0, y: lunghezzaElastico(forzaPerDistanza(200, f)) }, R)!;
    expect(a.y).toBeCloseTo(160);
  });
});

describe('fionda: le zone', () => {
  const R = { x0: 100, y0: 100, x1: 300, y1: 180 }; // centro (200, 140), 200×80
  const BX = FIONDA.fasciaBordo.x * 200, BY = FIONDA.fasciaBordo.y * 80; // la fascia è relativa al recinto
  it('zone: 3 centro, 2 resto dell\'interno, 1 staccionata e fascia fuori, 0 oltre', () => {
    expect(zonaDi({ x: 200, y: 140 }, R)).toBe(3);
    expect(zonaDi({ x: 200 + 0.2 * 100, y: 140 }, R)).toBe(3);   // ancora nel centro (raggio 0.3)
    expect(zonaDi({ x: 200 + 0.5 * 100, y: 140 }, R)).toBe(2);   // fuori dal centro, dentro
    expect(zonaDi({ x: 299, y: 175 }, R)).toBe(2);               // dentro, vicino alla staccionata
    expect(zonaDi({ x: 300, y: 140 }, R)).toBe(1);               // sulla staccionata
    expect(zonaDi({ x: 300 + BX - 1, y: 140 }, R)).toBe(1);      // appena fuori, nella fascia
    expect(zonaDi({ x: 300 + BX, y: 140 }, R)).toBe(1);          // al limite della fascia
    expect(zonaDi({ x: 300 + BX + 1, y: 140 }, R)).toBe(0);      // oltre
    expect(zonaDi({ x: 200, y: 100 - BY + 1 }, R)).toBe(1);      // sopra, nella fascia
    expect(zonaDi({ x: 200, y: 100 - BY - 1 }, R)).toBe(0);
    expect(zonaDi({ x: 300 + BX, y: 180 + BY }, R)).toBe(0);     // l'angolo: la fascia è tonda, non a quadrato
    expect(zonaDi({ x: 300 + 0.6 * BX, y: 180 + 0.6 * BY }, R)).toBe(1); // angolo dentro la fascia
  });
  it('la fascia è una frazione del recinto, stretta (decisione dell\'utente, 26/10): metà della prima versione', () => {
    // Prima versione 0.5 × 0.9 (la zona 1 copriva gran parte della corsa del dito): ora la metà
    expect(FIONDA.fasciaBordo).toEqual({ x: 0.25, y: 0.45 });
    // Recinti avversari normali (larghezza × altezza): 2 giocatori 129×36, 3 giocatori 78×44, 4 giocatori 57×36
    for (const [l, h] of [[129, 36], [78, 44], [57, 36]] as const) {
      expect(FIONDA.fasciaBordo.x * l).toBeGreaterThan(12);
      expect(FIONDA.fasciaBordo.x * l).toBeLessThan(35);
      expect(FIONDA.fasciaBordo.y * h).toBeGreaterThan(12);
      expect(FIONDA.fasciaBordo.y * h).toBeLessThan(35);
    }
  });
  it('lo stesso punto in proporzione dà la stessa zona sul recinto normale e su quello ingrandito', () => {
    const normale = { x0: 137, y0: 144, x1: 266, y1: 180 };
    const grande = { x0: 60, y0: 100, x1: 330, y1: 230 };
    const rel = [-0.85, -0.5, -0.1, 0, 0.2, 0.6, 0.99, 1, 1.2, 1.5, 1.8, 2.5];
    for (const fx of rel) for (const fy of rel) {
      const p = { x: grande.x0 + fx * (grande.x1 - grande.x0), y: grande.y0 + fy * (grande.y1 - grande.y0) };
      expect(zonaDi(riportaSuRecinto(p, grande, normale), normale), `${fx},${fy}`).toBe(zonaDi(p, grande));
    }
  });
  it('mai più degli agnellini del bersaglio', () => {
    expect(esitoTiro({ x: 200, y: 140 }, R, 1)).toBe(1);
    expect(esitoTiro({ x: 200, y: 140 }, R, 2)).toBe(2);
    expect(esitoTiro({ x: 310, y: 140 }, R, 3)).toBe(1);
    expect(esitoTiro({ x: 300 + BX + 10, y: 140 }, R, 3)).toBe(0);
  });
  it('numeri sui cerchi già limitati', () => {
    expect(valoriCerchi(3)).toEqual([3, 2, 1]);
    expect(valoriCerchi(1)).toEqual([1, 1, 1]);
    expect(valoriCerchi(2)).toEqual([2, 2, 1]);
  });
});

describe('fionda: la partenza con la sua variazione', () => {
  const base = { x: 195, y: 700 };
  it('sempre entro il raggio dalla base', () => {
    expect(FIONDA.variazionePartenza).toBeGreaterThan(0);
    for (let i = 0; i < 200; i++) {
      const p = partenzaDi(base, i / 200);
      expect(Math.hypot(p.x - base.x, p.y - base.y)).toBeLessThanOrEqual(FIONDA.variazionePartenza + 1e-9);
    }
  });
  it('variazioni diverse danno partenze diverse', () => {
    const punti = new Set([0.05, 0.3, 0.55, 0.8].map((v) => JSON.stringify(partenzaDi(base, v))));
    expect(punti.size).toBe(4);
  });
  it('la base: accanto alla pecora (alla destra di quella in basso, davanti ai piedi di quelle in alto)', () => {
    // La pecora di chi sta in basso (uguale con 2, 3 e 4 giocatori): cornice 2..126 × 524..629
    const inBasso = { x: 2, y: 524, w: 124 };
    const b = basePartenza(inBasso);
    expect(b.x).toBeCloseTo(inBasso.x + FIONDA.basePartenza.basso.x * inBasso.w, 6);
    expect(b.y).toBeCloseTo(inBasso.y + FIONDA.basePartenza.basso.y * inBasso.w, 6);
    // Alla sua destra (non sopra la testa né contro il bordo sinistro), con i piedi più in basso della sua testa e sopra il
    // consiglio (646) e la mano: il Montone le sta accanto
    expect(b.x).toBeGreaterThan(inBasso.x + inBasso.w + 60);
    expect(b.y).toBeGreaterThan(inBasso.y + 0.4 * inBasso.w);
    expect(b.y).toBeLessThan(620);
    // Un avversario in alto: davanti ai suoi piedi, verso la tovaglia, in mezzo alla pecora in larghezza
    const inAlto = { x: 4, y: 115, w: 72 };
    const a = basePartenza(inAlto);
    expect(a.x).toBeCloseTo(inAlto.x + FIONDA.basePartenza.alto.x * inAlto.w, 6);
    expect(a.y).toBeCloseTo(inAlto.y + FIONDA.basePartenza.alto.y * inAlto.w, 6);
    expect(a.x).toBeCloseTo(inAlto.x + inAlto.w / 2, 6);
    expect(a.y).toBeGreaterThan(inAlto.y + 0.79 * inAlto.w);
  });
  it('variazioneDaSeq: in [0,1), uguale per lo stesso seq, diversa per seq diversi', () => {
    const v = Array.from({ length: 20 }, (_, i) => variazioneDaSeq(i + 1));
    for (const x of v) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
    expect(variazioneDaSeq(7)).toBe(variazioneDaSeq(7));
    expect(new Set(v).size).toBeGreaterThanOrEqual(10);
  });
});

describe('fionda: punto di scena per gli altri telefoni', () => {
  const R = { x0: 100, y0: 100, x1: 300, y1: 180 };
  const RETT = [R, { x0: 137, y0: 144, x1: 266, y1: 180 }, { x0: 98, y0: 152, x1: 176, y1: 196 }, { x0: 63, y0: 114, x1: 120, y1: 150 }, { x0: 60, y0: 100, x1: 330, y1: 230 }];
  it.each([3, 2, 1, 0])('esito %i: il punto cade nella sua zona, per ogni seq e recinto', (esito) => {
    for (const r of RETT) for (let seq = 1; seq <= 40; seq++) expect(zonaDi(puntoDiScena(r, esito, seq), r), `${seq}`).toBe(esito);
  });
  it('esito 1: sulla staccionata (seq pari) o fuori nella fascia (seq dispari), dal lato giusto', () => {
    for (const r of RETT) for (let seq = 1; seq <= 40; seq++) {
      const p = puntoDiScena(r, 1, seq);
      if (seq % 2 === 0) expect(p.x === r.x0 || p.x === r.x1).toBe(true);
      else expect(p.x < r.x0 || p.x > r.x1).toBe(true);
    }
  });
  it('stesso seq, stesso punto', () => {
    expect(puntoDiScena(R, 2, 17)).toEqual(puntoDiScena(R, 2, 17));
  });
});

describe('fionda: scia e volo', () => {
  it('la scia copre il primo 40% e ha 7 puntini', () => {
    const s = scia({ x: 0, y: 0 }, { x: 0, y: -100 });
    expect(s).toHaveLength(7);
    expect(Math.min(...s.map((p) => p.y))).toBeCloseTo(-40);
  });
  it('il volo parte e arriva nei punti giusti, più alto a metà', () => {
    const a = { x: 0, y: 0 }, b = { x: 0, y: -100 };
    expect(posizioneInVolo(a, b, 0)).toMatchObject({ x: 0, y: 0, alto: 0 });
    expect(posizioneInVolo(a, b, 1)).toMatchObject({ x: 0, y: -100, alto: 0 });
    expect(posizioneInVolo(a, b, 0.5).alto).toBeCloseTo(35);
  });
  it('il volo non va oltre partenza e arrivo: t si limita a 0–1', () => {
    const a = { x: 0, y: 0 }, b = { x: 0, y: -100 };
    expect(posizioneInVolo(a, b, -0.5)).toEqual(posizioneInVolo(a, b, 0));
    expect(posizioneInVolo(a, b, 1.5)).toEqual(posizioneInVolo(a, b, 1));
  });
});

describe('fionda: il tiro riportato sul recinto normale', () => {
  // Il recinto ingrandito al tiro e lo stesso tornato normale
  const grande = { x0: 50, y0: 40, x1: 350, y1: 200 };
  const normale = { x0: 100, y0: 100, x1: 250, y1: 160 };
  it('in proporzione: il centro va al centro, la zona resta la stessa', () => {
    expect(riportaSuRecinto({ x: 200, y: 120 }, grande, normale)).toEqual({ x: 175, y: 130 });
    for (const p of [{ x: 200, y: 120 }, { x: 260, y: 120 }, { x: 330, y: 190 }, { x: 40, y: 120 }, { x: 200, y: 215 }]) {
      expect(zonaDi(riportaSuRecinto(p, grande, normale), normale), `${p.x},${p.y}`).toBe(zonaDi(p, grande));
    }
  });
  it('un punto fuori resta fuori, dalla stessa parte e alla stessa distanza relativa', () => {
    // 10% della larghezza a sinistra del bordo, a metà altezza
    expect(riportaSuRecinto({ x: 20, y: 120 }, grande, normale)).toEqual({ x: 85, y: 130 });
  });
  it('recinto di partenza senza misure: il punto si sposta con l\'angolo, senza NaN', () => {
    const piatto = { x0: 50, y0: 40, x1: 50, y1: 40 };
    expect(riportaSuRecinto({ x: 60, y: 45 }, piatto, normale)).toEqual({ x: 110, y: 105 });
  });
});

describe('fionda: chi sta sotto il Montone si scansa', () => {
  // Montone largo 80 nel punto d'arrivo: mezzo Montone (il raggio) 40, margine 4
  const A = { x: 100, y: 200 };
  const L = 80;
  it('i numeri: il raggio è mezzo Montone, il margine un poco', () => {
    expect(FIONDA.scansa.raggio).toBe(0.5);
    expect(FIONDA.scansa.margine).toBeGreaterThan(0);
    expect(FIONDA.scansa.margine).toBeLessThanOrEqual(0.1);
  });
  it('coperto: sotto il punto d\'arrivo, o con il corpo entro mezzo Montone; più in là no', () => {
    expect(coperto(A, L, { x: 100, y: 200, mezzo: 10 })).toBe(true);
    // Il corpo (largo 20) a 35 in orizzontale; a 41 no
    expect(coperto(A, L, { x: 145, y: 200, mezzo: 10 })).toBe(true);
    expect(coperto(A, L, { x: 151, y: 200, mezzo: 10 })).toBe(false);
    expect(coperto(A, L, { x: 49, y: 200, mezzo: 10 })).toBe(false);
    // Davanti e dietro: entro 40 sì, oltre no
    expect(coperto(A, L, { x: 100, y: 239, mezzo: 10 })).toBe(true);
    expect(coperto(A, L, { x: 100, y: 161, mezzo: 10 })).toBe(true);
    expect(coperto(A, L, { x: 100, y: 241, mezzo: 10 })).toBe(false);
    // In diagonale conta la distanza: (30, 30) è 42 dal corpo
    expect(coperto(A, L, { x: 140, y: 230, mezzo: 10 })).toBe(false);
  });
  it('scansa: di lato alla stessa profondità, quanto basta (raggio più margine), dalla parte più vicina', () => {
    const R = (FIONDA.scansa.raggio + FIONDA.scansa.margine) * L;
    const destra = { x: 110, y: 210, mezzo: 10 };
    const x = scansa(A, L, destra)!;
    expect(x).toBeCloseTo(A.x + 10 + Math.sqrt(R * R - 10 * 10), 6);
    expect(coperto(A, L, { ...destra, x })).toBe(false);
    // Appena fuori: con metà del margine sarebbe ancora fuori, senza margine sul bordo
    expect(coperto(A, L, { ...destra, x: x - (FIONDA.scansa.margine * L) / 2 })).toBe(false);
    const sinistra = { x: 95, y: 190, mezzo: 6 };
    expect(scansa(A, L, sinistra)).toBeCloseTo(A.x - 6 - Math.sqrt(R * R - 10 * 10), 6);
  });
  it('scansa: chi non è coperto resta dov\'è (null)', () => {
    expect(scansa(A, L, { x: 151, y: 200, mezzo: 10 })).toBeNull();
    expect(scansa(A, L, { x: 100, y: 241, mezzo: 10 })).toBeNull();
  });
  it('scansa: se da quella parte non c\'è posto (il bordo, il cartello) va dall\'altra; se da nessuna, resta', () => {
    const chi = { x: 90, y: 200, mezzo: 10 };
    const sinistra = scansa(A, L, chi)!;
    expect(sinistra).toBeLessThan(A.x);
    const destra = scansa(A, L, chi, (x) => x > 60)!;
    expect(destra).toBeGreaterThan(A.x);
    expect(destra - A.x).toBeCloseTo(A.x - sinistra, 6);
    expect(scansa(A, L, chi, () => false)).toBeNull();
  });
  it('scansa con `oltre`: dalla stessa parte, più in là di tanto; se così non c\'è posto da nessuna parte, quanto basta', () => {
    const chi = { x: 110, y: 210, mezzo: 10 };
    const base = scansa(A, L, chi)!;
    expect(scansa(A, L, chi, () => true, 12)).toBeCloseTo(base + 12, 6);
    // Più in là a destra non va: a sinistra, più in là di 12
    const sinistra = scansa(A, L, chi, (x) => x < base + 6, 12)!;
    expect(sinistra).toBeCloseTo(A.x - (base - A.x) - 12, 6);
    // Più in là non va da nessuna parte: quanto basta, dalla parte più vicina
    expect(scansa(A, L, chi, (x) => x < base + 6 && x > A.x - (base - A.x) - 6, 12)).toBeCloseTo(base, 6);
  });
  it('ventaglio: il primo non va più in là, gli altri sì, tutti diversi e meno di `scansa.ventaglio` larghezze', () => {
    expect(FIONDA.scansa.ventaglio).toBeGreaterThan(0);
    expect(FIONDA.scansa.ventaglio).toBeLessThanOrEqual(0.5);
    const v = Array.from({ length: 6 }, (_, i) => ventaglio(i));
    expect(v[0]).toBe(0);
    for (const q of v) {
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThan(FIONDA.scansa.ventaglio);
    }
    const ordinati = [...v].sort((a, b) => a - b);
    for (let i = 1; i < ordinati.length; i++) expect(ordinati[i]! - ordinati[i - 1]!).toBeGreaterThan(0.05 * FIONDA.scansa.ventaglio);
  });
  it('scansa: proprio sotto il punto d\'arrivo, verso il centro della scena (uguale su tutti i telefoni)', () => {
    expect(scansa(A, L, { x: 100, y: 200, mezzo: 10 })!).toBeGreaterThan(100);
    const B = { x: 300, y: 200 };
    expect(scansa(B, L, { x: 300, y: 200, mezzo: 10 })!).toBeLessThan(300);
  });
});

describe('fionda: c\'è spazio per tirare l\'elastico fino in fondo', () => {
  // I recinti della scena a 3 giocatori (aree a riposo, disposizioni.json) e la partenza vicino alla pecora in basso
  const BEA: Rett = { x0: 98, y0: 152, x1: 176, y1: 196 };
  const CLEO: Rett = { x0: 214, y0: 152, x1: 292, y1: 196 };
  const ADA: Rett = { x0: 150, y0: 528, x1: 372, y1: 632 };
  it('dal basso verso i recinti in alto (2, 3 e 4 giocatori): sì', () => {
    const P = { x: 198, y: 600 };
    expect(spazioPerTirare(P, BEA)).toBe(true);
    expect(spazioPerTirare(P, CLEO)).toBe(true);
    expect(spazioPerTirare(P, { x0: 137, y0: 144, x1: 266, y1: 180 })).toBe(true);
  });
  it('da una pecora in alto: no verso il basso (il dito finirebbe sui pulsanti in cima) né di lato (fuori dallo schermo)', () => {
    expect(spazioPerTirare({ x: 40, y: 183 }, ADA)).toBe(false);
    expect(spazioPerTirare({ x: 40, y: 183 }, CLEO)).toBe(false);
    expect(spazioPerTirare({ x: 350, y: 183 }, BEA)).toBe(false);
  });
  it('dal centro della tovaglia (la prima versione): sì, verso tutti', () => {
    for (const r of [BEA, CLEO, ADA]) expect(spazioPerTirare({ x: 195, y: 360 }, r)).toBe(true);
  });
  it('la misura: il punto del tiro pieno, dalla parte opposta al centro del recinto, resta dentro i margini', () => {
    const { lati, alto, basso } = FIONDA.spazioTiro;
    const sopra: Rett = { x0: 150, y0: 400, x1: 240, y1: 420 }; // il recinto sta sopra: si tira in giù
    expect(spazioPerTirare({ x: 195, y: H - basso - FIONDA.tiroMassimo - 1 }, sopra)).toBe(true);
    expect(spazioPerTirare({ x: 195, y: H - basso - FIONDA.tiroMassimo + 1 }, sopra)).toBe(false);
    const sotto: Rett = { x0: 150, y0: 700, x1: 240, y1: 720 }; // il recinto sta sotto: si tira in su
    expect(spazioPerTirare({ x: 195, y: alto + FIONDA.tiroMassimo + 1 }, sotto)).toBe(true);
    expect(spazioPerTirare({ x: 195, y: alto + FIONDA.tiroMassimo - 1 }, sotto)).toBe(false);
    const destra: Rett = { x0: 300, y0: 300, x1: 380, y1: 320 }; // alla stessa altezza: si tira a sinistra
    expect(spazioPerTirare({ x: lati + FIONDA.tiroMassimo + 1, y: 310 }, destra)).toBe(true);
    expect(spazioPerTirare({ x: lati + FIONDA.tiroMassimo - 1, y: 310 }, destra)).toBe(false);
  });
});

describe('fionda: il punto d\'arrivo disegnato resta sul prato', () => {
  const BEA: Rett = { x0: 98, y0: 152, x1: 176, y1: 196 };
  const CLEO: Rett = { x0: 214, y0: 152, x1: 292, y1: 196 };
  const P = { x: 198, y: 600 };
  const { prato, lati, alto } = FIONDA.atterraggio;
  const sulPrato = (p: Punto): void => {
    expect(p.y).toBeGreaterThanOrEqual(prato - 1e-9);
    expect(p.x).toBeGreaterThanOrEqual(lati - 1e-9);
    expect(p.x).toBeLessThanOrEqual(W - lati + 1e-9);
  };
  const dentro = (p: Punto, r: Rett): boolean => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
  it('i numeri: il prato comincia sotto la collina (y 154–162), i colpi restano sotto la striscia in cima', () => {
    expect(prato).toBeGreaterThanOrEqual(162);
    expect(prato).toBeLessThan(BEA.y1);
    expect(alto).toBeLessThan(prato);
  });
  it('un punto già sul prato (colpito o a vuoto) non cambia', () => {
    const colpo = { x: 137, y: 174 };
    expect(arrivoInScena(P, colpo, BEA, [CLEO])).toEqual(colpo);
    const corto = { x: 50, y: 260 };
    expect(zonaDi(corto, BEA)).toBe(0);
    expect(arrivoInScena(P, corto, BEA, [CLEO])).toEqual(corto);
  });
  it('un mancato fuori dallo schermo di lato torna indietro lungo la linea del volo, ancora a vuoto', () => {
    const vero = { x: -300, y: 120 };
    const p = arrivoInScena(P, vero, BEA, [CLEO]);
    sulPrato(p);
    expect(zonaDi(p, BEA)).toBe(0);
    // Sulla linea dalla partenza al punto vero
    expect((p.x - P.x) * (vero.y - P.y) - (p.y - P.y) * (vero.x - P.x)).toBeCloseTo(0, 6);
    expect(p.x).toBeCloseTo(lati, 6);
  });
  it.each([
    { nome: 'Bea, Cleo accanto', r: BEA, altri: [CLEO] },
    { nome: 'Cleo, Bea accanto', r: CLEO, altri: [BEA] },
    { nome: 'il recinto di 2 giocatori', r: { x0: 137, y0: 144, x1: 266, y1: 180 }, altri: [] },
  ])('un mancato lungo dietro un recinto in alto ($nome): sul prato, mai sulla collina, mai una zona 1, mai in un altro recinto', ({ r, altri }) => {
    const c = { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
    for (const dx of [-60, -20, 0, 20, 60]) {
      // Oltre il recinto, sulla linea dalla partenza: la collina, la casetta, il cielo
      const mira = { x: c.x + dx, y: c.y };
      const vero = { x: P.x + (mira.x - P.x) * 2, y: P.y + (mira.y - P.y) * 2 };
      expect(zonaDi(vero, r)).toBe(0);
      const p = arrivoInScena(P, vero, r, altri);
      sulPrato(p);
      expect(zonaDi(p, r), `${dx}`).toBe(0);
      for (const a of altri) expect(dentro(p, a), `${dx}`).toBe(false);
    }
  });
  it('anche il mancato lungo di scena (seq pari, oltre la staccionata dietro) atterra sul prato a vuoto', () => {
    for (const [r, altri] of [[BEA, [CLEO]], [CLEO, [BEA]]] as const) {
      for (const seq of [2, 4, 6, 8, 10, 12]) {
        const vero = puntoDiScena(r, 0, seq);
        const p = arrivoInScena(P, vero, r, [...altri]);
        sulPrato(p);
        expect(zonaDi(p, r)).toBe(0);
      }
    }
  });
});

describe('fionda: la corsa via', () => {
  const corpo = { mezzo: 40, alto: 50 };
  const A = { x: 150, y: 200 };
  it('senza nessuno in mezzo: dal lato chiesto', () => {
    expect(latoCorsa(A, corpo, [], -1)).toBe(-1);
    expect(latoCorsa(A, corpo, [], 1)).toBe(1);
  });
  it('una pecora sulla strada da una parte: dall\'altra', () => {
    const aSinistra: Rett = { x0: 20, y0: 160, x1: 70, y1: 195 };
    expect(latoCorsa(A, corpo, [aSinistra], -1)).toBe(1);
    expect(latoCorsa(A, corpo, [aSinistra], 1)).toBe(1);
  });
  it('pecore da tutte e due le parti: null (passa dietro)', () => {
    const aSinistra: Rett = { x0: 20, y0: 160, x1: 70, y1: 195 };
    const aDestra: Rett = { x0: 300, y0: 170, x1: 350, y1: 210 };
    expect(latoCorsa(A, corpo, [aSinistra, aDestra], -1)).toBeNull();
  });
  it('chi sta più in alto o più in basso della striscia della corsa non conta', () => {
    const sopra: Rett = { x0: 20, y0: 100, x1: 70, y1: 149 };
    const sotto: Rett = { x0: 20, y0: 201, x1: 70, y1: 260 };
    expect(latoCorsa(A, corpo, [sopra, sotto], -1)).toBe(-1);
    expect(strisciaCorsa(A, corpo, -1)).toEqual({ x0: -Infinity, y0: 150, x1: 190, y1: 200 });
    expect(strisciaCorsa(A, corpo, 1)).toEqual({ x0: 110, y0: 150, x1: Infinity, y1: 200 });
  });
});

describe('fionda: il colpo lungo (vola oltre e sparisce)', () => {
  // Un recinto in alto, come quello di un avversario a 3 giocatori, e la partenza accanto alla pecora in basso
  const R: Rett = { x0: 100, y0: 114, x1: 273, y1: 193 };
  const P: Punto = { x: 198, y: 600 };
  const sullaLinea = (q: Punto, a: Punto, b: Punto): number =>
    Math.abs((b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y);

  it('lungo: oltre il recinto, dove tornando indietro lungo la linea cadrebbe nella fascia (prima andava di lato)', () => {
    const vero = { x: 184, y: 52 };
    expect(zonaDi(vero, R)).toBe(0);
    expect(colpoLungo(P, vero, R)).toBe(true);
    // Prima: atterrava di lato, lontano dalla linea del tiro
    expect(sullaLinea(arrivoInScena(P, vero, R), P, vero)).toBeGreaterThan(50);
    // Non lunghi: un colpo, un mancato corto davanti, un mancato che atterra sulla linea, una linea che scende
    expect(colpoLungo(P, { x: 186, y: 150 }, R)).toBe(false);
    expect(colpoLungo(P, { x: 186, y: 300 }, R)).toBe(false);
    expect(colpoLungo(P, { x: 380, y: 200 }, R)).toBe(false);
    expect(colpoLungo({ x: 186, y: 40 }, { x: 186, y: 400 }, R)).toBe(false);
  });

  it('tirato al massimo: l\x27elastico pieno, o quasi (entro cielo.pieno)', () => {
    const m = FIONDA.tiroMassimo;
    expect(tiroPieno({ x: 0, y: m })).toBe(true);
    expect(tiroPieno({ x: m, y: 0 })).toBe(true);
    expect(tiroPieno({ x: 0, y: m - FIONDA.cielo.pieno })).toBe(true);
    expect(tiroPieno({ x: 0, y: m - FIONDA.cielo.pieno - 0.5 })).toBe(false);
  });

  it('sugli altri telefoni, nel cielo per circa cielo.quota dei seq: sempre lo stesso per lo stesso seq', () => {
    const scelte = Array.from({ length: 600 }, (_, s) => cieloDaSeq(s));
    expect(Array.from({ length: 600 }, (_, s) => cieloDaSeq(s))).toEqual(scelte);
    const quota = scelte.filter(Boolean).length / scelte.length;
    expect(quota).toBeGreaterThan(FIONDA.cielo.quota - 0.08);
    expect(quota).toBeLessThan(FIONDA.cielo.quota + 0.08);
  });

  it('il punto nel cielo sta sulla linea del tiro, ad altezza cielo.y, o prima al lato dello schermo', () => {
    const vero = { x: 150, y: 30 };
    const F = puntoInCielo(P, vero);
    expect(F.y).toBeCloseTo(FIONDA.cielo.y, 6);
    expect(sullaLinea(F, P, vero)).toBeLessThan(1e-9);
    const storto = { x: -300, y: 100 };
    const G = puntoInCielo(P, storto);
    expect(G.x).toBeCloseTo(FIONDA.atterraggio.lati, 6);
    expect(sullaLinea(G, P, storto)).toBeLessThan(1e-9);
  });

  it('esce dalla fascia del recinto: dritto su, dove la linea lascia la fascia dalla parte lontana', () => {
    const vero = { x: 186, y: 0 };
    const t = uscitaDallaFascia({ x: 186, y: 600 }, vero, R);
    const yUscita = R.y0 - FIONDA.fasciaBordo.y * (R.y1 - R.y0);
    expect(600 + (0 - 600) * t).toBeCloseTo(yUscita, 6);
    expect(uscitaDallaFascia({ x: 186, y: 600 }, { x: 186, y: 300 }, R)).toBe(0);
  });

  it('dietro la collina il volo finisce sulla linea appena uscito dalla fascia (di fuori), o prima se il punto vero è più vicino', () => {
    const vero = { x: 186, y: 0 };
    const E = fineDietroLaCollina({ x: 186, y: 600 }, vero, R);
    expect(E.x).toBeCloseTo(186, 9);
    expect(E.y).toBeCloseTo(R.y0 - FIONDA.fasciaBordo.y * (R.y1 - R.y0) - FIONDA.fuori, 6);
    expect(zonaDi(E, R)).toBe(0);
    const vicino = { x: 186, y: 70 };
    expect(fineDietroLaCollina({ x: 186, y: 600 }, vicino, R)).toEqual(vicino);
  });

  it('torna di corsa sul prato davanti al recinto, appena oltre la fascia (a vuoto)', () => {
    const y = yRitorno(R);
    expect(y).toBeCloseTo(R.y1 + FIONDA.fasciaBordo.y * (R.y1 - R.y0) + FIONDA.fuori, 6);
    expect(zonaDi({ x: (R.x0 + R.x1) / 2, y }, R)).toBe(0);
  });
});
