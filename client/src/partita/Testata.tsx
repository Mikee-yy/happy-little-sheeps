// Minigioco della Testata del Montone (brief §3): direzione e potenza con un solo gesto, trascina e rilascia.
// Il motore riceve solo bersaglio ed esito (0–3, mai più degli agnellini del bersaglio).
import { useEffect, useRef, useState } from 'react';
import type { Azione, IdGiocatore, Vista } from '../../../engine/src';
import { Agnellino } from '../grafica';
import { T } from '../testi';
import { giocatoreDi, nome } from './descrizioni';

const L = 360; // larghezza dell'arena (unità SVG)
const H = 440;
const OVILE = { x: 30, y: 54, w: 300, h: 170 };
const PIXEL_PER_POTENZA = 24;

/** Potenza 1–10 → agnellini che cadono se si colpisce una casa piena. Troppa forza fa sbagliare. */
export function cadutiPerPotenza(p: number): number {
  if (p <= 2) return 0;
  if (p <= 4) return 1;
  if (p <= 6) return 2;
  if (p <= 8) return 3;
  if (p === 9) return 2;
  return 1;
}

/** Esito del colpo: casa piena = tutto; casa vuota = uno in meno; fuori dall'Ovile = niente. */
export function esitoColpo(potenza: number, dove: 'piena' | 'vuota' | 'fuori', massimo: number): number {
  const base = cadutiPerPotenza(potenza);
  const esito = dove === 'piena' ? base : dove === 'vuota' ? base - 1 : 0;
  return Math.max(0, Math.min(massimo, esito));
}

interface Punto {
  x: number;
  y: number;
}

