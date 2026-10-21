// Il teatro: l'unico punto d'accesso alla scena. Mette insieme scheletro, contesto, ambiente, branco, tavolo, mano e ciclo.
// `allinea` mette in pari la scena con una fotografia della partita (la verità è sempre il motore).
// Bozza scena.src.html: righe 343–352 (scala), 1128–1143 (costruzione del tavolo), 1510–1547 (ciclo),
// 2596–2635 (preparazione della partita, senza le regole finte) e 2660–2709 (tocchi e avvio).
import type { IdCarta, IdGiocatore, Luogo, Vista } from '../../../engine/src';
import { creaAmbiente, type Ambiente } from './ambiente/indice';
import { creaCamera } from './camera';
import { creaChiedi, NON_PRATO } from './chiedi';
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
import type { Domanda, Gesto, Pensiero } from './scelte/tipi';
import { creaPostazioni, type Postazioni } from './tavolo/postazioni';
import { creaRegista, type OpzioniRecita } from './regia/regista';
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
  /**
   * Dove sta ogni agnellino (per le prove): numero stabile, posizione, se è fuori dalla sua area di recinto
   * (anche se trattenuto dal meteo) e se è in viaggio verso un'altra area.
   */
  posizioni: Array<{ n: number; x: number; y: number; fuoriDalRecinto: boolean; inViaggio: boolean }>;
}

