// Pagina di prova per lo sviluppo (client/prova.html, non pubblicata): tre telefoni affiancati,
// host e due ospiti collegati a un database in memoria. Serve a vedere le schermate a più dispositivi senza Firebase.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../design/design-tokens.css';
import './stile.css';
import { SessioneHost } from '../../sync/host';
import { archivioInMemoria } from '../../sync/locale';
import { SessioneOspite } from '../../sync/ospite';
import type { Iscrizione } from '../../sync/stanza';
import { ArchivioMemoria } from '../../sync/trasporto-memoria';
import { Sprite } from './grafica';
import { Stanza } from './remoto/Stanza';

async function avvia() {
  const rete = new ArchivioMemoria();
  const host = await SessioneHost.crea(rete.dispositivo('uid-ada'), archivioInMemoria(), { nome: 'Ada', pecora: 'ricciolo', gettone: 'a' });
  const ospiti = [
    await SessioneOspite.entra(rete.dispositivo('uid-bea'), host.codice, { nome: 'Bea', pecora: 'brontolana', gettone: 'b' }),
    await SessioneOspite.entra(rete.dispositivo('uid-cleo'), host.codice, { nome: 'Cleo', pecora: 'sospirella', gettone: 'c' }),
  ];
  const iscrizione = (ruolo: Iscrizione['ruolo'], nome: string): Iscrizione => ({
    codice: host.codice,
    ruolo,
    idGiocatore: ruolo === 'host' ? 'g1' : null,
    nome,
    pecora: 'ricciolo',
    gettone: nome,
  });
  const nulla = () => undefined;
  createRoot(document.getElementById('prova')!).render(
    <StrictMode>
      <Sprite />
      <div className="prova-telefoni">
        <section className="prova-telefono" aria-label="Ada (host)">
          <Stanza sessione={host} iscrizione={iscrizione('host', 'Ada')} onEsci={nulla} onRegole={nulla} />
        </section>
        <section className="prova-telefono" aria-label="Bea">
          <Stanza sessione={ospiti[0]!} iscrizione={iscrizione('ospite', 'Bea')} onEsci={nulla} onRegole={nulla} />
        </section>
        <section className="prova-telefono" aria-label="Cleo">
          <Stanza sessione={ospiti[1]!} iscrizione={iscrizione('ospite', 'Cleo')} onEsci={nulla} onRegole={nulla} />
        </section>
      </div>
    </StrictMode>,
  );
  // Per i test a mano dalla console: scollegare un ospite, ecc.
  Object.assign(globalThis, { prova: { rete, host, ospiti } });
}

void avvia();
