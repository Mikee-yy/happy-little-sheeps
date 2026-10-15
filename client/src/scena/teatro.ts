// Il teatro: l'unico punto d'accesso alla scena. Mette insieme scheletro, contesto, ambiente, branco, tavolo, mano e ciclo.
// `allinea` mette in pari la scena con una fotografia della partita (la verità è sempre il motore).
// Bozza scena.src.html: righe 343–352 (scala), 1128–1143 (costruzione del tavolo), 1510–1547 (ciclo),
// 2596–2635 (preparazione della partita, senza le regole finte) e 2660–2709 (tocchi e avvio).
import type { IdCarta, IdGiocatore, Luogo } from '../../../engine/src';
import { creaAmbiente, type Ambiente } from './ambiente/indice';
import { creaCamera } from './camera';
import { creaCiclo, type Ciclo } from './ciclo';
import { creaContesto, type Contesto } from './contesto';
import { disposizione, type Disposizione } from './disposizioni';
import type { Fotografia } from './fotografia';
import { creaLettura } from './lettura';
import { creaMano } from './mano';
import { creaMeteo, ELEMENTI_METEO } from './meteo/indice';
import { misuraDito, H, W } from './misure';
import { creaOrdini, ELEMENTI_ORDINI, type Ordini } from './ordini';
import type { Palco } from './palco';
import { creaAree, profondita, type Area } from './personaggi/aree';
import { Branco } from './personaggi/branco';
import { aggiornaFumetti, togliFumetti } from './personaggi/pecora';
import { piattaforma } from './piattaforma';
import { creaScheletro } from './scheletro';
import { creaConsigli } from './servizi/consigli';
import { opzioni, preparaSbloccoAudio } from './servizi/opzioni';
import { Suono } from './servizi/suoni';
import { creaCoperta } from './tavolo/coperta';
import { creaPostazioni, type Postazioni } from './tavolo/postazioni';
import { aggiornaCartello, aggiornaOmbreRecinti, creaCartelloGregge, creaRecinto, togliRecinto } from './tavolo/recinti';

export interface OpzioniTeatro {
  ciclo?: 'automatico' | 'manuale';
  /** false: niente erba, nuvole, particelle (prove veloci). */
  ambiente?: boolean;
  caso?: () => number;
  /** false: niente giochi tra agnellini (prove: chi è in regia lo è solo per gli ordini). */
  giochi?: boolean;
}

export interface StatoMostrato {
  n: number;
  inBasso: IdGiocatore | null;
  agnellini: Record<Luogo, { assegnati: number; mostrati: number }>;
  inViaggio: number;
  intrappolati: number;
  inRegia: number;
  /** Agnellini liberi fuori dal loro recinto (per le prove: a fine evento sempre 0). */
  fuori: number;
  /** Ingrandimento dell'inquadratura (1 senza zoom). */
  zoom: number;
  /** Postazioni nascoste dalla messa a fuoco della camera. */
  postazioniNascoste: number;
  /** Recinti con una forma diversa da quella di partenza (allargati dalla camera). */
  recintiAlterati: number;
  angoli: Record<IdGiocatore, IdCarta[]>;
  mano: IdCarta[] | null;
  /** Particelle vive sul prato (prove del modo leggero: al massimo 60). */
  particelle: number;
}

export interface Teatro {
  allinea(f: Fotografia, modo: 'calmo' | 'subito'): void;
  /** Solo con ciclo manuale: passi da 33 ms (orologio + scena). */
  avanza(ms: number): void;
  eventoInCorso(): boolean;
  salta(): void;
  stato(): StatoMostrato;
  /** Rimette i suggerimenti dall'inizio e toglie il segno dei visti (menu Opzioni, "Rivedi i suggerimenti"). */
  rivediSuggerimenti(): void;
  /**
   * Rifà la scala della scena e la tela delle particelle con le misure di adesso della radice. Da sola la scena si adatta
   * alla creazione e al resize della finestra: chi la monta lo chiama quando la radice cambia misura o torna visibile.
   */
  adatta(): void;
  /** Ciclo automatico: `true` ferma i fotogrammi senza distruggere niente (scena nascosta), `false` li fa ripartire. */
  sospendi(sospeso: boolean): void;
  distruggi(): void;
  /** Le animazioni che la regia della partita chiede: meteo, Guai, dado, Testata, Beee-NO!, zoom. */
  readonly ordini: Ordini;
  /** Il contesto condiviso dai moduli: per i moduli della scena (sviluppo) e per le prove. */
  readonly ctx: Contesto;
}

