// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SETUP } from '../../../../engine/src';
import { T } from '../../testi';
import { contestoFinto } from '../aiuti-prova';
import { disposizione } from '../disposizioni';
import type { Fotografia, PostoFoto } from '../fotografia';
import { creaLettura } from '../lettura';
import { creaArea, type Area } from '../personaggi/aree';
import { Pecora } from '../personaggi/pecora';
import { creaCoperta, simboloFaccia } from './coperta';
import { creaPostazioni } from './postazioni';
import { spaziTarghe } from './targhe';
import { aggiornaCartello, aggiornaOmbreRecinti, creaCartelloGregge, creaRecinto } from './recinti';

const NOMI = ['Anna', 'Bruno', 'Carla', 'Dario'];
const PECORE = ['nerina', 'ricciolo', 'brontolana', 'sospirella'] as const;

function posto(i: number, sopra: Partial<PostoFoto> = {}): PostoFoto {
  return {
    id: `g${i + 1}`,
    nome: NOMI[i]!,
    pecora: PECORE[i]!,
    agnellini: 5,
    angolo: [],
    carteInMano: 5,
    eliminato: false,
    fuoriDalRound: false,
    deveAgire: false,
    giocata: null,
    unGuaioAllEliminazione: false,
    quasiPieno: false,
    ...sopra,
  };
}

function foto(n: 2 | 3 | 4, sopra: Partial<Fotografia> = {}, posti: Array<Partial<PostoFoto>> = []): Fotografia {
  return {
    posti: Array.from({ length: n }, (_, i) => posto(i, posti[i])),
    gregge: 20,
    postiOvile: 15,
    totaleAgnellini: 40,
    mano: null,
    mazzo: 40,
    mazzoGuai: 21,
    scarti: [],
    guaioRound: null,
    dado: null,
    round: 1,
    ultimoRound: false,
    ora: 'giorno',
    ...sopra,
  };
}

function montaPostazioni(n: 2 | 3 | 4 = 3) {
  const ctx = contestoFinto();
  const disp = disposizione(n);
  const lettura = creaLettura(ctx);
  const apri = vi.spyOn(lettura, 'apri');
  const post = creaPostazioni(ctx, disp, lettura);
  return { ctx, disp, lettura, apri, post, mondo: ctx.el.mondo };
}

const q = (r: ParentNode, s: string) => [...r.querySelectorAll<HTMLElement>(s)];

beforeAll(() => {
  // Lo sprite del pacchetto grafico, come lo inserisce `Sprite` nel gioco
  const sprite = readFileSync(resolve(process.cwd(), 'design/svg/sprite.svg'), 'utf8');
  const contenitore = document.createElement('div');
  contenitore.innerHTML = sprite;
  document.body.appendChild(contenitore);
});

afterEach(() => vi.restoreAllMocks());

