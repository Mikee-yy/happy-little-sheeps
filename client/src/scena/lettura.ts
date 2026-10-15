// Lettura di una carta (bozza scena.src.html, righe 2533–2544): la carta in grande sopra la scena.
// I gesti dell'interfaccia usano tempo vero (`animaInterfaccia`, velocità 1).
import type { IdCarta } from '../../../engine/src';
import { T } from '../testi';
import { cartaSVG } from './carte/carte';
import type { Contesto } from './contesto';

export interface Lettura {
  /** `tenuta`: aperta con la tenuta del dito (si chiude al rilascio); altrimenti con un tocco. */
  apri(id: IdCarta, tenuta: boolean): void;
  chiudi(): void;
  aperta(): boolean;
}

/** `alApertura` serve a chi vuole nascondere i consigli quando una carta si legge (bozza: `nascondiConsiglio(2)`). */
export function creaLettura(ctx: Contesto, o: { alApertura?: () => void } = {}): Lettura {
  let elemento: HTMLElement | null = null;
  const lettura: Lettura = {
    apri(id, tenuta) {
      lettura.chiudi();
      const el = document.createElement('div');
      el.className = 'lettura';
      el.innerHTML = `<div class="grande">${cartaSVG(id, true)}</div><span>${tenuta ? T.scena.lettura.lascia : T.scena.lettura.tocca}</span>`;
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        lettura.chiudi();
      });
      ctx.el.ui.appendChild(el);
      elemento = el;
      ctx.animaInterfaccia(
        el.firstElementChild!,
        [
          { transform: 'scale(.6) translateY(80px)', opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: ctx.ridotto ? 1 : 220, easing: 'cubic-bezier(.3,1.3,.5,1)' },
      );
      o.alApertura?.();
    },
    chiudi() {
      if (elemento) {
        elemento.remove();
        elemento = null;
      }
    },
    aperta: () => elemento !== null,
  };
  return lettura;
}
