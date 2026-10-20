// Suoni creati in codice, vibrazione e ritmi (bozza scena.src.html, righe 467–561).
// Il campanaccio periodico è l'unica eccezione al tempo della scena: usa il tempo vero.
import { piattaforma } from '../piattaforma';
import { opzioni } from './opzioni';
import type { Regia } from './regia';

export type NomeSuono =
  | 'campanaccio' | 'beee' | 'colpo' | 'fruscio' | 'dado' | 'tono' | 'pop' | 'tonfo' | 'fanfara'
  | 'ticchettio' | 'tuono' | 'pioggiaInizia' | 'pioggiaFine' | 'folata';

export class GeneratoreSuoni {
  ctx: AudioContext | null = null;
  attivo = false;
  uscita: GainNode | null = null;
  buf: AudioBuffer | null = null;
  pioggia: { s: AudioBufferSourceNode; g: GainNode } | null = null;
  /** Il caso dei suoni: lo imposta il contesto (`ctx.caso`); di base niente variazioni. */
  caso: () => number = () => 0.5;
  private campanaccioPeriodico: ReturnType<typeof setInterval> | null = null;

  private rand(a: number, b: number): number {
    return a + this.caso() * (b - a);
  }

  accendi(): void {
    if (!this.ctx) {
      const c = piattaforma.audio();
      if (!c) return;
      this.ctx = c;
      this.uscita = c.createGain();
      this.uscita.connect(c.destination);
      this.vento();
    } else if (!this.campanaccioPeriodico) this.avviaCampanaccio();
    this.ctx.resume();
    this.attivo = true;
    this.uscita!.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.1);
  }

  spegni(): void {
    this.attivo = false;
    if (this.ctx && this.uscita) this.uscita.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  /** Ferma il campanaccio periodico, spegne e sospende il contesto audio (il vento in loop non gira più): per quando il teatro non c'è più. */
  ferma(): void {
    this.fermaCampanaccio();
    this.spegni();
    this.sospendiContesto();
  }

  /** Scena nascosta (la prova mentre si leggono le Regole): contesto audio e campanaccio fermi, senza spegnere i suoni. */
  sospendi(): void {
    this.fermaCampanaccio();
    this.sospendiContesto();
  }

  /** Fine della pausa: l'audio riparte solo se i suoni erano accesi (chi chiama controlla anche le Opzioni). */
  riprendi(): void {
    if (!this.attivo || !this.ctx) return;
    this.ctx.resume()?.catch?.(() => {});
    if (!this.campanaccioPeriodico) this.avviaCampanaccio();
  }

  private fermaCampanaccio(): void {
    if (this.campanaccioPeriodico) clearInterval(this.campanaccioPeriodico);
    this.campanaccioPeriodico = null;
  }

  private sospendiContesto(): void {
    try {
      this.ctx?.suspend()?.catch?.(() => {});
    } catch {
      /* audio non disponibile */
    }
  }

  private avviaCampanaccio(): void {
    this.campanaccioPeriodico = setInterval(() => {
      if (this.attivo && this.caso() < 0.55) this.campanaccio(0.35);
    }, 8000);
  }

  rumore(): AudioBuffer {
    if (this.buf) return this.buf;
    const c = this.ctx!;
    const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = this.caso() * 2 - 1;
    return (this.buf = b);
  }

  inviluppo(g: GainNode, t: number, picco: number, att: number, dur: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(picco, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  vento(): void {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.rumore();
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    const g = c.createGain();
    g.gain.value = 0.03;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.11;
    const lg = c.createGain();
    lg.gain.value = 0.022;
    lfo.connect(lg);
    lg.connect(g.gain);
    s.connect(f);
    f.connect(g);
    g.connect(this.uscita!);
    s.start();
    lfo.start();
    this.avviaCampanaccio();
  }

  campanaccio(vol = 1): void {
    const c = this.ctx!;
    const t = c.currentTime;
    for (const [fq, a] of [[540, 1], [1290, 0.45], [2170, 0.2]] as const) {
      const o = c.createOscillator();
      o.frequency.value = fq * this.rand(0.98, 1.02);
      const g = c.createGain();
      this.inviluppo(g, t, 0.05 * a * vol, 0.004, 1.5);
      o.connect(g);
      g.connect(this.uscita!);
      o.start(t);
      o.stop(t + 1.6);
    }
  }

  beee(alto = 1): void {
    const c = this.ctx!;
    const t = c.currentTime;
    const base = this.rand(210, 250) * alto;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * 1.1, t + 0.09);
    o.frequency.linearRampToValueAtTime(base * 0.9, t + 0.5);
    const v = c.createOscillator();
    v.frequency.value = 7.5;
    const vg = c.createGain();
    vg.gain.value = base * 0.06;
    v.connect(vg);
    vg.connect(o.frequency);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1050 * alto;
    f.Q.value = 2.2;
    const g = c.createGain();
    this.inviluppo(g, t, 0.2, 0.05, 0.62);
    o.connect(f);
    f.connect(g);
    g.connect(this.uscita!);
    o.start(t);
    v.start(t);
    o.stop(t + 0.65);
    v.stop(t + 0.65);
  }

  colpo(freq: number, q: number, vol: number, dur: number, quando = 0): void {
    const c = this.ctx!;
    const t = c.currentTime + quando;
    const s = c.createBufferSource();
    s.buffer = this.rumore();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    this.inviluppo(g, t, vol, 0.003, dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.uscita!);
    s.start(t, this.rand(0, 1.5));
    s.stop(t + dur + 0.05);
  }

  fruscio(): void {
    this.colpo(3200, 0.6, 0.14, 0.2);
  }

  dado(): void {
    for (let i = 0; i < 7; i++) this.colpo(2400 + this.rand(-400, 400), 3, 0.25 * (1 - i / 8), 0.05, 0.05 + i * 0.07 + i * i * 0.012);
  }

  tono(f0: number, f1: number, tipo: OscillatorType, vol: number, dur: number, quando = 0): void {
    const c = this.ctx!;
    const t = c.currentTime + quando;
    const o = c.createOscillator();
    o.type = tipo;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    this.inviluppo(g, t, vol, 0.01, dur);
    o.connect(g);
    g.connect(this.uscita!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  pop(): void {
    this.tono(520, 980, 'sine', 0.07, 0.09);
  }

  tonfo(): void {
    this.tono(150, 48, 'sine', 0.35, 0.35);
  }

  fanfara(): void {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tono(f, f * 1.01, 'triangle', 0.09, 0.22, i * 0.13));
  }

  ticchettio(): void {
    this.colpo(3800 + this.rand(-600, 600), 5, 0.05, 0.03);
  }

  tuono(): void {
    const c = this.ctx!;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.rumore();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 1.8);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    s.connect(f);
    f.connect(g);
    g.connect(this.uscita!);
    s.start(t);
    s.stop(t + 2.5);
  }

  pioggiaInizia(): void {
    if (this.pioggia) return;
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.rumore();
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1400;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.linearRampToValueAtTime(0.07, c.currentTime + 1.5);
    s.connect(f);
    f.connect(g);
    g.connect(this.uscita!);
    s.start();
    this.pioggia = { s, g };
  }

  pioggiaFine(): void {
    if (!this.pioggia) return;
    const { s, g } = this.pioggia;
    const t = this.ctx!.currentTime;
    g.gain.setTargetAtTime(0.0001, t, 0.5);
    s.stop(t + 2.5);
    this.pioggia = null;
  }

  folata(forza = 1, durata = 2.4): void {
    const c = this.ctx!;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.rumore();
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.7;
    f.frequency.setValueAtTime(380, t);
    f.frequency.linearRampToValueAtTime(900, t + durata * 0.45);
    f.frequency.linearRampToValueAtTime(420, t + durata);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09 * forza, t + durata * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durata);
    s.connect(f);
    f.connect(g);
    g.connect(this.uscita!);
    s.start(t);
    s.stop(t + durata + 0.1);
  }
}

