// Banco di prova della bozza della scena (solo sviluppo, fuori da git).
// Si carica nella pagina dal browser interno:  await import('/prove.js?' + Date.now()); PROVE.installaOrologio();
// L'orologio finto fa avanzare la scena anche quando la finestra è in sottofondo (lì il browser ferma le animazioni).
// Le prove lunghe si avviano con PROVE.lancia(nome, ...argomenti) e si leggono con PROVE.stato().

const O = { t: 0, id: 1, rid: 1, timer: new Map(), raf: new Map(), attese: [], passoMs: 33, attivo: false };
const ERRORI = [];
const ATTESI = { 2: 36, 3: 45, 4: 44 };
const IDS = ['grandine-a-sorpresa', 'pioggia-di-traverso', 'vento-dispettoso', 'nebbia-fitta', 'fulmine-curioso', 'gelata-di-agosto', 'pozzanghera-senza-fondo', 'lupo-vegetariano'];
// Durate di riferimento a velocità normale (ms), misurate nel compito 2: servono per saltare "a metà".
const DURATE_RIF = { 'grandine-a-sorpresa': 8550, 'pioggia-di-traverso': 13000, 'vento-dispettoso': 6100, 'nebbia-fitta': 17850,
  'fulmine-curioso': 9100, 'gelata-di-agosto': 9400, 'pozzanghera-senza-fondo': 13600, 'lupo-vegetariano': 6650 };

let attesaTick = null;
const canale = new MessageChannel();
canale.port1.onmessage = () => { const r = attesaTick; attesaTick = null; if (r) r(); };
const tick = () => new Promise((r) => { attesaTick = r; canale.port2.postMessage(0); });

/** Promessa che si risolve dopo `ms` di tempo finto. */
export function attendi(ms) {
  return new Promise((r) => O.attese.push({ quando: O.t + ms, r }));
}

async function passo(ms) {
  const fine = O.t + ms;
  for (;;) {
    let prossimo = null, pid = null;
    for (const [id, t] of O.timer) if (t.quando <= fine && (!prossimo || t.quando < prossimo.quando)) { prossimo = t; pid = id; }
    if (!prossimo) break;
    O.t = Math.max(O.t, prossimo.quando);
    if (prossimo.ogni) prossimo.quando += prossimo.ogni; else O.timer.delete(pid);
    try { prossimo.f(); } catch (e) { ERRORI.push(String(e && e.stack || e)); }
    await tick();
  }
  O.t = fine;
  const cbs = [...O.raf.values()]; O.raf.clear();
  for (const f of cbs) { try { f(O.t); } catch (e) { ERRORI.push(String(e && e.stack || e)); } }
  await tick();
  // Le animazioni WAAPI seguono il tempo vero: le porto avanti a mano, rispettando la loro velocità
  for (const a of document.getAnimations()) {
    if (a.playState === 'running') { a.pause(); a.__finto = O.t; continue; }
    if (a.playState !== 'paused' || a.__finto == null) continue;
    const ora = (a.currentTime || 0) + (O.t - a.__finto) * a.playbackRate; a.__finto = O.t;
    const durata = a.effect ? a.effect.getComputedTiming().endTime : 0;
    if (ora >= durata) { try { a.finish(); } catch (e) { a.cancel(); } } else a.currentTime = ora;
  }
  const pronte = O.attese.filter((x) => x.quando <= O.t);
  O.attese = O.attese.filter((x) => x.quando > O.t);
  for (const x of pronte) x.r();
  if (pronte.length) await tick();
}