export function Testata({ v, giocatore, azioni, invia }: { v: Vista; giocatore: IdGiocatore; azioni: Azione[]; invia: (a: Azione) => void }) {
  const f = v.fase.nome === 'risoluzione_dado' ? v.fase : null;
  const bersaglio = f?.dichiarazione?.effetto === 'testata' ? f.dichiarazione.bersaglio : null;
  const massimo = Math.max(0, ...azioni.filter((a) => a.tipo === 'esitoTestata').map((a) => (a.tipo === 'esitoTestata' ? a.esito : 0)));
  const svg = useRef<SVGSVGElement>(null);
  const [inizio, setInizio] = useState<Punto | null>(null);
  const [mira, setMira] = useState<Punto>({ x: L / 2, y: OVILE.y + OVILE.h / 2 });
  const [tempo, setTempo] = useState(0);
  const [colpo, setColpo] = useState<{ esito: number; punto: Punto } | null>(null);

  const posti = v.config.postiOvile;
  const colonne = Math.max(1, Math.round(posti / 3));
  const righe = Math.ceil(posti / colonne);
  const pieni = bersaglio ? giocatoreDi(v, bersaglio).agnellini : 0;
  const cw = (OVILE.w - 16) / colonne;
  const ch = (OVILE.h - 50) / righe;

  const potenza = inizio ? Math.max(1, Math.min(10, Math.round(Math.hypot(mira.x - inizio.x, mira.y - inizio.y) / PIXEL_PER_POTENZA))) : 0;
  // Il mirino oscilla, di più quando la potenza è alta.
  const oscilla = inizio ? 2 + potenza * 1.6 : 0;
  const mirino = { x: mira.x + Math.sin(tempo / 170) * oscilla, y: mira.y + Math.cos(tempo / 230) * oscilla };

  useEffect(() => {
    if (!inizio) return;
    let id = 0;
    const passo = (t: number) => {
      setTempo(t);
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [inizio]);

  useEffect(() => {
    if (!colpo) return;
    const t = setTimeout(() => invia({ tipo: 'esitoTestata', giocatore, esito: colpo.esito }), 1600);
    return () => clearTimeout(t);
  }, [colpo, giocatore, invia]);

  if (!f || !bersaglio) return null;

  const cella = (i: number) => ({
    x: OVILE.x + 8 + (i % colonne) * cw,
    y: OVILE.y + 42 + Math.floor(i / colonne) * ch,
  });
  const dove = (p: Punto): 'piena' | 'vuota' | 'fuori' => {
    for (let i = 0; i < posti; i++) {
      const c = cella(i);
      if (p.x >= c.x && p.x <= c.x + cw && p.y >= c.y && p.y <= c.y + ch) return i < pieni ? 'piena' : 'vuota';
    }
    const dentro = p.x >= OVILE.x && p.x <= OVILE.x + OVILE.w && p.y >= OVILE.y && p.y <= OVILE.y + OVILE.h;
    return dentro ? 'vuota' : 'fuori';
  };
  /** Dal punto toccato alle coordinate dell'arena: l'SVG è largo quanto il pannello e scala in modo uniforme. */
  const inSvg = (e: React.PointerEvent): Punto => {
    const r = svg.current?.getBoundingClientRect();
    if (!r || r.width === 0) return { x: L / 2, y: H / 2 };
    const scala = L / r.width;
    return {
      x: Math.max(0, Math.min(L, (e.clientX - r.left) * scala)),
      y: Math.max(0, Math.min(H, (e.clientY - r.top) * scala)),
    };
  };

  const giu = (e: React.PointerEvent) => {
    if (colpo) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = inSvg(e);
    setInizio(p);
    setMira(p);
  };
  const muovi = (e: React.PointerEvent) => {
    if (inizio && !colpo) setMira(inSvg(e));
  };
  const su = () => {
    if (!inizio || colpo) return;
    setColpo({ esito: esitoColpo(potenza, dove(mirino), massimo), punto: mirino });
    setInizio(null);
  };

  const previsione = esitoColpo(potenza, inizio ? dove(mirino) : 'piena', massimo);
  const caduti = colpo?.esito ?? 0;
  return (
    <div className="pannello testata">
      <div className="pannello-titolo">
        <h2>{T.testata.titolo}</h2>
        <p className="aiuto">{T.testata.sottotitolo(nome(v, bersaglio))}</p>
      </div>
      <svg
        ref={svg}
        className="arena"
        viewBox={`0 0 ${L} ${H}`}
        onPointerDown={giu}
        onPointerMove={muovi}
        onPointerUp={su}
        onPointerCancel={() => setInizio(null)}
        role="application"
        aria-label={T.testata.aiuto}
      >
        <polygon points={`${OVILE.x},${OVILE.y} ${OVILE.x + OVILE.w / 2},${OVILE.y - 34} ${OVILE.x + OVILE.w},${OVILE.y}`} className="ovile-tetto" />
        <rect x={OVILE.x} y={OVILE.y} width={OVILE.w} height={OVILE.h} rx={14} className="ovile-pannello" />
        <text x={OVILE.x + 12} y={OVILE.y + 26} className="ovile-nome">
          {nome(v, bersaglio)} · {pieni}/{posti}
        </text>
        {Array.from({ length: posti }, (_, i) => {
          const c = cella(i);
          const piena = i < pieni;
          const cade = colpo && piena && i >= pieni - caduti;
          return (
            <g key={i}>
              <rect x={c.x + 3} y={c.y + 3} width={cw - 6} height={ch - 6} rx={8} className={piena ? 'casa piena' : 'casa vuota'} />
              {piena && (
                <g className={cade ? 'agnellino-cade' : ''} style={{ transformOrigin: `${c.x + cw / 2}px ${c.y + ch / 2}px` }}>
                  <svg x={c.x + cw / 2 - 14} y={c.y + ch / 2 - 14} width={28} height={28} viewBox="0 0 40 40">
                    <use href="#agnello" />
                  </svg>
                </g>
              )}
            </g>
          );
        })}
        {inizio && (
          <line x1={150} y1={350} x2={mirino.x} y2={mirino.y} className="traiettoria" />
        )}
        {(inizio || colpo) && (
          <g transform={`translate(${(colpo?.punto ?? mirino).x} ${(colpo?.punto ?? mirino).y})`} className="mirino">
            <circle r={26} className="mirino-fondo" />
            <circle r={26} className="mirino-anello" />
            <line x1={-34} x2={-20} y1={0} y2={0} />
            <line x1={20} x2={34} y1={0} y2={0} />
            <line y1={-34} y2={-20} x1={0} x2={0} />
            <line y1={20} y2={34} x1={0} x2={0} />
            <circle r={3} className="mirino-centro" />
          </g>
        )}
        <g
          className={`montone-gruppo ${colpo ? 'carica' : ''}`}
          style={colpo ? { transform: `translate(${colpo.punto.x - 200}px, ${colpo.punto.y - 300}px)` } : undefined}
        >
          <svg x={0} y={290} width={210} height={150} viewBox="0 0 220 160">
            <use href="#montone" />
          </svg>
        </g>
      </svg>
      <div className="potenza" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`tacca-potenza ${i < potenza ? 'carica' : ''} ${i < 4 ? 'verde' : i < 7 ? 'gialla' : 'arancio'}`} />
        ))}
      </div>
      <p className="etichetta">{colpo ? T.testata.risultato(colpo.esito) : inizio ? T.testata.potenza(potenza, previsione) : T.testata.aiuto}</p>
      {colpo && (
        <div className="caduti">
          {Array.from({ length: colpo.esito }, (_, i) => (
            <Agnellino key={i} size={30} className="agnellino-rotola" />
          ))}
        </div>
      )}
    </div>
  );
}