/** Dove un tocco non salta l'evento: l'interfaccia, compresi i pannelli Opzioni e Prova eventi (bozza, riga 387), e la tovaglia con le sue pile (riga 2678). */
const INTERFACCIA = '.mano, .hud, .opzioni, .eventi, .lettura, .finale';
const TOVAGLIA = '.coperta, .mazzo, .mazzo-guai, .dado-pos, .scarti';
/** Elementi di passaggio da togliere quando il tavolo si ricostruisce (bozza, riga 2602). */
const DI_PASSAGGIO = `.decoro, .zeta, .fumetto, ${ELEMENTI_ORDINI}, ${ELEMENTI_METEO}`;
/** Dissolvenza delle carte della mano che compaiono o spariscono. */
const DISSOLVENZA_MANO_MS = 200;

export function creaTeatro(radice: HTMLElement, o: OpzioniTeatro = {}): Teatro {
  const el = creaScheletro(radice);
  const ctx = creaContesto(el, { caso: o.caso });
  const conAmbiente = o.ambiente !== false;

  // Servizi dell'interfaccia: consigli, lettura, mano, coperta
  const consigli = creaConsigli({ elemento: el.consiglio });
  consigli.applicaGiaVisti();
  const lettura = creaLettura(ctx, { alApertura: () => consigli.nascondi(2) });
  const mano = creaMano(ctx, lettura);
  const coperta = creaCoperta(ctx);
  ctx.pulizie.push(
    () => consigli.ferma(),
    () => Suono.ferma(),
  );
  // I suoni salvati come accesi partono al primo gesto (bozza, riga 2691)
  if (opzioni().suoni) ctx.pulizie.push(preparaSbloccoAudio(Suono));

  // Il tavolo: si costruisce alla prima fotografia
  let ambiente: Ambiente | null = null;
  let branco: Branco | null = null;
  let postazioni: Postazioni | null = null;
  let disp: Disposizione | null = null;
  let aree: Area[] = [];
  let assetto = '';
  let postiOvile = 0;
  let ultima: Fotografia | null = null;
  let distrutto = false;
  let passo30 = 0;
  /** Cresce a ogni ricostruzione: gli ordini in corso sul tavolo di prima si fermano. */
  let generazione = 0;
  const fantasmi = new Set<Element>();

  // Scala della scena (bozza, righe 343–348): senza misure (jsdom, radice nascosta) resta com'è
  function adatta(): void {
    const w = el.schermo.clientWidth;
    const h = el.schermo.clientHeight;
    if (!w || !h) return;
    const m = misuraDito(w, h);
    ctx.S = m.S;
    ctx.KD = m.D / m.S;
    el.scena.style.transform = `translate(${(w - W * ctx.S) / 2}px, ${h - H * ctx.S}px) scale(${ctx.S})`;
    el.scena.style.setProperty('--kd', ctx.KD.toFixed(4));
  }
  const suResize = (): void => {
    adatta();
    ambiente?.adattaTela();
  };

  // Il palco: ciò che camera, meteo e ordini leggono del tavolo di adesso
  const giocatori = (): IdGiocatore[] => aree.filter((a) => a.nome !== 'gregge').map((a) => a.nome);
  const postoFoto = (chi: IdGiocatore) => ultima?.posti.find((p) => p.id === chi);
  const palco: Palco = {
    ctx,
    coperta,
    amb: () => ambiente,
    branco: () => branco,
    giocatori,
    inBasso: () => giocatori()[0] ?? null,
    area: (l) => aree.find((a) => a.nome === l),
    posto(chi) {
      const i = giocatori().indexOf(chi);
      return i >= 0 ? disp?.posti[i] : undefined;
    },
    razza: (chi) => postoFoto(chi)?.pecora,
    pecora: (chi) => postazioni?.pecore.get(chi),
    agnelli: () => branco?.agnelli ?? [],
    profondita: (y) => (ambiente ? ambiente.profondita(y) : profondita(y, disp?.prospettiva ?? [170, 0.5])),
    particella(tipo, x, y, opz) {
      ambiente?.particella(tipo, x, y, opz);
    },
    fumetto: (chi, testo, ms) => postazioni?.fumetto(chi, testo, ms),
    reagisci: (chi, tipo) => postazioni?.pecore.get(chi)?.reagisci(tipo),
    angolo: (chi) => [...(postoFoto(chi)?.angolo ?? [])],
    aggiungiAngolo(chi, carta) {
      const f = ultima;
      const p = postoFoto(chi);
      if (!f || !p || p.angolo.includes(carta)) return;
      // L'angolo mostrato ha una carta in più; la fotografia successiva lo conferma (aggiorna è idempotente)
      ultima = { ...f, posti: f.posti.map((q) => (q.id === chi ? { ...q, angolo: [...q.angolo, carta] } : q)) };
      postazioni?.aggiorna(ultima);
      camera.riapplica();
    },
    generazione: () => generazione,
  };
  const camera = creaCamera(palco);
  const meteo = creaMeteo(palco, camera);
  const ordini = creaOrdini(palco, camera, meteo);

  /** Un passo della scena (bozza, righe 1536–1546). */
  function passoScena(dt: number, ora: number): void {
    ctx.T += dt;
    ambiente?.passo(dt);
    meteo.passo(dt);
    passo30 += dt;
    // Erba e nuvole 30 volte al secondo (15 in modo leggero)
    if (passo30 >= (ctx.risparmio.leggero ? 1 / 15 : 1 / 30)) {
      ambiente?.passo30(passo30);
      passo30 = 0;
    }
    // Prima i recinti che cambiano forma, poi gli agnellini: così la staccionata li spinge dentro nello stesso fotogramma
    camera.passo(dt);
    postazioni?.passo(dt);
    branco?.passo(dt, ora);
    ambiente?.aggiornaParticelle(dt);
  }

  const zoom = (): number => camera.zoom();
  const ciclo: Ciclo = creaCiclo(ctx, {
    modo: o.ciclo ?? 'automatico',
    passoScena,
    dopoFotogramma: () => aggiornaFumetti(ctx, zoom),
    // Un fotogramma rotto può aver lasciato la scena a metà: si rimette in pari subito con l'ultima fotografia
    onErrore: () => {
      if (ultima && !distrutto) ricostruisci(ultima, assetto);
    },
  });

  // Tocchi (bozza, righe 2669–2680)
  const sveglia = (): void => ctx.risparmio.tocco(ciclo.ora());
  const toccoSalto = (e: Event): void => {
    const t = e.target as Element | null;
    if (!ctx.regia.eventoInCorso() || t?.closest?.(INTERFACCIA) || mano.attiva() !== null) return;
    if (!t?.closest?.(TOVAGLIA)) ctx.regia.salta();
  };
  const toccoScena = (): void => mano.abbassa();
  // Il primo consiglio ("solleva") se ne va quando si solleva una carta
  const toccoMano = (): void => {
    if (mano.attiva() !== null) consigli.nascondi(1);
  };
  window.addEventListener('resize', suResize);
  window.addEventListener('pointerdown', sveglia, true);
  el.scena.addEventListener('pointerdown', toccoSalto, true);
  el.scena.addEventListener('pointerdown', toccoScena);
  el.mano.addEventListener('pointerup', toccoMano);
  adatta();

  function togliFantasmi(): void {
    for (const f of fantasmi) f.remove();
    fantasmi.clear();
  }

  /** La mano di chi sta in basso; in modo calmo le carte che compaiono o spariscono si dissolvono. */
  function mostraMano(f: Fotografia, subito: boolean): void {
    const dorsi = f.posti[0]?.carteInMano ?? 0;
    // Mano coperta o ricostruzione: niente fantasmi di carte scoperte (regola anti-sbirciata)
    if (subito || f.mano === null) {
      togliFantasmi();
      mano.mostra(f.mano, dorsi);
      return;
    }
    const prima = [...el.mano.querySelectorAll<HTMLElement>('.cm')];
    const scoperte = prima.filter((c) => !c.classList.contains('dorso') && !c.classList.contains('fantasma'));
    mano.mostra(f.mano, dorsi);
    const durata = ctx.ridotto ? 1 : DISSOLVENZA_MANO_MS;
    for (const c of el.mano.querySelectorAll<HTMLElement>('.cm')) {
      if (prima.includes(c) || c.classList.contains('fantasma')) continue;
      ctx.animaInterfaccia(c, [{ opacity: 0 }, { opacity: 1 }], { duration: durata, easing: 'ease-out' });
    }
    for (const c of scoperte) {
      if (c.isConnected) continue;
      // Una copia muta della carta sparita si dissolve al suo posto
      const copia = c.cloneNode(true) as HTMLElement;
      copia.classList.add('fantasma');
      copia.classList.remove('attiva', 'spenta', 'trascinata');
      copia.removeAttribute('role');
      copia.removeAttribute('aria-label');
      copia.setAttribute('aria-hidden', 'true');
      copia.style.pointerEvents = 'none';
      el.mano.appendChild(copia);
      fantasmi.add(copia);
      const via = (): void => {
        fantasmi.delete(copia);
        copia.remove();
      };
      ctx.animaInterfaccia(copia, [{ opacity: 1 }, { opacity: 0 }], { duration: durata, easing: 'ease-in' }).finished.then(via, via);
    }
  }

  const contiDi = (f: Fotografia): Map<Luogo, number> =>
    new Map<Luogo, number>([...f.posti.map((p) => [p.id, p.agnellini] as [Luogo, number]), ['gregge', f.gregge]]);

  /**
   * Ferma ciò che è in corso prima di ricostruire (bozza, righe 2598–2602 e 2637): meteo, camera (sganciata subito),
   * voli e attese degli ordini. Gli ordini in corso vedono la generazione nuova e si fermano: gli eventi si chiudono da soli.
   */
  function fermaInCorso(): void {
    generazione++;
    meteo.ferma();
    camera.ferma();
    ordini.interrompi();
    el.mano.classList.remove('ventoso');
    ctx.regia.salto = false;
    lettura.chiudi();
    togliFumetti(ctx);
    el.mondo.querySelectorAll(DI_PASSAGGIO).forEach((e) => e.remove());
    el.ui.querySelectorAll(DI_PASSAGGIO).forEach((e) => e.remove());
  }

  /** Ricostruzione del tavolo (bozza, righe 1128–1143 e 2596–2611), con i conti della fotografia. */
  function ricostruisci(f: Fotografia, chiave: string): void {
    fermaInCorso();
    const n = f.posti.length as 2 | 3 | 4;
    const nuova = disposizione(n);
    const cambiaDisposizione = nuova !== disp;
    disp = nuova;
    assetto = chiave;
    postiOvile = f.postiOvile;

    // Via il tavolo di prima
    for (const a of aree) {
      if (a.nome === 'gregge') a.cartello?.remove();
      else togliRecinto(a);
    }
    postazioni?.distruggi();

    // Ambiente e flora: si creano la prima volta e si ridispongono solo se cambia il numero di giocatori
    if (conAmbiente) {
      if (!ambiente) {
        ambiente = creaAmbiente(ctx, nuova);
        ambiente.adattaTela();
      } else if (cambiaDisposizione) ambiente.ridisponiFlora(nuova);
    }
    if (!branco) {
      branco = new Branco(ctx, { ambiente: ambiente ?? undefined });
      branco.giochi.attivo = o.giochi !== false;
      branco.suCambioConto = (a) => {
        aggiornaCartello(a, postiOvile);
      };
    }
    branco.prospettiva = nuova.prospettiva;

    // I posti della fotografia vanno ai posti della disposizione nello stesso ordine (il primo è chi sta in basso)
    aree = creaAree(nuova, f.posti.map((p) => p.id), f.postiOvile);
    aree.forEach((a, i) => {
      if (a.nome === 'gregge') creaCartelloGregge(ctx, a, nuova.gregge.cartello);
      else creaRecinto(ctx, a, nuova.posti[i]!.recinto, ambiente?.vettoreOmbra);
    });
    if (ambiente) {
      const ombre = aree;
      ambiente.suCambioLuce = () => ombre.forEach((a) => aggiornaOmbreRecinti(a));
    }
    postazioni = creaPostazioni(ctx, nuova, lettura, { ambiente: ambiente ?? undefined, zoom });
    branco.costruisci(aree, contiDi(f));
    postazioni.aggiorna(f, true);
    coperta.aggiorna(f, true);
    mostraMano(f, true);
    ambiente?.impostaOra(f.ora);
  }

  const vivo = (): boolean => !distrutto;

  const teatro: Teatro = {
    ctx,
    ordini,
    allinea(f, modo) {
      if (!vivo()) return;
      // Chi sta dove: se cambia (primo allineamento, numero di giocatori, chi sta in basso) si ricostruisce subito
      const chiave = f.posti.map((p) => `${p.id}:${p.pecora}`).join('|');
      if (chiave !== assetto || modo === 'subito' || !branco || !postazioni) {
        // Stesso tavolo e `subito`: come la ricostruzione, ambiente e flora restano (non cambia la disposizione)
        ricostruisci(f, chiave);
      } else {
        postiOvile = f.postiOvile;
        branco.allinea(contiDi(f));
        postazioni.aggiorna(f);
        camera.riapplica();
        coperta.aggiorna(f);
        mostraMano(f, false);
        ambiente?.impostaOra(f.ora);
      }
      ultima = f;
    },
    avanza(ms) {
      if (vivo()) ciclo.avanza(ms);
    },
    eventoInCorso: () => vivo() && ctx.regia.eventoInCorso(),
    salta() {
      if (vivo()) ctx.regia.salta();
    },
    rivediSuggerimenti() {
      if (vivo()) consigli.rivediSuggerimenti();
    },
    adatta() {
      if (vivo()) suResize();
    },
    sospendi(sospeso) {
      if (vivo()) ciclo.sospendi(sospeso);
    },
    stato() {
      const agnellini = {} as StatoMostrato['agnellini'];
      for (const [luogo, c] of branco?.conti() ?? []) agnellini[luogo] = c;
      let inRegia = 0;
      let fuori = 0;
      for (const g of branco?.agnelli ?? []) {
        if (g.regia) inRegia++;
        // Fuori dalla sua area (bozza, prove.js riga 140): solo chi è libero e sta in un recinto
        else if (g.a.recinto && (g.x < g.a.x0 - 1 || g.x > g.a.x1 + 1 || g.y < g.a.y0 - 1 || g.y > g.a.y1 + 1)) fuori++;
      }
      const angoli: StatoMostrato['angoli'] = {};
      for (const p of ultima?.posti ?? []) angoli[p.id] = [...p.angolo];
      return {
        n: ultima?.posti.length ?? 0,
        inBasso: ultima?.posti[0]?.id ?? null,
        agnellini,
        inViaggio: branco?.inViaggio() ?? 0,
        intrappolati: branco?.intrappolati() ?? 0,
        inRegia,
        fuori,
        zoom: zoom(),
        postazioniNascoste: camera.nascoste(),
        recintiAlterati: camera.alterati(),
        angoli,
        mano: ultima?.mano ? [...ultima.mano] : null,
        particelle: ambiente?.particelle.length ?? 0,
      };
    },
    distruggi() {
      if (distrutto) return;
      distrutto = true;
      ciclo.ferma();
      meteo.ferma();
      camera.ferma();
      ordini.interrompi();
      ctx.orologio.svuota();
      window.removeEventListener('resize', suResize);
      window.removeEventListener('pointerdown', sveglia, true);
      el.scena.removeEventListener('pointerdown', toccoSalto, true);
      el.scena.removeEventListener('pointerdown', toccoScena);
      el.mano.removeEventListener('pointerup', toccoMano);
      piattaforma.fermaAnimazioni(radice);
      if (branco) {
        branco.giochi.attivo = false;
        branco.togli();
      }
      postazioni?.distruggi();
      for (const a of aree) {
        if (a.nome === 'gregge') a.cartello?.remove();
        else togliRecinto(a);
      }
      aree = [];
      togliFantasmi();
      mano.distruggi();
      lettura.chiudi();
      coperta.distruggi();
      ambiente?.distruggi();
      togliFumetti(ctx);
      ctx.regia.salto = false;
      for (const pulisci of ctx.pulizie.splice(0)) {
        try {
          pulisci();
        } catch (e) {
          console.error(e);
        }
      }
      radice.innerHTML = '';
      radice.classList.remove('teatro');
    },
  };
  return teatro;
}