export function installaOrologio() {
  if (window.__orologio) return 'già installato';
  window.__orologio = O;
  O.t = performance.now();
  window.addEventListener('error', (e) => ERRORI.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => ERRORI.push('promessa: ' + String(e.reason && e.reason.stack || e.reason)));
  const errore0 = console.error.bind(console);
  console.error = (...a) => { ERRORI.push(a.map(String).join(' ')); errore0(...a); };
  performance.now = () => O.t;
  window.setTimeout = (f, ms = 0, ...a) => { const id = O.id++; O.timer.set(id, { quando: O.t + Math.max(0, ms), f: () => f(...a) }); return id; };
  window.setInterval = (f, ms = 0, ...a) => { const id = O.id++; const ogni = Math.max(4, ms); O.timer.set(id, { quando: O.t + ogni, ogni, f: () => f(...a) }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { O.timer.delete(id); };
  // Il ciclo della scena va chiamato solo con il tempo finto; il tempo non torna mai indietro
  const ciclo0 = ciclo;
  const cicloSicuro = (ora) => { if (ora !== O.t) return; if (ora < ultimo) ultimo = ora; ciclo0(ora); };
  window.requestAnimationFrame = (f) => { const g = f === ciclo0 ? cicloSicuro : f; for (const [k, h] of O.raf) if (h === g) return k; const id = O.rid++; O.raf.set(id, g); return id; };
  window.cancelAnimationFrame = (id) => O.raf.delete(id);
  ultimo = O.t;
  // Il primo giro: il ciclo della scena era in attesa di un fotogramma vero, lo riaggancio a quello finto
  O.raf.set(O.rid++, cicloSicuro);
  O.attivo = true;
  (async () => {
    while (O.attivo) {
      const ms = O.buco ?? O.passoMs; O.buco = null;
      await passo(ms);
      if (O.dopoBuco) { const r = O.dopoBuco; O.dopoBuco = null; r(); }
    }
  })();
  return 'installato';
}

/** Un solo fotogramma lunghissimo, come al ritorno da un'altra scheda. */
export function buco(ms) {
  return new Promise((r) => { O.buco = ms; O.dopoBuco = r; });
}

// ---------- Compito 3: orologio della scena ----------
export async function provaOrologio() {
  if (typeof dopo !== 'function') return ['dopo non esiste'];
  const falliti = [];
  const err0 = ERRORI.length;
  // dopo() segue la velocità della scena (dal compito 4 la decide la scena: serve un evento in corso con le animazioni veloci)
  const conRegia = typeof apriEvento === 'function', veloci0 = conRegia ? OPZIONI.veloci : null;
  const chiudi = conRegia ? apriEvento('prova') : null;
  if (conRegia) OPZIONI.veloci = true; else impostaVelocita(2);
  let scattato = null; const t0 = O.t;
  dopo(() => { scattato = O.t; }, 500);
  await attendi(400);
  if (conRegia) { OPZIONI.veloci = veloci0; chiudi(); } else impostaVelocita(1);
  if (scattato === null || scattato - t0 < 220 || scattato - t0 > 300) falliti.push(`dopo(500) a velocità 2 dopo ${scattato === null ? 'mai' : scattato - t0} ms invece di ~250`);
  // ogni() scatta con regolarità e annulla() lo ferma
  let colpi = 0; const id = ogni(() => colpi++, 100);
  await attendi(1000);
  if (colpi < 9 || colpi > 11) falliti.push(`ogni(100) in 1 s: ${colpi} colpi invece di 10`);
  annulla(id); const fermi = colpi;
  await attendi(300);
  if (colpi !== fermi) falliti.push('annulla non ferma ogni()');
  // Le animazioni della scena seguono la velocità, quelle dell'interfaccia no
  impostaVelocita(2);
  const a = $('#mondo').appendChild(document.createElement('div')), b = $('#mano').appendChild(document.createElement('div'));
  const an = a.animate([{ opacity: 1 }, { opacity: 0.5 }], 1000), bn = b.animate([{ opacity: 1 }, { opacity: 0.5 }], 1000);
  if (an.playbackRate !== 2) falliti.push(`animazione nel mondo con velocità ${an.playbackRate} invece di 2`);
  if (bn.playbackRate !== 1) falliti.push(`animazione nella mano con velocità ${bn.playbackRate} invece di 1`);
  impostaVelocita(1);
  if (an.playbackRate !== 1) falliti.push('impostaVelocita non aggiorna le animazioni già partite');
  an.cancel(); bn.cancel(); a.remove(); b.remove();
  // Un buco di 10 s fa avanzare l'orologio della scena di 1 s al massimo, senza errori
  const m0 = OROLOGIO.ms;
  await buco(10000);
  if (OROLOGIO.ms - m0 > 1040) falliti.push(`dopo un buco di 10 s l'orologio è avanzato di ${Math.round(OROLOGIO.ms - m0)} ms`);
  if (ERRORI.length > err0) falliti.push('errori: ' + ERRORI.slice(err0).join(' | ').slice(0, 300));
  return falliti;
}

/** Fa avanzare il tempo finto di `secondi`, a passi di `passoMs` (per simulare telefoni più o meno fluidi). */
export async function vai(secondi, passoMs = 33) {
  const prima = O.passoMs; O.passoMs = passoMs;
  await attendi(secondi * 1000);
  O.passoMs = prima;
}

export function fotografia() {
  const ag = [...AGNELLI];
  return {
    agnelli: ag.length,
    perArea: Object.fromEntries(Object.values(AREE).map((a) => [a.nome, a.agnelli.length])),
    intrappolati: ag.filter((g) => g.intrappolato).length,
    fuori: ag.filter((g) => !g.regia && g.a.recinto && (g.x < g.a.x0 - 1 || g.x > g.a.x1 + 1 || g.y < g.a.y0 - 1 || g.y > g.a.y1 + 1)).length,
    inRegia: ag.filter((g) => g.regia).length,
    zoom: zoomCamera(),
    postazioniNascoste: Object.values(AREE).filter((a) => a.sfumata).length,
    errori: [...ERRORI],
  };
}

const finito = () => (typeof eventoInCorso === 'function' ? !eventoInCorso() : meteoAttivo === null);

export async function casoMeteo(id, chi, n, modo = 'normale') {
  if (modo !== 'normale' && typeof saltaEvento !== 'function') throw new Error(`modo ${modo} non ancora disponibile: manca saltaEvento`);
  if (numeroGiocatori !== n) { cambiaGiocatori(n); await attendi(2500); }
  const prima = fotografia();
  const veloci0 = typeof OPZIONI === 'object' ? OPZIONI.veloci : undefined;
  if (modo === 'veloci') OPZIONI.veloci = true;
  const t0 = O.t, meta = (DURATE_RIF[id] || 10000) / 2;
  let saltato = false;
  avviaMeteo(id, chi);
  await attendi(50);
  while (!finito() && O.t - t0 < 30000) {
    await attendi(100);
    if (modo === 'salto' && !saltato && O.t - t0 >= meta) { saltaEvento(); saltato = true; }
  }
  const durataMs = O.t - t0;
  // Se l'evento non finisce, cosa lo tiene aperto?
  const diagnosi = durataMs >= 30000 && typeof REGIA === 'object' ? JSON.stringify({
    aperti: REGIA.aperti, meteo: !!meteoAttivo,
    timer: [...OROLOGIO.timer.values()].map((x) => `${x.ogni ? 'ogni' : 'dopo'} ${Math.round(x.quando - OROLOGIO.ms)} ${String(x.fn).slice(0, 60)}`),
    viaggio: [...IN_VIAGGIO].map((g) => ({ a: g.a.nome, s: g.stato, x: Math.round(g.x), y: Math.round(g.y), tx: Math.round(g.tx), ty: Math.round(g.ty), regia: g.regia })),
  }) : null;
  if (modo === 'veloci') OPZIONI.veloci = veloci0;
  await attendi(1300);
  return { durataMs, diagnosi, salto: saltato ? durataMs - meta : null, prima, dopo: fotografia() };
}

/** Aspetta che non ci sia nessun evento in corso (al massimo `maxMs`); restituisce i ms passati. */
async function quiete(maxMs = 30000) {
  const t0 = O.t;
  while (eventoInCorso() && O.t - t0 < maxMs) await attendi(50);
  return O.t - t0;
}
const pulita = (f) => [f.intrappolati && `intrappolati ${f.intrappolati}`, f.fuori && `fuori ${f.fuori}`,
  Math.abs(f.zoom - 1) > 0.01 && `zoom ${f.zoom.toFixed(2)}`, f.postazioniNascoste && `postazioni nascoste ${f.postazioniNascoste}`].filter(Boolean);

// ---------- Compito 4: eventi in corso, salto e animazioni veloci ----------
export async function provaSalto() {
  if (typeof eventoInCorso !== 'function') return ['eventoInCorso non esiste'];
  const falliti = [], err0 = ERRORI.length;
  if (numeroGiocatori !== 3) { cambiaGiocatori(3); await attendi(2500); }
  await quiete();
  // (b) un Guaio è un evento dall'inizio alla fine
  guaio('nebbia-fitta', 'io');
  await attendi(30);
  if (!eventoInCorso()) falliti.push('(b) subito dopo guaio() non risulta nessun evento in corso');
  const durataGuaio = await quiete();
  if (eventoInCorso()) falliti.push('(b) dopo 30 s l\'evento è ancora in corso');
  // (c) con le animazioni veloci la nebbia dura circa la metà
  OPZIONI.veloci = true;
  avviaMeteo('nebbia-fitta', 'io'); await attendi(30);
  const veloce = await quiete();
  OPZIONI.veloci = false;
  const rapporto = veloce / DURATE_RIF['nebbia-fitta'];
  if (rapporto < 0.45 || rapporto > 0.6) falliti.push(`(c) nebbia veloce: ${Math.round(veloce)} ms, ${Math.round(rapporto * 100)}% del riferimento`);
  await attendi(1300);
  // (d) salto durante lo zoom su un avversario
  guaio('lupo-vegetariano', 'bea');
  await attendi(600);
  saltaEvento();
  const dopoSalto = await quiete();
  await attendi(1300);
  if (dopoSalto > 3000) falliti.push(`(d) dopo il salto durante lo zoom l'evento è durato ancora ${Math.round(dopoSalto)} ms`);
  for (const m of pulita(fotografia())) falliti.push('(d) ' + m);
  // (e) un meteo nuovo durante un salto
  avviaMeteo('pioggia-di-traverso', 'io');
  await attendi(2000); saltaEvento();
  await attendi(300); avviaMeteo('pozzanghera-senza-fondo', 'io');
  await quiete(); await attendi(1300);
  for (const m of pulita(fotografia())) falliti.push('(e) ' + m);
  // (f) fuori dagli eventi la velocità resta 1 e il salto si spegne da solo
  await quiete();
  REGIA.salto = true;
  await attendi(50);
  if (REGIA.salto) falliti.push('(f) senza eventi il salto resta acceso');
  if (OROLOGIO.velocita !== 1) falliti.push(`(f) senza eventi la velocità è ${OROLOGIO.velocita}`);
  // (g) mentre si salta i suoni tacciono
  const s0 = { attivo: Suono.attivo, ctx: Suono.ctx, beee: Suono.beee };
  let suonati = 0;
  Object.assign(Suono, { attivo: true, ctx: s0.ctx || {}, beee: () => suonati++ });
  REGIA.salto = true; suona('beee'); REGIA.salto = false; suona('beee');
  Object.assign(Suono, s0);
  if (suonati !== 1) falliti.push(`(g) suoni: ${suonati} invece di 1 (uno solo, fuori dal salto)`);
  if (ERRORI.length > err0) falliti.push('errori: ' + ERRORI.slice(err0).join(' | ').slice(0, 300));
  return falliti.length ? falliti : [];
}

const interruttore = (testo) => [...document.querySelectorAll('#opzioni [role=switch], #opzioni button')].find((b) => b.textContent.trim().startsWith(testo));
const clicca = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

// ---------- Compito 5: menu Opzioni, salvataggio, suggerimenti alla prima apertura ----------
export async function provaOpzioni() {
  if (!$('#apri-opzioni')) return ['manca #apri-opzioni'];
  const falliti = [], err0 = ERRORI.length;
  if ($('#suoni')) falliti.push('(a) il pulsante #suoni c\'è ancora');
  const salvate = localStorage.getItem(CHIAVE_OPZIONI), consigli0 = localStorage.getItem(CHIAVE_CONSIGLI);
  const predefinite = JSON.stringify({ suoni: false, vibrazione: true, veloci: false });
  // (b) l'interruttore cambia l'opzione e la salva
  clicca($('#apri-opzioni'));
  if ($('#opzioni').hidden) falliti.push('(b) il menu non si apre');
  const veloci = interruttore('Animazioni veloci');
  if (!veloci) falliti.push('(b) manca l\'interruttore "Animazioni veloci"');
  else {
    const prima = OPZIONI.veloci;
    clicca(interruttore('Animazioni veloci'));
    if (OPZIONI.veloci === prima) falliti.push('(b) l\'interruttore non cambia OPZIONI.veloci');
    if (JSON.parse(localStorage.getItem(CHIAVE_OPZIONI) || '{}').veloci !== OPZIONI.veloci) falliti.push('(b) l\'opzione non è salvata');
    if (interruttore('Animazioni veloci').getAttribute('aria-checked') !== String(OPZIONI.veloci)) falliti.push('(b) aria-checked non segue l\'opzione');
    clicca(interruttore('Animazioni veloci'));
  }
  // (f) la vibrazione compare solo dove il telefono la permette
  if (!!interruttore('Vibrazione') !== PUO_VIBRARE) falliti.push(`(f) riga Vibrazione ${interruttore('Vibrazione') ? 'presente' : 'assente'} con PUO_VIBRARE=${PUO_VIBRARE}`);
  if (!interruttore('Suoni')) falliti.push('(b) manca l\'interruttore "Suoni"');
  if (!interruttore('Rivedi i suggerimenti')) falliti.push('(e) manca "Rivedi i suggerimenti"');
  // (c) salvataggio che lancia errori (navigazione privata)
  const get0 = Storage.prototype.getItem, set0 = Storage.prototype.setItem;
  Storage.prototype.getItem = () => { throw new Error('bloccato'); };
  Storage.prototype.setItem = () => { throw new Error('bloccato'); };
  try {
    if (JSON.stringify(leggiOpzioni()) !== predefinite) falliti.push('(c) con il salvataggio bloccato non valgono le predefinite');
    try { salvaOpzioni(); } catch (e) { falliti.push('(c) salvaOpzioni lancia: ' + e.message); }
  } finally { Storage.prototype.getItem = get0; Storage.prototype.setItem = set0; }
  // (d) salvataggio rotto
  localStorage.setItem(CHIAVE_OPZIONI, '{rotto');
  if (JSON.stringify(leggiOpzioni()) !== predefinite) falliti.push('(d) con un salvataggio rotto non valgono le predefinite');
  // (e) suggerimenti: Rivedi li fa ricomparire, finirli li segna come visti
  localStorage.setItem(CHIAVE_CONSIGLI, '1');
  rivediSuggerimenti();
  await attendi(600);
  if (localStorage.getItem(CHIAVE_CONSIGLI) !== null) falliti.push('(e) Rivedi non toglie il segno dei suggerimenti visti');
  if ($('#consiglio').textContent !== CONSIGLI[0] || $('#consiglio').style.opacity !== '1') falliti.push('(e) Rivedi non mostra il primo suggerimento');
  nascondiConsiglio(CONSIGLI.length);
  if (localStorage.getItem(CHIAVE_CONSIGLI) !== '1') falliti.push('(e) finiti i suggerimenti non vengono segnati come visti');
  if ($('#consiglio').style.opacity !== '0') falliti.push('(e) finiti i suggerimenti la striscia resta visibile');
  // Rimette tutto com'era
  if (salvate === null) localStorage.removeItem(CHIAVE_OPZIONI); else localStorage.setItem(CHIAVE_OPZIONI, salvate);
  if (consigli0 === null) localStorage.removeItem(CHIAVE_CONSIGLI); else localStorage.setItem(CHIAVE_CONSIGLI, consigli0);
  OPZIONI = leggiOpzioni();
  $('#opzioni').hidden = true;
  if (ERRORI.length > err0) falliti.push('errori: ' + ERRORI.slice(err0).join(' | ').slice(0, 300));
  return falliti;
}

// ---------- Compito 6: vibrazione ----------
export async function provaVibrazione() {
  if (typeof vibra !== 'function') return ['vibra non esiste'];
  const falliti = [], err0 = ERRORI.length, chiamate = [];
  const v0 = navigator.vibrate, opz0 = OPZIONI.vibrazione;
  navigator.vibrate = (r) => { chiamate.push(r); return true; };
  try {
    if (numeroGiocatori !== 3) { cambiaGiocatori(3); await attendi(2500); }
    await quiete();
    OPZIONI.vibrazione = true;
    guaio('lupo-vegetariano', 'io'); await quiete();
    if (JSON.stringify(chiamate) !== '[[60,50,60]]') falliti.push(`Guaio a me: ${JSON.stringify(chiamate)}`);
    chiamate.length = 0;
    guaio('lupo-vegetariano', 'bea'); await quiete();
    if (chiamate.length) falliti.push(`Guaio a Bea: ${JSON.stringify(chiamate)} invece di niente`);
    chiamate.length = 0;
    beeeNoDi('bea'); await quiete();
    if (JSON.stringify(chiamate) !== '[[140]]') falliti.push(`Beee-NO! di Bea: ${JSON.stringify(chiamate)}`);
    chiamate.length = 0;
    OPZIONI.vibrazione = false;
    guaio('lupo-vegetariano', 'io'); await quiete();
    if (chiamate.length) falliti.push(`con la vibrazione spenta: ${JSON.stringify(chiamate)}`);
    OPZIONI.vibrazione = true;
    chiamate.length = 0;
    vittoria('io'); await attendi(2000);
    if (JSON.stringify(chiamate[chiamate.length - 1]) !== '[80,60,80,60,220]') falliti.push(`vittoria: ${JSON.stringify(chiamate)}`);
    ricomincia(); await attendi(4000); await quiete();
  } finally { navigator.vibrate = v0; OPZIONI.vibrazione = opz0; }
  if (ERRORI.length > err0) falliti.push('errori: ' + ERRORI.slice(err0).join(' | ').slice(0, 300));
  return falliti;
}

// ---------- Compito 7: mano a misura di dito ----------
const vicino = (a, b, tol = 0.002) => Math.abs(a - b) <= tol;
const sovrapposti = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
export async function provaDito() {
  if (typeof misuraDito !== 'function') return ['misuraDito non esiste'];
  const falliti = [], err0 = ERRORI.length;
  // (a) i numeri della misura dito
  const casi = [[360, 640, 0.7583, 0.9231], [390, 660, 0.782, 0.9775], [390, 844, 1, 1], [800, 360, 0.4265, 0.5332]];
  for (const [w, h, s, d] of casi) { const m = misuraDito(w, h); if (!vicino(m.S, s) || !vicino(m.D, d)) falliti.push(`(a) misuraDito(${w}, ${h}) = ${m.S.toFixed(4)}, ${m.D.toFixed(4)} invece di ${s}, ${d}`); }
  await quiete();
  if (!st.mano.length) { await attendi(3000); }
  // (b) le carte della mano stanno dentro lo schermo
  for (const el of document.querySelectorAll('#mano .cm')) { const r = el.getBoundingClientRect(); if (r.left < -1 || r.right > innerWidth + 1) { falliti.push(`(b) una carta esce dallo schermo: ${Math.round(r.left)}–${Math.round(r.right)} su ${innerWidth}`); break; } }
  // (f) il cartello del mio recinto non è coperto dalla mano
  const cartello = AREE.io.cartello && (AREE.io.cartello.getBoundingClientRect ? AREE.io.cartello : AREE.io.cartello.el);
  if (cartello) { const rc = cartello.getBoundingClientRect(); for (const el of document.querySelectorAll('#mano .cm')) if (sovrapposti(rc, el.getBoundingClientRect())) { falliti.push('(f) la mano copre il cartello del mio recinto'); break; } }
  // (d) un fumetto lungo resta dentro lo schermo
  const altro = AVVERSARI[AVVERSARI.length - 1];
  fumetto(altro, 'Prova di fumetto piuttosto lungo'); await attendi(300);
  const f = document.querySelector(`.fumetto[data-di="${altro}"]`);
  if (f) { const r = f.getBoundingClientRect(); if (r.left < -1 || r.right > innerWidth + 1) falliti.push(`(d) il fumetto esce dallo schermo: ${Math.round(r.left)}–${Math.round(r.right)}`); }
  // (e) carta sollevata: dopo un cambio di misura i pulsanti restano sotto la carta e centrati
  st.attiva = st.mano[0]; disponiMano(); await attendi(400);
  adatta(); await attendi(400);
  const carta = ELEMENTI_MANO.get(st.attiva).getBoundingClientRect(), az = $('#azioni-carta').getBoundingClientRect();
  if (Math.abs((carta.left + carta.right) / 2 - (az.left + az.right) / 2) > 10) falliti.push(`(e) pulsanti non centrati sotto la carta (${Math.round((carta.left + carta.right) / 2)} contro ${Math.round((az.left + az.right) / 2)})`);
  if (az.top < carta.bottom - 4) falliti.push(`(e) i pulsanti (${Math.round(az.top)}) coprono la carta (fino a ${Math.round(carta.bottom)})`);
  st.attiva = null; disponiMano(); await attendi(400);
  // (c) trascinamento: la carta segue il dito e, rilasciata sulla tovaglia, viene giocata
  const cattura0 = Element.prototype.setPointerCapture;
  Element.prototype.setPointerCapture = () => {};
  try {
    const voce = st.mano[0], el = ELEMENTI_MANO.get(voce), r0 = el.getBoundingClientRect(), n0 = st.mano.length;
    const da = { x: (r0.left + r0.right) / 2, y: r0.top + 30 };
    const m = ui.getBoundingClientRect(), a = { x: m.left + 195 * S, y: m.top + 400 * S };
    const ev = (tipo, p) => el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, clientX: p.x, clientY: p.y, pointerId: 7, pointerType: 'touch', isPrimary: true }));
    ev('pointerdown', da);
    let peggiore = 0;
    for (let i = 1; i <= 10; i++) {
      const p = { x: da.x + (a.x - da.x) * i / 10, y: da.y + (a.y - da.y) * i / 10 };
      ev('pointermove', p); await attendi(16);
      if (i > 2) { const r = el.getBoundingClientRect(); peggiore = Math.max(peggiore, Math.abs((r.left + r.right) / 2 - p.x)); }
    }
    if (peggiore > 20) falliti.push(`(c) durante il trascinamento la carta si allontana dal dito di ${Math.round(peggiore)} px`);
    ev('pointerup', a);
    await attendi(1500); await quiete();
    if (st.mano.length !== n0 - 1) falliti.push(`(c) la carta trascinata sulla tovaglia non è stata giocata (${st.mano.length} carte invece di ${n0 - 1})`);
  } finally { Element.prototype.setPointerCapture = cattura0; }
  if (ERRORI.length > err0) falliti.push('errori: ' + ERRORI.slice(err0).join(' | ').slice(0, 300));
  return falliti;
}