/** Uno solo per pagina, come le opzioni (il browser concede pochi contesti audio). */
export const Suono = new GeneratoreSuoni();

/** Vibrazione per i momenti forti, dove il telefono lo permette (in pratica Android) e se non è spenta nelle Opzioni. */
export const RITMI = { guaio: [60, 50, 60], beeeNo: [140], vittoria: [80, 60, 80, 60, 220] } as const;

/** Mentre si salta tacciono tutti i suoni, tranne quelli che ne fermano un altro (se no lo scroscio della pioggia resterebbe acceso). */
const SUONI_CHE_FERMANO = new Set<NomeSuono>(['pioggiaFine']);

type SuonoUsabile = Pick<GeneratoreSuoni, 'attivo' | 'ctx'> & Partial<Record<NomeSuono, (...a: any[]) => void>>;

export interface Suoni {
  suona(nome: NomeSuono, ...a: number[]): void;
  /** Parte all'inizio dell'evento: saltarlo non la ripete e non la toglie. */
  vibra(nome: keyof typeof RITMI): void;
}

/** `suono` si cambia solo nelle prove. */
export function creaSuoni(regia: Pick<Regia, 'salto'>, suono: SuonoUsabile = Suono): Suoni {
  return {
    suona(nome, ...a) {
      if (regia.salto && !SUONI_CHE_FERMANO.has(nome)) return;
      if (!suono.attivo || !suono.ctx) return;
      try {
        suono[nome]?.(...a);
      } catch {
        /* audio non disponibile */
      }
    },
    vibra(nome) {
      if (!piattaforma.puoVibrare() || !opzioni().vibrazione) return;
      piattaforma.vibra([...RITMI[nome]]);
    },
  };
}
