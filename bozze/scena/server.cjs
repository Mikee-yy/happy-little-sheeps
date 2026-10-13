// Server locale per la bozza della scena (solo sviluppo): serve la pagina e la ricarica nel browser a ogni salvataggio.
const http = require('http');
const fs = require('fs');
const { costruisci, SORGENTE, SPRITE } = require('./costruisci.cjs');

const PORTA = Number(process.env.PORT || process.env.PORTA || 5180);
const PROVE = require('path').join(__dirname, 'prove.js');
const clienti = new Set();
const RICARICA = `<script>new EventSource('/ricarica').onmessage = () => location.reload();</script>\n`;

http.createServer((req, res) => {
  if (req.url === '/ricarica') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': collegato\n\n');
    clienti.add(res);
    req.on('close', () => clienti.delete(res));
    return;
  }
  if (req.url === '/' || req.url.startsWith('/?') || req.url === '/scena.html') {
    try {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(costruisci(RICARICA));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(e));
    }
    return;
  }
  // Banco di prova (solo sviluppo): script da caricare nella pagina dal browser interno.
  if (req.url.split('?')[0] === '/prove.js') {
    try {
      const testo = fs.readFileSync(PROVE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(testo);
    } catch (e) {
      res.writeHead(404); res.end(String(e));
    }
    return;
  }
  res.writeHead(404); res.end();
}).listen(PORTA, 'localhost', () => console.log(`Bozza della scena su http://localhost:${PORTA}`));

let attesa = null;
const avvisa = () => { clearTimeout(attesa); attesa = setTimeout(() => { for (const c of clienti) c.write('data: ricarica\n\n'); }, 120); };
for (const f of [SORGENTE, SPRITE]) fs.watch(f, avvisa);
// Tiene viva la connessione dei browser collegati.
setInterval(() => { for (const c of clienti) c.write(': ping\n\n'); }, 20000);