// ---------- Correzioni dalla revisione finale (14 ottobre) ----------
const premi = (el, tipo = 'pointerdown') => el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, clientX: 5, clientY: 5, pointerId: 11, pointerType: 'touch', isPrimary: true }));
export async function provaCorrezioni() {
  const falliti = [], err0 = ERRORI.length;
  await quiete();
  // (1) saltando la pioggia, lo scroscio si ferma lo stesso
  const s0 = { attivo: Suono.attivo, ctx: Suono.ctx, inizia: Suono.pioggiaInizia, fine: Suono.pioggiaFine };
  let accesa = false;
  Object.assign(Suono, { attivo: true, ctx: s0.ctx || {}, pioggiaInizia: () => { accesa = true; }, pioggiaFine: () => { accesa = false; } });
  try {
    avviaMeteo('pioggia-di-traverso', 'io'); await attendi(1500);
    if (!accesa) falliti.push('(1) la pioggia non ha fatto partire lo scroscio');
    saltaEvento(); await quiete();
    if (accesa) falliti.push('(1) dopo il salto lo scroscio della pioggia resta acceso');
  } finally { Object.assign(Suono, { attivo: s0.attivo, ctx: s0.ctx, pioggiaInizia: s0.inizia, pioggiaFine: s0.fine }); }
  // (2) i suoni salvati come accesi si sbloccano al rilascio del dito, non alla pressione
  if (typeof preparaSbloccoAudio !== 'function') falliti.push('(2) manca preparaSbloccoAudio');
  else {
    const acc0 = Suono.accendi, suoni0 = OPZIONI.suoni; let accensioni = 0;
    OPZIONI.suoni = true;
    Suono.accendi = () => { accensioni++; };
    try {
      preparaSbloccoAudio();
      premi($('#scena'), 'pointerdown');
      if (accensioni) falliti.push('(2) l\'audio prova a partire alla pressione (col dito non vale come gesto)');
      premi($('#scena'), 'pointerup');
      if (!accensioni) falliti.push('(2) al rilascio del dito l\'audio non prova a partire');
    } finally { Suono.accendi = acc0; OPZIONI.suoni = suoni0; }
  }
  // (3) il salto non cancella la vibrazione del Guaio
  const v0 = navigator.vibrate, opz0 = OPZIONI.vibrazione, chiamate = [];
  navigator.vibrate = (r) => { chiamate.push(r); return true; };
  OPZIONI.vibrazione = true;
  try {
    guaio('lupo-vegetariano', 'io'); await attendi(50); saltaEvento(); await quiete();
    if (!chiamate.some((r) => JSON.stringify(r) === '[60,50,60]')) falliti.push(`(3) saltando il Guaio la vibrazione sparisce: ${JSON.stringify(chiamate)}`);
  } finally { navigator.vibrate = v0; OPZIONI.vibrazione = opz0; }
  // (4) con le animazioni veloci anche la rotazione del dado accelera
  const veloci0 = OPZIONI.veloci; OPZIONI.veloci = true;
  try {
    tiraDado(0); await attendi(100);
    const an = $('#dado').getAnimations();
    if (an.some((a) => a instanceof CSSTransition)) falliti.push('(4) il dado gira ancora con una transizione CSS, che non segue la velocità');
    if (!an.some((a) => !(a instanceof CSSTransition) && a.playbackRate === 2)) falliti.push('(4) la rotazione del dado non va a velocità 2');
    await quiete();
  } finally { OPZIONI.veloci = veloci0; }
  // (5) il salto non parte toccando la tovaglia, con una carta sollevata o con il menu aperto
  await quiete();
  avviaMeteo('vento-dispettoso', 'io'); await attendi(300);
  premi($('#coperta'));
  if (REGIA.salto) falliti.push('(5) un tocco sulla tovaglia salta l\'evento');
  REGIA.salto = false;
  st.attiva = st.mano[0]; disponiMano();
  premi($('#mondo'));
  if (REGIA.salto) falliti.push('(5) il tocco che abbassa una carta sollevata salta l\'evento');
  REGIA.salto = false; st.attiva = null; disponiMano();
  $('#opzioni').hidden = false;
  premi($('#mondo'));
  if (REGIA.salto) falliti.push('(5) il tocco che chiude il menu Opzioni salta l\'evento');
  REGIA.salto = false; $('#opzioni').hidden = true;
  premi($('#mondo'));
  if (!REGIA.salto) falliti.push('(5) un tocco sul prato non salta più l\'evento');
  await quiete();
  if (ERRORI.length > err0) falliti.push('errori: ' + ERRORI.slice(err0).join(' | ').slice(0, 300));
  return falliti;
}