describe('recinti e cartelli', () => {
  function recinto(nome = 'g1', n: 2 | 3 | 4 = 3) {
    const ctx = contestoFinto();
    const disp = disposizione(n);
    const a: Area = creaArea(nome, disp.posti[0]!.area, 15);
    creaRecinto(ctx, a, disp.posti[0]!.recinto);
    return { ctx, a, disp };
  }

  it('il cartello mostra "n/posti"', () => {
    const { a } = recinto();
    a.mostrati = 7;
    aggiornaCartello(a, 15);
    expect(a.cartello!.textContent).toBe('7/15');
    expect(a.cartello!.classList.contains('quasi')).toBe(false);
  });

  it('classe "quasi" quando mancano 3 posti o meno, non con 4', () => {
    const { a } = recinto();
    a.mostrati = 12;
    aggiornaCartello(a, 15);
    expect(a.cartello!.classList.contains('quasi')).toBe(true);
    a.mostrati = 11;
    aggiornaCartello(a, 15);
    expect(a.cartello!.classList.contains('quasi')).toBe(false);
    a.mostrati = 15;
    aggiornaCartello(a, 15);
    expect(a.cartello!.classList.contains('quasi')).toBe(true);
  });

  it('il cartello del gregge dice "Gregge n" e non è mai "quasi"', () => {
    const ctx = contestoFinto();
    const disp = disposizione(3);
    const g = creaArea('gregge', disp.gregge.area, Infinity);
    creaCartelloGregge(ctx, g, disp.gregge.cartello);
    g.mostrati = 32;
    aggiornaCartello(g, 15);
    expect(g.cartello!.textContent).toBe('Gregge 32');
    expect(g.cartello!.classList.contains('quasi')).toBe(false);
    expect(g.cartello!.classList.contains('piccolo')).toBe(true);
  });

  it('il recinto ha due strati (dietro e davanti) e il cartello nella scena, senza id', () => {
    const { ctx, a } = recinto('g2');
    const recinti = q(ctx.el.mondo, '.recinto');
    expect(recinti).toHaveLength(2);
    expect(recinti.every((r) => r.dataset.chi === 'g2')).toBe(true);
    expect(a.cartello!.dataset.chi).toBe('g2');
    expect(ctx.el.mondo.querySelectorAll('[id]')).toHaveLength(0);
    expect(a.recinto).toMatchObject({ x: 140, k: 1 });
  });

  it('un recinto con k piccolo ha il cartello "piccolo"', () => {
    const { ctx, disp } = recinto();
    const a = creaArea('g3', disp.posti[1]!.area, 15);
    creaRecinto(ctx, a, disp.posti[1]!.recinto);
    expect(a.cartello!.classList.contains('piccolo')).toBe(true);
  });

  it('le ombre seguono la luce quando vengono ridisegnate', () => {
    const ctx = contestoFinto();
    const disp = disposizione(3);
    const a = creaArea('g1', disp.posti[0]!.area, 15);
    creaRecinto(ctx, a, disp.posti[0]!.recinto, (h) => ({ x: 3 * h, y: 2 * h }));
    const ombre = () => q(ctx.el.mondo, '.ombra-recinto').map((p) => p.getAttribute('d'));
    const prima = ombre();
    expect(prima).toHaveLength(2);
    expect(prima[1]).toMatch(/^M0 0 L246 0 L/);
    aggiornaOmbreRecinti(a, (h) => ({ x: -h, y: h }));
    expect(ombre()).not.toEqual(prima);
    expect(ombre()[1]).toContain('L-22.0 22.0');
  });
});