export interface Teatro {
  /**
   * Mette in pari la scena con la fotografia, senza recitare (pagina di sviluppo, prove). Con `subito` la regia svuota
   * anche la coda e si libera (la ricostruzione ferma le battute in corso), ma non segna gli eventi come recitati:
   * il gioco usa `recita(foto, vista, { subito: true })`.
   */
  allinea(f: Fotografia, modo: 'calmo' | 'subito'): void;
  /**
   * Recita gli eventi nuovi (seq > ultimo recitato) e poi mette in pari con `foto`. La prima chiamata, o un tavolo
   * da ricostruire, mette in pari "subito" senza recitare. È la via del gioco. Con `{ subito: true }` (ritorno da
   * un'altra scheda) niente recita: coda svuotata, messa in pari subito, eventi della vista segnati come recitati.
   */
  recita(foto: Fotografia, vista: Vista, o?: OpzioniRecita): void;
  /** Una battuta fa ancora aspettare la partita, o ce ne sono in coda (un meteo sullo sfondo non conta). */
  occupato(): boolean;
  /** Avvisa ai cambi di `occupato`; restituisce la funzione che toglie l'ascoltatore. */
  ascoltaOccupato(cb: (occupato: boolean) => void): () => void;
  /** Solo con ciclo manuale: passi da 33 ms (orologio + scena). */
  avanza(ms: number): void;
  eventoInCorso(): boolean;
  salta(): void;
  stato(): StatoMostrato;
  /** Mostra la domanda appena la scena è libera (subito, se lo è) e la toglie mentre recita; una domanda nuova sostituisce la vecchia. I gesti arrivano a `suGesto`. */
  chiedi(d: Domanda, suGesto: (g: Gesto) => void): void;
  /** Toglie la domanda (e libera la mano). */
  smettiDiChiedere(): void;
  /** La nuvoletta del pensiero della pecora in basso (null la toglie); anche lei aspetta la scena libera. */
  pensa(p: Pensiero | null): void;
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
  /** Le animazioni che la regia della partita chiede: meteo, Guai, dado, Testata, Beee-NO!, zoom, rivelazione, fumetti, festa… */
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
  // Il terzo consiglio ("trascina") si supera con la prima carta giocata trascinandola
  const mano = creaMano(ctx, lettura, { allaGiocataTrascinando: () => consigli.nascondi(3) });
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
  /** Un numero stabile per agnellino, per `stato().posizioni`. */
  const numeri = new WeakMap<object, number>();
  let prossimoNumero = 0;

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
    // La mano e i pulsanti crescono di KD: zone e pulsanti della domanda si rimettono a posto
    chiediUi.riposiziona();
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
      // L'angolo mostrato ha una carta in più; la fotografia successiva lo conferma
      if (postoFoto(chi)?.angolo.includes(carta)) return;
      palco.ritocca(chi, (q) => ({ ...q, angolo: [...q.angolo, carta] }));
    },
    ritocca(chi, modifica) {
      const f = ultima;
      if (!f || !postoFoto(chi)) return;
      // Il posto mostrato cambia in `ultima`: un altro ordine che rimette in pari le postazioni non lo disfa (aggiorna è idempotente)
      ultima = { ...f, posti: f.posti.map((q) => (q.id === chi ? modifica(q) : q)) };
      postazioni?.aggiorna(ultima);
      camera.riapplica();
    },
    generazione: () => generazione,
  };
  const camera = creaCamera(palco);
  const meteo = creaMeteo(palco, camera);
  const ordini = creaOrdini(palco, camera, meteo);
  const regista = creaRegista({
    ctx,
    ordini,
    allinea: (f, modo) => allineaScena(f, modo),
    daRicostruire: (f) => chiaveDi(f) !== assetto || !branco || !postazioni,
  });

  // Le scelte nella scena: la domanda e il pensiero aspettano la scena libera (pezzo 2) e si tolgono mentre recita
  const chiediUi = creaChiedi(ctx, palco, mano, camera, {
    nomeDi: (chi) => postoFoto(chi)?.nome ?? chi,
    // Mano coperta (passaggio del telefono, scena di un altro): nessuna carta è toccabile anche se la domanda le elenca
    manoScoperta: () => ultima?.mano != null,
    // Il primo consiglio ("Tocca una carta per sollevarla") se ne va quando la domanda solleva una carta
    allaSollevata: () => consigli.nascondi(1),
    // Chi aveva visto i due consigli di prima vede "trascina" solo quando c'è davvero una carta da trascinare
    allaTrascinabile: () => consigli.allaPrimaTrascinabile(),
    // Tenere premuta una carta grande, quella al centro o un Guaio dell'angolo la fa leggere
    lettura,
  });
  let domandaMem: { d: Domanda; suGesto: (g: Gesto) => void } | null = null;
  let pensieroMem: Pensiero | null = null;
  const mostraDomanda = (): void => {
    if (domandaMem && !regista.occupato()) chiediUi.mostra(domandaMem.d, domandaMem.suGesto);
  };
  // Registrato subito dopo il regista: gli altri ascoltatori trovano la domanda già tolta (o rimessa)
  regista.ascoltaOccupato((occupato) => {
    if (distrutto) return;
    if (occupato) {
      chiediUi.togli();
      chiediUi.pensa(null);
    } else {
      mostraDomanda();
      chiediUi.pensa(pensieroMem);
    }
  });

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
    // Un fotogramma rotto può aver lasciato la scena a metà: si rimette in pari subito con la fotografia più recente,
    // quella che il regista avrebbe mostrato a fine recita (se ce n'è una in corso), altrimenti l'ultima mostrata
    onErrore: () => {
      const f = regista.fotoRecente() ?? ultima;
      if (f && !distrutto) allineaScena(f, 'subito');
    },
  });

  // Tocchi (bozza, righe 2669–2680)
  const sveglia = (): void => ctx.risparmio.tocco(ciclo.ora());
  const toccoSalto = (e: Event): void => {
    const t = e.target as Element | null;
    if (!ctx.regia.eventoInCorso() || t?.closest?.(INTERFACCIA)) return;
    if (chiediUi.visibile()) {
      // Con una domanda il tocco sul prato salta anche un evento ancora in corso sullo sfondo (meteo dopo i 5 s), oltre a
      // mandare "prato" (che abbassa le carte): una carta alzata non lo impedisce. Zone, pulsanti, dado, mano e nuvoletta
      // non saltano (sono della domanda).
      if (t?.closest?.(NON_PRATO)) return;
    } else if (mano.attiva() !== null) return;
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
      copia.removeAttribute('tabindex');
      copia.removeAttribute('aria-pressed');
      copia.removeAttribute('aria-disabled');
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

  /** Chi sta dove: se cambia (primo allineamento, numero di giocatori, chi sta in basso) il tavolo si ricostruisce. */
  const chiaveDi = (f: Fotografia): string => f.posti.map((p) => `${p.id}:${p.pecora}`).join('|');

  function allineaScena(f: Fotografia, modo: 'calmo' | 'subito'): void {
    const chiave = chiaveDi(f);
    if (chiave !== assetto || modo === 'subito' || !branco || !postazioni) {
      // Stesso tavolo e `subito`: come la ricostruzione, ambiente e flora restano (non cambia la disposizione)
      ricostruisci(f, chiave);
      ultima = f;
      // Zone e pulsanti della domanda sui posti nuovi (le pecore e i recinti di prima non ci sono più)
      chiediUi.riposiziona();
      // Ricostruito il tavolo, il regista non ha più niente da recitare (coda svuotata, libero). È l'ultima cosa:
      // un ascoltatore che all'avviso "libero" chiama `recita` trova la scena già in pari
      regista.svuota();
      return;
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
    // La mano può essere cambiata (scoperta, coperta, carte nuove): la domanda la comanda di nuovo se serve
    chiediUi.riposiziona();
  }

  const teatro: Teatro = {
    ctx,
    ordini,
    allinea(f, modo) {
      if (vivo()) allineaScena(f, modo);
    },
    recita(f, v, opz) {
      if (!vivo()) return;
      // La mano è interfaccia privata, non scena da recitare: si aggiorna subito, anche se il resto della fotografia
      // aspetta la fine della recita. Coperta (anti-sbirciata) senza dissolvenze; scoperta, la carta giocata esce
      // mentre la sua copia vola e le carte pescate entrano
      if (ultima && chiaveDi(f) === assetto && String(f.mano) !== String(ultima.mano)) {
        ultima = { ...ultima, mano: f.mano };
        mostraMano(ultima, f.mano === null);
        chiediUi.riposiziona();
      }
      regista.recita(f, v, opz);
    },
    occupato: () => vivo() && regista.occupato(),
    ascoltaOccupato: (cb) => regista.ascoltaOccupato(cb),
    avanza(ms) {
      if (vivo()) ciclo.avanza(ms);
    },
    chiedi(d, suGesto) {
      if (!vivo()) return;
      // Si ricorda sempre; si mostra solo a scena libera (altrimenti ci pensa l'ascoltatore di "occupato")
      domandaMem = { d, suGesto };
      mostraDomanda();
    },
    smettiDiChiedere() {
      if (!vivo()) return;
      domandaMem = null;
      chiediUi.togli();
    },
    pensa(p) {
      if (!vivo()) return;
      pensieroMem = p;
      if (p === null || !regista.occupato()) chiediUi.pensa(p);
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
      if (!vivo()) return;
      ciclo.sospendi(sospeso);
      // Anche l'audio si ferma con la scena nascosta; riparte solo se i suoni sono accesi nelle Opzioni
      if (sospeso) Suono.sospendi();
      else if (opzioni().suoni) Suono.riprendi();
    },
    stato() {
      const agnellini = {} as StatoMostrato['agnellini'];
      for (const [luogo, c] of branco?.conti() ?? []) agnellini[luogo] = c;
      let inRegia = 0;
      let fuori = 0;
      const posizioni: StatoMostrato['posizioni'] = [];
      for (const g of branco?.agnelli ?? []) {
        const fuoriArea = !!g.a.recinto && (g.x < g.a.x0 - 1 || g.x > g.a.x1 + 1 || g.y < g.a.y0 - 1 || g.y > g.a.y1 + 1);
        if (g.regia) inRegia++;
        // Fuori dalla sua area (bozza, prove.js riga 140): solo chi è libero e sta in un recinto
        else if (fuoriArea) fuori++;
        let n = numeri.get(g);
        if (n === undefined) numeri.set(g, (n = prossimoNumero++));
        posizioni.push({ n, x: g.x, y: g.y, fuoriDalRecinto: fuoriArea && !g.inViaggio, inViaggio: g.inViaggio });
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
        posizioni,
      };
    },
    distruggi() {
      if (distrutto) return;
      // Prima la domanda: il regista, distruggendosi, avvisa "libero" e non deve rimostrarla
      domandaMem = null;
      pensieroMem = null;
      chiediUi.distruggi();
      // Prima il regista: avvisa "libero" e non riprende la recita quando gli ordini si fermano
      regista.distruggi();
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