// ---------- Problemi minori della revisione (14 ottobre) ----------
export async function provaMinori() {
  const falliti = [], err0 = ERRORI.length;
  if (numeroGiocatori !== 3) { cambiaGiocatori(3); await attendi(2500); }
  await quiete();
  // (a) "Ricomincia" a metà di un Guaio: la partita nuova parte pulita
  guaio('lupo-vegetariano', 'io'); await attendi(300);
  ricomincia(); await attendi(4000); await quiete(); await attendi(1500);
  if (JSON.stringify(st.angolo.io) !== '["lupo-vegetariano"]') falliti.push(`(a) dopo Ricomincia l'angolo è ${JSON.stringify(st.angolo.io)}`);
  const attesi = { io: DISP.agnelli.io, gregge: DISP.agnelli.gregge, ...Object.fromEntries(DISP.avversari.map((a) => [a.id, a.agnelli])) };
  for (const [n, q] of Object.entries(attesi)) if (AREE[n].agnelli.length !== q) falliti.push(`(a) dopo Ricomincia ${n} ha ${AREE[n].agnelli.length} agnellini invece di ${q}`);
  // (b) a 10 fotogrammi al secondo orologio e movimento avanzano insieme
  const T0 = T, m0 = OROLOGIO.ms; await vai(2, 100);
  const dT = (T - T0) * 1000, dm = OROLOGIO.ms - m0;
  if (Math.abs(dT - dm) > dm * 0.05) falliti.push(`(b) a 10 fps la scena avanza di ${Math.round(dT)} ms e l'orologio di ${Math.round(dm)} ms`);
  // (c) chi esce dalla pozzanghera e corre conta come "in viaggio"
  await quiete();
  avviaMeteo('pozzanghera-senza-fondo', 'io');
  let scappati = 0;
  while (meteoAttivo || eventoInCorso()) {
    await attendi(50);
    for (const g of AGNELLI) if (!g.regia && g.stato === 'corre' && !IN_VIAGGIO.has(g)) scappati++;
  }
  if (scappati) falliti.push(`(c) ${scappati} volte un agnellino correva senza essere in viaggio`);
  // (d) la misura della fluidità non conta il primo fotogramma come un secondo lento
  const f0 = { ...RISPARMIO.finestra }, l0 = RISPARMIO.secondiLenti;
  RISPARMIO.finestra.inizio = 0; RISPARMIO.finestra.fotogrammi = 0; RISPARMIO.secondiLenti = 0;
  misuraFluidita(5000, 0.016);
  if (RISPARMIO.secondiLenti !== 0) falliti.push('(d) il primo fotogramma conta come un secondo lento');
  Object.assign(RISPARMIO.finestra, f0); RISPARMIO.secondiLenti = l0;
  // (e) zoom su un avversario annullato subito: il recinto torna esattamente com'era
  await quiete();
  const chi = AVVERSARI[0], A = AREE[chi], area0 = { ...A.area0 };
  inquadra(chi); await attendi(100); sgancia(); await attendi(2500);
  for (const k of ['x0', 'y0', 'x1', 'y1']) if (Math.abs(A[k] - area0[k]) > 0.5) { falliti.push(`(e) il recinto di ${chi} è rimasto diverso (${k} ${A[k].toFixed(1)} invece di ${area0[k].toFixed(1)})`); break; }
  // (f) menu Opzioni: il punto resta sull'interruttore toccato, Esc lo chiude
  $('#apri-opzioni').click();
  const sw = interruttore('Animazioni veloci'); sw.focus(); sw.click();
  if (document.activeElement !== interruttore('Animazioni veloci')) falliti.push('(f) dopo il tocco l\'interruttore perde il punto della tastiera');
  interruttore('Animazioni veloci').click();
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  if (!$('#opzioni').hidden) falliti.push('(f) Esc non chiude il menu Opzioni');
  $('#opzioni').hidden = true;
  // (g) una mossa propria spegne il salto
  await quiete();
  avviaMeteo('vento-dispettoso', 'io'); await attendi(300); saltaEvento();
  tiraDado(); await attendi(50);
  if (REGIA.salto) falliti.push('(g) tirando il dado durante un salto il salto resta acceso');
  await quiete();
  if (ERRORI.length > err0) falliti.push('errori: ' + ERRORI.slice(err0).join(' | ').slice(0, 300));
  return falliti;
}

