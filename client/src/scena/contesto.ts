// Contesto condiviso dai moduli della scena: il DOM, l'orologio, il caso, la regia e gli altri servizi.
// Ne esiste uno per teatro; `distruggi` esegue le `pulizie`.
import { Orologio } from './orologio';
import { piattaforma } from './piattaforma';
import type { ElementiScena } from './scheletro';
import { ascoltaOpzioni, opzioni } from './servizi/opzioni';
import { creaRegia, type Regia } from './servizi/regia';
import { creaRisparmio, type Risparmio } from './servizi/risparmio';
import { creaSuoni, Suono, type NomeSuono } from './servizi/suoni';

export type { NomeSuono };

export interface Contesto {
  el: ElementiScena;
  orologio: Orologio;
  /** Numero in [0, 1): di base `Math.random`, nelle prove un caso a seme fisso. */
  caso: () => number;
  /** L'utente preferisce meno movimento (letto all'avvio, poi segue i cambi del sistema). */
  ridotto: boolean;
  /** Tempo della scena in secondi (bozza, riga 941). */
  T: number;
  /** Quanto è sera, da 0 a 1 (bozza, riga 1192). */
  sera: number;
  /** Scala della scena e ingrandimento della mano (misure). */
  S: number;
  KD: number;
  /** Animazione della scena: segue la velocità della scena. */
  anima(el: Element, f: Keyframe[], o: KeyframeAnimationOptions): Animation;
  /** Animazione dell'interfaccia (mano, lettura, consigli): sempre a velocità 1. */
  animaInterfaccia(el: Element, f: Keyframe[], o: KeyframeAnimationOptions): Animation;
  /** Cambia la velocità della scena: orologio e animazioni già avviate (il punto in cui si trovano resta). */
  impostaVelocita(v: number): void;
  regia: Regia;
  risparmio: Risparmio;
  /** Chi sa se un meteo è attivo si registra qui (lo riempiono i moduli del meteo); la regia chiede a questa funzione. */
  meteoAttivo: () => boolean;
  /** Chi sa quali agnellini sono davvero in viaggio si registra qui (il branco); la regia chiede a questa funzione. */
  inViaggioValido: (g: unknown) => boolean;
  suona(nome: NomeSuono, ...a: number[]): void;
  vibra(nome: 'guaio' | 'beeeNo' | 'vittoria'): void;
  /** Eseguite da `distruggi`. */
  pulizie: Array<() => void>;
}

export function creaContesto(el: ElementiScena, o: { caso?: () => number } = {}): Contesto {
  const caso = o.caso ?? Math.random;
  const orologio = new Orologio();
  const animazioniScena = new Set<Animation>();
  const ctx: Contesto = {
    el,
    orologio,
    caso,
    ridotto: piattaforma.movimentoRidotto(),
    T: 0,
    sera: 0,
    S: 1,
    KD: 1,
    anima(elemento, f, opz) {
      const a = piattaforma.anima(elemento, f, opz);
      if (orologio.velocita !== 1) a.playbackRate = orologio.velocita;
      animazioniScena.add(a);
      const via = () => animazioniScena.delete(a);
      a.addEventListener('finish', via);
      a.addEventListener('cancel', via);
      return a;
    },
    animaInterfaccia(elemento, f, opz) {
      return piattaforma.anima(elemento, f, opz);
    },
    impostaVelocita(v) {
      if (v === orologio.velocita) return;
      orologio.velocita = v;
      // Assegnata subito (mantiene il punto in cui si trova l'animazione): updatePlaybackRate aspetterebbe il fotogramma dopo
      for (const a of animazioniScena) a.playbackRate = v;
    },
    regia: undefined as unknown as Regia,
    risparmio: creaRisparmio(el.scena),
    meteoAttivo: () => false,
    inViaggioValido: () => false,
    suona: () => undefined,
    vibra: () => undefined,
    pulizie: [],
  };
  // "Riduci movimento" cambiato a partita in corso: le animazioni avviate da qui in poi (che leggono `ridotto` quando
  // partono) lo rispettano; quelle già in corso finiscono come sono partite (il CSS invece si ferma o riparte subito)
  ctx.pulizie.push(piattaforma.seguiMovimentoRidotto((r) => (ctx.ridotto = r)));
  ctx.regia = creaRegia({ orologio, meteoAttivo: () => ctx.meteoAttivo(), inViaggioValido: (g) => ctx.inViaggioValido(g) });
  Suono.caso = caso;
  const suoni = creaSuoni(ctx.regia);
  ctx.suona = suoni.suona;
  ctx.vibra = suoni.vibra;
  // L'audio segue l'interruttore dei suoni; il beee di conferma tace durante il salto, come ogni suono
  let suoniAcceso = opzioni().suoni;
  ctx.pulizie.push(
    ascoltaOpzioni(() => {
      const acceso = opzioni().suoni;
      if (acceso === suoniAcceso) return;
      suoniAcceso = acceso;
      if (acceso) {
        Suono.accendi();
        ctx.suona('beee', 1);
      } else Suono.spegni();
    }),
  );
  return ctx;
}