describe('postazioni', () => {
  it('una targa per posto, con il nome giusto', () => {
    const { post, mondo } = montaPostazioni(3);
    post.aggiorna(foto(3));
    const targhe = q(mondo, '.targa');
    expect(targhe.map((t) => t.dataset.chi)).toEqual(['g1', 'g2', 'g3']);
    expect(targhe.map((t) => t.textContent)).toEqual(['Anna', 'Bruno', 'Carla']);
  });

  it('"turno" solo su chi deve agire', () => {
    const { post, mondo } = montaPostazioni(3);
    post.aggiorna(foto(3, {}, [{}, { deveAgire: true }, {}]));
    const turni = q(mondo, '.targa.turno').map((t) => t.dataset.chi);
    expect(turni).toEqual(['g2']);
    post.aggiorna(foto(3, {}, [{ deveAgire: true }, {}, { deveAgire: true }]));
    expect(q(mondo, '.targa.turno').map((t) => t.dataset.chi)).toEqual(['g1', 'g3']);
  });

  it('i nomi lunghi non allargano la targa (larghezza massima e ellissi nello stile)', () => {
    const css = readFileSync(resolve(process.cwd(), 'client/src/scena/scena.css'), 'utf8');
    expect(css).toMatch(/\.teatro \.targa[^{]*\{[^}]*max-width/);
    expect(css).toMatch(/\.teatro \.targa[^{]*\{[^}]*text-overflow:\s*ellipsis/);
  });

  it('nomi di 14 lettere: la targa ha il nome intero in title e aria-label, la larghezza del suo posto e il carattere piccolo', () => {
    const lunghi = ['Massimilianone', 'Giocatore 2', 'Giocatore 3', 'Bartolomeoaaaa'];
    for (const n of [2, 3, 4] as const) {
      const { post, mondo } = montaPostazioni(n);
      post.aggiorna(foto(n, {}, lunghi.slice(0, n).map((nome) => ({ nome }))));
      const spazi = spaziTarghe(disposizione(n));
      q(mondo, '.targa').forEach((t, i) => {
        expect(t.title).toBe(lunghi[i]);
        expect(t.getAttribute('aria-label')).toBe(lunghi[i]);
        expect(t.classList.contains('lunga')).toBe(true);
        expect(t.style.maxWidth).toBe(`${spazi[i]!.larghezza}px`);
        expect(t.getAttribute('style')).toContain('clamp(');
      });
      // I segnalini stanno nello stesso spazio della loro targa
      q(mondo, '.segnalini').forEach((s, i) => expect(s.style.maxWidth).toBe(`${spazi[i]!.larghezza}px`));
      post.distruggi();
    }
  });

  it('nome corto: niente carattere piccolo; eliminata: il nome intero resta nel title', () => {
    const { post, mondo } = montaPostazioni(3);
    post.aggiorna(foto(3, {}, [{}, { eliminato: true }, {}]));
    const [a, b] = q(mondo, '.targa');
    expect(a!.classList.contains('lunga')).toBe(false);
    expect(b!.title).toBe(`Bruno · ${T.tavolo.eliminata}`);
    // Il suffisso "· eliminata" non rimpicciolisce un nome corto
    expect(b!.classList.contains('lunga')).toBe(false);
  });

  it('segnalino "1 Guaio all\'eliminazione" presente o assente secondo la fotografia', () => {
    const { post, mondo } = montaPostazioni(3);
    post.aggiorna(foto(3, {}, [{}, { unGuaioAllEliminazione: true }, {}]));
    const segnalini = q(mondo, '.segnalino.un-guaio');
    expect(segnalini).toHaveLength(1);
    expect(segnalini[0]!.textContent).toContain(T.scena.segnalini.unGuaio);
    expect(segnalini[0]!.closest<HTMLElement>('[data-chi]')!.dataset.chi).toBe('g2');
    post.aggiorna(foto(3));
    expect(q(mondo, '.segnalino.un-guaio')).toHaveLength(0);
  });

  it('segnalino "Mancano n" con n = posti dell\'Ovile - agnellini', () => {
    const { post, mondo } = montaPostazioni(3);
    post.aggiorna(foto(3, {}, [{ agnellini: 13, quasiPieno: true }, {}, {}]));
    const s = q(mondo, '.segnalino.quasi-pieno');
    expect(s).toHaveLength(1);
    expect(s[0]!.textContent).toContain(T.scena.segnalini.quasiPieno(2));
    post.aggiorna(foto(3));
    expect(q(mondo, '.segnalino.quasi-pieno')).toHaveLength(0);
  });

  it('chi è eliminato: targa "eliminata", pecora svenuta, nessun segnalino né carte', () => {
    const { post, mondo } = montaPostazioni(3);
    post.aggiorna(foto(3, {}, [{}, { eliminato: true, agnellini: 0, unGuaioAllEliminazione: true, quasiPieno: true, carteInMano: 0 }, {}]));
    const targa = q(mondo, '.targa').find((t) => t.dataset.chi === 'g2')!;
    expect(targa.textContent).toContain(T.tavolo.eliminata);
    const reazione = post.pecore.get('g2')!.reazione;
    expect(reazione.style.transform).toContain('rotate(-80deg)');
    expect(post.pecore.get('g1')!.reazione.style.transform).toBe('');
    expect(q(mondo, '.segnalino').filter((s) => s.closest('[data-chi="g2"]'))).toHaveLength(0);
    expect(q(mondo, '.ventaglio[data-chi="g2"] i')).toHaveLength(0);
    // Rimessa in piedi se torna in gioco
    post.aggiorna(foto(3));
    expect(post.pecore.get('g2')!.reazione.style.transform).toBe('');
    expect(q(mondo, '.targa').find((t) => t.dataset.chi === 'g2')!.textContent).toBe('Bruno');
  });

  it('chi è fuori dal round: segnalino "Fuori dal round"', () => {
    const { post, mondo } = montaPostazioni(3);
    post.aggiorna(foto(3, {}, [{}, {}, { fuoriDalRound: true }]));
    const s = q(mondo, '.segnalino.fuori');
    expect(s).toHaveLength(1);
    expect(s[0]!.textContent).toBe(T.scena.fuoriDalRound);
  });

  it('carta del round coperta: un dorso e nessun nome di carta', () => {
    const { post, mondo } = montaPostazioni(3);
    post.aggiorna(foto(3, {}, [{}, { giocata: { coperta: true } }, {}]));
    const round = q(mondo, '.carte-round[data-chi="g2"] .carta-round');
    expect(round).toHaveLength(1);
    expect(round[0]!.innerHTML).toContain('#back-main');
    expect(round[0]!.textContent).toBe('');
    expect(q(mondo, '.carte-round[data-chi="g2"]')[0]!.outerHTML).not.toMatch(/sasso|calzino|SASSO|CALZINO/);
  });

  it('carte del round scoperte: si vedono i nomi e un tocco apre la lettura', () => {
    const { post, mondo, apri } = montaPostazioni(3);
    post.aggiorna(foto(3, {}, [{}, { giocata: { coperta: false, carte: ['sasso-comodo#1', 'calzino-gemello#2'] } }, {}]));
    const round = q(mondo, '.carte-round[data-chi="g2"] .carta-round');
    expect(round).toHaveLength(2);
    expect(round[0]!.textContent).toContain('SASSO COMODO');
    expect(round[1]!.textContent).toContain('CALZINO GEMELLO');
    round[1]!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(apri).toHaveBeenCalledWith('calzino-gemello#2', false);
  });

  it('la carta del round di chi sta in basso sta a sinistra della mano', () => {
    const { post, mondo } = montaPostazioni(3);
    post.aggiorna(foto(3, {}, [{ giocata: { coperta: true } }, {}, {}]));
    const c = q(mondo, '.carte-round[data-chi="g1"]')[0]!;
    expect(c.style.top).toBe('560px');
    const x = parseFloat(c.style.left);
    expect(x).toBeGreaterThanOrEqual(10);
    expect(x).toBeLessThanOrEqual(120);
  });

  it('la carta del round sparisce quando il round finisce', () => {
    const { post, mondo } = montaPostazioni(3);
    post.aggiorna(foto(3, {}, [{}, { giocata: { coperta: true } }, {}]));
    post.aggiorna(foto(3));
    expect(q(mondo, '.carta-round')).toHaveLength(0);
  });

  it('angoli: 2 Guai danno 2 mini-carte, una nuova fotografia con 1 ne lascia 1', () => {
    const { post, mondo, apri } = montaPostazioni(3);
    post.aggiorna(foto(3, {}, [{}, { angolo: ['grandine-a-sorpresa#1', 'lupo-vegetariano#1'] }, {}]));
    expect(q(mondo, '.mini[data-chi="g2"]')).toHaveLength(2);
    expect(q(mondo, '.mini[data-chi="g1"]')).toHaveLength(0);
    post.aggiorna(foto(3, {}, [{}, { angolo: ['lupo-vegetariano#1'] }, {}]));
    const mini = q(mondo, '.mini[data-chi="g2"]');
    expect(mini).toHaveLength(1);
    mini[0]!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(apri).toHaveBeenCalledWith('lupo-vegetariano#1', false);
  });

  it('l\'angolo di chi sta in basso ha le mini-carte grandi, a sinistra in basso', () => {
    const { post, mondo } = montaPostazioni(3);
    post.aggiorna(foto(3, {}, [{ angolo: ['grandine-a-sorpresa#1'] }, {}, {}]));
    const m = q(mondo, '.mini[data-chi="g1"]')[0]!;
    expect(m.style.left).toBe('10px');
    expect(m.style.top).toBe('626px');
    expect(m.style.width).toBe('38px');
  });

  it('ventagli degli avversari: solo dorsi, tanti quante le carte in mano', () => {
    const { post, mondo } = montaPostazioni(3);
    post.aggiorna(foto(3, {}, [{ carteInMano: 5 }, { carteInMano: 4 }, { carteInMano: 3 }]));
    expect(q(mondo, '.ventaglio[data-chi="g1"]')).toHaveLength(0);
    const v2 = q(mondo, '.ventaglio[data-chi="g2"] i');
    const v3 = q(mondo, '.ventaglio[data-chi="g3"] i');
    expect(v2).toHaveLength(4);
    expect(v3).toHaveLength(3);
    for (const i of [...v2, ...v3]) {
      expect(i.innerHTML).toContain('#back-main');
      expect(i.textContent).toBe('');
    }
    post.aggiorna(foto(3, {}, [{}, { carteInMano: 2 }, { carteInMano: 3 }]));
    expect(q(mondo, '.ventaglio[data-chi="g2"] i')).toHaveLength(2);
    // Lo sterrato c'è una volta sola per avversario
    expect(q(mondo, '.terreno')).toHaveLength(2);
  });

  it('niente nomi di carte coperte nel DOM: nel tavolo compaiono solo carte pubbliche', () => {
    const { post, mondo } = montaPostazioni(3);
    post.aggiorna(foto(3, { mano: ['sasso-comodo#1'] }, [{}, { giocata: { coperta: true } }, { giocata: { coperta: true } }]));
    expect(mondo.textContent).not.toMatch(/SASSO|CALZINO/i);
  });

  it('4 pecore con 4 giocatori, la terza specchiata come la disposizione', () => {
    const { post, mondo, disp } = montaPostazioni(4);
    post.aggiorna(foto(4));
    const pecore = q(mondo, '.pecora');
    expect(pecore).toHaveLength(4);
    expect(post.pecore.size).toBe(4);
    expect(disp.posti[3]!.specchia).toBe(true);
    const verso = (id: string) => post.pecore.get(id)!.verso;
    expect([verso('g1'), verso('g2'), verso('g3'), verso('g4')]).toEqual([1, 1, 1, -1]);
    expect(pecore[3]!.querySelector<SVGSVGElement>('svg')!.style.transform).toBe('scaleX(-1)');
    expect(pecore[0]!.querySelector<SVGSVGElement>('svg')!.style.transform).toBe('');
  });

  it('100 passi senza errori, anche dopo un cambio di fotografia', () => {
    const { ctx, post } = montaPostazioni(4);
    const errori = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    post.aggiorna(foto(4));
    for (let i = 0; i < 100; i++) {
      ctx.T += 0.033;
      ctx.orologio.avanza(33);
      post.passo(0.033);
      if (i === 50) post.aggiorna(foto(4, {}, [{}, { eliminato: true, agnellini: 0 }, {}, {}]));
    }
    expect(errori).not.toHaveBeenCalled();
  });

  it('una fotografia con altri giocatori ricostruisce le postazioni senza duplicati', () => {
    const { post, mondo } = montaPostazioni(3);
    post.aggiorna(foto(3));
    // Cambia chi sta in basso: stessi giocatori, ordine ruotato
    const f = foto(3);
    f.posti = [f.posti[1]!, f.posti[2]!, f.posti[0]!];
    post.aggiorna(f);
    expect(q(mondo, '.pecora')).toHaveLength(3);
    expect(q(mondo, '.targa').map((t) => t.textContent)).toEqual(['Bruno', 'Carla', 'Anna']);
    expect(q(mondo, '.terreno')).toHaveLength(2);
  });

  it('distruggi toglie tutto dalla scena', () => {
    const { post, mondo } = montaPostazioni(3);
    post.aggiorna(foto(3, {}, [{ giocata: { coperta: true }, angolo: ['grandine-a-sorpresa#1'] }, { unGuaioAllEliminazione: true }, {}]));
    post.fumetto('g2', 'Beee!');
    post.distruggi();
    expect(q(mondo, '.pecora, .targa, .segnalini, .terreno, .ventaglio, .mini, .carte-round, .fumetto')).toHaveLength(0);
  });

  it('il fumetto prende il posto del precedente', () => {
    const { post, mondo } = montaPostazioni(3);
    post.aggiorna(foto(3));
    post.fumetto('g2', 'Uno');
    post.fumetto('g2', 'Due');
    post.fumetto('g3', 'Tre');
    expect(q(mondo, '.fumetto').map((f) => f.textContent)).toEqual(['Due', 'Tre']);
  });
});

describe('Pecora', () => {
  it('senza lo sprite nella pagina funziona lo stesso (disegno di ripiego)', () => {
    // Si toglie l'id ai simboli dello sprite per un momento
    const salvati = [...document.querySelectorAll('symbol')].map((s) => [s, s.id] as const);
    salvati.forEach(([s]) => s.removeAttribute('id'));
    try {
      const ctx = contestoFinto();
      const p = new Pecora(ctx, 'g1', 'nerina', disposizione(3).posti[0]!);
      for (let i = 0; i < 20; i++) {
        ctx.T += 0.033;
        p.passo(0.033);
      }
      p.togli();
      expect(ctx.el.mondo.querySelectorAll('.pecora')).toHaveLength(0);
    } finally {
      salvati.forEach(([s, id]) => s.setAttribute('id', id));
    }
  });

  it('con lo sprite ha le quattro zampe e il vello smontati', () => {
    const ctx = contestoFinto();
    const p = new Pecora(ctx, 'g1', 'ricciolo', disposizione(3).posti[1]!);
    expect(p.svg.querySelectorAll('rect').length).toBeGreaterThanOrEqual(4);
    expect(p.svg.querySelectorAll('circle').length).toBeGreaterThan(5);
    expect(p.svg.querySelector('use')).toBeNull();
  });

  it('toccata salta e bela; reagisce con tutte le pose', () => {
    const ctx = contestoFinto();
    const suona = vi.spyOn(ctx, 'suona');
    const p = new Pecora(ctx, 'g1', 'ricciolo', disposizione(3).posti[1]!);
    const animazioni: string[] = [];
    const vera = ctx.anima.bind(ctx);
    vi.spyOn(ctx, 'anima').mockImplementation((el, f, o) => {
      animazioni.push(el.className);
      return vera(el, f, o);
    });
    p.el.dispatchEvent(new Event('pointerdown'));
    expect(suona).toHaveBeenCalledWith('beee', expect.any(Number));
    expect(animazioni).toContain('reazione');
    for (const tipo of ['salto', 'paura', 'scossa', 'svenuta', 'festa'] as const) p.reagisci(tipo);
    expect(animazioni.filter((c) => c === 'reazione')).toHaveLength(6);
  });

  it('fulmina: sbigottita per la durata, poi si scrolla', () => {
    const ctx = contestoFinto();
    const p = new Pecora(ctx, 'g1', 'nerina', disposizione(3).posti[0]!);
    p.fulmina(1);
    expect(p.shock).toBe(1);
    for (let i = 0; i < 60; i++) {
      ctx.T += 0.033;
      p.passo(0.033);
    }
    expect(p.shock).toBe(0);
    expect(p.bruciata).toBeGreaterThan(0);
  });
});

describe('coperta', () => {
  function montaCoperta() {
    const ctx = contestoFinto();
    const c = creaCoperta(ctx);
    return { ctx, c, el: ctx.el };
  }

  it('simboloFaccia: pascolo q, furto q, testata', () => {
    const per = (id: string) => simboloFaccia(SETUP.dado.find((f) => f.id === id)!);
    expect(per('pascolo_piccolo')).toBe('d-p3');
    expect(per('pascolo_grande')).toBe('d-p5');
    expect(per('furto_piccolo')).toBe('d-f2');
    expect(per('furto_grande')).toBe('d-f4');
    expect(per('testata')).toBe('d-testata');
  });

  it('diciture con i conti: "Mazzo 40", "Guai 21", "Scarti"', () => {
    const { c, el } = montaCoperta();
    c.aggiorna(foto(3));
    expect(el.dicMazzo.textContent).toBe('Mazzo 40');
    expect(el.dicGuai.textContent).toBe('Guai 21');
    expect(el.coperta.querySelector('.dic-scarti')!.textContent).toBe(T.scena.scarti);
  });

  it('le pile hanno il dorso in cima; vuote mostrano il segno del vuoto', () => {
    const { c, el } = montaCoperta();
    c.aggiorna(foto(3));
    expect(el.mazzo.querySelector('.strato.cima')!.innerHTML).toContain('#back-main');
    expect(el.mazzoGuai.querySelector('.strato.cima')!.innerHTML).toContain('#back-guai');
    expect(el.mazzo.querySelectorAll('.strato').length).toBe(1 + 14);
    c.aggiorna(foto(3, { mazzo: 0, mazzoGuai: 0 }));
    expect(el.mazzo.querySelector('.vuoto')).not.toBeNull();
    expect(el.mazzoGuai.querySelector('.vuoto')).not.toBeNull();
    expect(el.dicMazzo.textContent).toBe('Mazzo 0');
  });

  it('scarti: al massimo 6, la cima per ultima; vuoto senza carte', () => {
    const { c, el } = montaCoperta();
    c.aggiorna(foto(3));
    expect(el.scarti.querySelector('.vuoto')).not.toBeNull();
    const carte = ['sasso-comodo#1', 'calzino-gemello#1', 'beee-no#1', 'ombrello-bucato#1', 'finta-svenuta#1', 'campanaccio-stonato#1', 'belato-di-gruppo#1'];
    c.aggiorna(foto(3, { scarti: carte }));
    expect(el.scarti.querySelectorAll('.scarto').length).toBeLessThanOrEqual(6);
    c.aggiorna(foto(3, { scarti: carte.slice(1) }));
    const scarti = [...el.scarti.querySelectorAll<HTMLElement>('.scarto')];
    expect(scarti).toHaveLength(6);
    expect(scarti[5]!.textContent).toContain('BELATO DI GRUPPO');
    expect(el.scarti.querySelector('.vuoto')).toBeNull();
  });

  it('angolo e spostamento degli scarti sono stabili: dipendono dall\'id, non dal caso', () => {
    const una = montaCoperta();
    const due = montaCoperta();
    const carte = ['sasso-comodo#1', 'beee-no#2'];
    una.c.aggiorna(foto(3, { scarti: carte }));
    // Un'altra scena, un'altra sequenza di caso, un aggiornamento in più: stessa posa
    due.c.aggiorna(foto(3, { scarti: ['beee-no#2'] }));
    due.c.aggiorna(foto(3, { scarti: carte }));
    const t = (x: typeof una) => [...x.el.scarti.querySelectorAll<HTMLElement>('.scarto')].map((s) => s.style.transform.replace(/translateZ\([^)]*\)/, ''));
    const trasformate = t(una);
    expect(trasformate).toHaveLength(2);
    expect(trasformate[0]).toMatch(/translate\(-?[\d.]+px,-?[\d.]+px\).*rotate\(-?[\d.]+deg\)/);
    expect(trasformate[0]).not.toBe(trasformate[1]);
    // L'ordine nel DOM può differire (le carte nuove si aggiungono in fondo): conta la posa di ciascuna
    expect([...t(due)].sort()).toEqual([...trasformate].sort());
  });

  it('il Guaio del round è scoperto accanto al mazzo dei Guai', () => {
    const { c, el } = montaCoperta();
    c.aggiorna(foto(3));
    expect(el.coperta.querySelector('.guaio-round')).toBeNull();
    c.aggiorna(foto(3, { guaioRound: 'grandine-a-sorpresa#1' }));
    const g = el.coperta.querySelector('.guaio-round')!;
    expect(g.textContent).toContain('GRANDINE A SORPRESA');
    c.aggiorna(foto(3));
    expect(el.coperta.querySelector('.guaio-round')).toBeNull();
  });

  it('il dado fermo mostra la faccia dell\'ultimo lancio, o la prima senza lancio', () => {
    const { c, el } = montaCoperta();
    expect(el.dado.querySelectorAll('.fd')).toHaveLength(6);
    c.aggiorna(foto(3));
    expect(el.dado.dataset.faccia).toBe('d-p3');
    c.aggiorna(foto(3, { dado: 'furto_grande' }));
    expect(el.dado.dataset.faccia).toBe('d-f4');
    expect(el.dado.style.transform).toContain('rotateY(90deg)');
    c.aggiorna(foto(3, { dado: 'testata' }));
    expect(el.dado.dataset.faccia).toBe('d-testata');
    c.dado('pascolo_grande');
    expect(el.dado.dataset.faccia).toBe('d-p5');
    c.dado(null);
    expect(el.dado.dataset.faccia).toBe('d-p3');
  });

  it('i tocchi non fanno niente su mazzo, mazzo dei Guai e dado', () => {
    const { c, el } = montaCoperta();
    c.aggiorna(foto(3));
    const prima = el.coperta.innerHTML + el.dado.outerHTML;
    for (const e of [el.mazzo, el.mazzoGuai, el.dadoPos]) e.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(el.coperta.innerHTML + el.dado.outerHTML).toBe(prima);
  });

  it('distruggi toglie le carte aggiunte e lascia la coperta pulita', () => {
    const { c, el } = montaCoperta();
    c.aggiorna(foto(3, { scarti: ['sasso-comodo#1'], guaioRound: 'grandine-a-sorpresa#1' }));
    c.distruggi();
    expect(el.coperta.querySelector('.guaio-round')).toBeNull();
    expect(el.scarti.querySelector('.scarto')).toBeNull();
  });
});