// ---------- Compito 8: riposo e modo leggero ----------
const tocca = () => $('#scena').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5, pointerId: 9 }));
export async function provaRisparmio() {
  if (typeof RISPARMIO !== 'object') return ['RISPARMIO non esiste'];
  const falliti = [], err0 = ERRORI.length;
  await quiete();
  // (b) dopo 21 s senza tocchi né eventi la scena va a riposo: al massimo 20 aggiornamenti al secondo
  await attendi(21000);
  if (!RISPARMIO.riposo) falliti.push('(b) dopo 21 s senza tocchi la scena non è a riposo');
  const vento0 = window.aggiornaVento; let aggiornamenti = 0;
  window.aggiornaVento = (dt) => { aggiornamenti++; return vento0(dt); };
  await attendi(1000);
  window.aggiornaVento = vento0;
  if (aggiornamenti > 21) falliti.push(`(b) a riposo ${aggiornamenti} aggiornamenti in 1 s`);
  // (c) un tocco la sveglia
  tocca(); await attendi(50);
  if (RISPARMIO.riposo) falliti.push('(c) un tocco non toglie il riposo');
  // (d) a 35 fotogrammi al secondo resta normale
  tocca(); await vai(7, 28);
  if (RISPARMIO.leggero) falliti.push('(d) a 35 fotogrammi al secondo scatta il modo leggero');
  // (e) a 25 fotogrammi al secondo per 6 s passa al modo leggero
  tocca(); await vai(6, 40);
  if (!RISPARMIO.leggero) falliti.push('(e) a 25 fotogrammi al secondo per 6 s il modo leggero non scatta');
  if (!$('#scena').classList.contains('leggero')) falliti.push('(e) #scena non ha la classe leggero');
  // (f) in modo leggero le particelle non superano 60
  tocca();
  let massimo = 0;
  avviaMeteo('gelata-di-agosto', 'io');
  while (eventoInCorso()) { await attendi(100); massimo = Math.max(massimo, PARTICELLE.length); }
  if (massimo > 60) falliti.push(`(f) in modo leggero ${massimo} particelle`);
  // (g) un fotogramma lunghissimo (ritorno da un'altra scheda) non conta come lento
  RISPARMIO.leggero = false; RISPARMIO.secondiLenti = 0; $('#scena').classList.remove('leggero');
  tocca(); await buco(3000); await attendi(100);
  if (RISPARMIO.secondiLenti !== 0 || RISPARMIO.leggero) falliti.push(`(g) un buco di 3 s conta come lento (${RISPARMIO.secondiLenti})`);
  RISPARMIO.leggero = false; $('#scena').classList.remove('leggero');
  if (ERRORI.length > err0) falliti.push('errori: ' + ERRORI.slice(err0).join(' | ').slice(0, 300));
  return falliti;
}

