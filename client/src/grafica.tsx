// Simboli del pacchetto design/ (sprite.svg): inserito una volta nella pagina, poi usato con <use href>.
import spriteSvg from '../../design/svg/sprite.svg?raw';
import type { IdPecora, TipoGuaioCarta } from '../../engine/src';

export function Sprite() {
  return <div aria-hidden="true" style={{ display: 'none' }} dangerouslySetInnerHTML={{ __html: spriteSvg }} />;
}

interface PropsSimbolo {
  id: string;
  viewBox: string;
  size?: number | string;
  className?: string;
  titolo?: string;
  style?: React.CSSProperties;
}

export function Simbolo({ id, viewBox, size, className, titolo, style }: PropsSimbolo) {
  return (
    <svg
      viewBox={viewBox}
      className={className}
      width={size}
      height={size}
      role={titolo ? 'img' : undefined}
      aria-label={titolo}
      aria-hidden={titolo ? undefined : true}
      style={style}
    >
      <use href={`#${id}`} />
    </svg>
  );
}

export const Avatar = ({ pecora, size = 36, titolo }: { pecora: IdPecora; size?: number; titolo?: string }) => (
  <span className={`avatar avatar-${pecora}`} style={{ width: size, height: size }}>
    <Simbolo id={`tok-${pecora}`} viewBox="0 0 100 100" size={size} titolo={titolo} />
  </span>
);

export const Pecora = ({ pecora, size = 120 }: { pecora: IdPecora; size?: number }) => (
  <Simbolo id={`s-${pecora}`} viewBox="0 0 200 170" size={size} />
);

export const Agnellino = ({ size = 20, className }: { size?: number; className?: string }) => (
  <Simbolo id="agnello" viewBox="0 0 40 40" size={size} className={className} />
);

export const IconaGuaio = ({ tipo, size = 20, titolo }: { tipo: TipoGuaioCarta; size?: number; titolo?: string }) => (
  <Simbolo id={`ico-${tipo}`} viewBox="0 0 48 48" size={size} titolo={titolo} className={`icona-guaio guaio-${tipo}`} />
);

const FACCE: Record<string, string> = {
  pascolo_piccolo: 'd-p3',
  pascolo_grande: 'd-p5',
  furto_piccolo: 'd-f2',
  furto_grande: 'd-f4',
  testata: 'd-testata',
};

export const FacciaDado = ({ faccia, size = 96 }: { faccia: string; size?: number }) => (
  <Simbolo id={FACCE[faccia] ?? 'd-p3'} viewBox="0 0 100 100" size={size} />
);

export const Dado3D = ({ size = 120, className }: { size?: number; className?: string }) => (
  <Simbolo id="dado-3d" viewBox="0 0 160 170" size={size} className={className} />
);

export const Montone = ({ size = 220, className }: { size?: number; className?: string }) => (
  <Simbolo id="montone" viewBox="0 0 220 160" size={size} className={className} />
);

export const Retro = ({ guai = false, size = 44 }: { guai?: boolean; size?: number }) => (
  <Simbolo id={guai ? 'back-guai' : 'back-main'} viewBox="0 0 250 350" style={{ width: size, height: (size * 7) / 5 }} />
);

export const Quadrifoglio = ({ size = 20 }: { size?: number }) => <Simbolo id="qf" viewBox="0 0 32 32" size={size} />;