export async function provaCompleta(modo = 'normale') {
  const falliti = [], durate = {}, rapporti = {};
  let casi = 0;
  for (const n of [2, 3, 4]) {
    cambiaGiocatori(n); await attendi(2500);
    for (const chi of [...TUTTI]) for (const id of IDS) {
      const err0 = ERRORI.length;
      const r = await casoMeteo(id, chi, n, modo);
      casi++;
      const d = r.dopo, motivi = [];
      if (ERRORI.length > err0) motivi.push('errori: ' + ERRORI.slice(err0).join(' | ').slice(0, 300));
      if (d.agnelli !== ATTESI[n]) motivi.push(`agnellini ${d.agnelli}/${ATTESI[n]}`);
      if (d.intrappolati) motivi.push(`intrappolati ${d.intrappolati}`);
      if (d.fuori) motivi.push(`fuori ${d.fuori}`);
      if (Math.abs(d.zoom - 1) > 0.01) motivi.push(`zoom ${d.zoom.toFixed(2)}`);
      if (d.postazioniNascoste) motivi.push(`postazioni nascoste ${d.postazioniNascoste}`);
      if (r.durataMs > 25000) motivi.push(`durata ${r.durataMs}${r.diagnosi ? " " + r.diagnosi : ""}`);
      if (modo === 'salto' && r.salto > 4000) motivi.push(`dopo il salto ancora ${Math.round(r.salto)} ms`);
      if (modo === 'veloci') { const q = +(r.durataMs / DURATE_RIF[id]).toFixed(2); rapporti[id] = rapporti[id] ? [Math.min(rapporti[id][0], q), Math.max(rapporti[id][1], q)] : [q, q]; }
      if (motivi.length) falliti.push({ id, chi, n, motivo: motivi.join('; ') });
      const s = +(r.durataMs / 1000).toFixed(1);
      durate[id] = durate[id] ? [Math.min(durate[id][0], s), Math.max(durate[id][1], s)] : [s, s];
      STATO.avanzamento = `${casi}/72`;
    }
  }
  return { modo, casi, falliti, durate, rapporti };
}

/** Imposta le durate di riferimento (secondi, [min, max]) da cui si calcola la metà per il salto. */
export function riferimento(durate) {
  for (const [id, [a, b]] of Object.entries(durate)) DURATE_RIF[id] = ((a + b) / 2) * 1000;
}

const STATO = { nome: null, avanzamento: '', risultato: null, errore: null, finito: false };
export function lancia(nome, ...argomenti) {
  Object.assign(STATO, { nome, avanzamento: '', risultato: null, errore: null, finito: false });
  Promise.resolve().then(() => PROVE[nome](...argomenti))
    .then((r) => { STATO.risultato = r; }, (e) => { STATO.errore = String(e && e.stack || e); })
    .finally(() => { STATO.finito = true; });
  return 'avviata';
}
export const stato = () => JSON.parse(JSON.stringify({ ...STATO, tempoFinto: Math.round(O.t / 1000) }));

const PROVE = { installaOrologio, vai, attendi, buco, fotografia, casoMeteo, provaCompleta, riferimento, lancia, stato, provaOrologio, provaSalto, provaOpzioni, provaVibrazione, provaDito, provaRisparmio, provaCorrezioni, provaMinori, ERRORI, O };
window.PROVE = PROVE;
export default PROVE;
