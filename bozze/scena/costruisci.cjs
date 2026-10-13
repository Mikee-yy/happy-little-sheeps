// Costruisce la bozza della scena: inserisce lo sprite del pacchetto design/ (senza metadati) al posto del segnaposto.
// Da riga di comando scrive scena.html; server.cjs la usa per servirla con la ricarica automatica.
const fs = require('fs');
const path = require('path');

const radice = path.join(__dirname, '..', '..');
const SORGENTE = path.join(__dirname, 'scena.src.html');
const SPRITE = path.join(radice, 'design', 'svg', 'sprite.svg');

function costruisci(extraTesta = '') {
  let sprite = fs.readFileSync(SPRITE, 'utf8');
  sprite = sprite.replace(/<metadata>[\s\S]*?<\/metadata>/g, '').replace(/\s+xmlns:c2pa="[^"]*"/, '').replace(/<\?xml[^>]*>/, '');
  sprite = sprite.replace('<svg ', '<svg aria-hidden="true" width="0" height="0" ').replace('style="display:none"', 'style="position:absolute;width:0;height:0;overflow:hidden"');
  const src = fs.readFileSync(SORGENTE, 'utf8');
  if (!src.includes('<!--SPRITE-->')) throw new Error('segnaposto mancante');
  // Per aprirla in locale serve l'intestazione completa della pagina.
  const testa = '<!doctype html>\n<html lang="it">\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + extraTesta;
  return testa + src.replace('<!--SPRITE-->', sprite);
}

module.exports = { costruisci, SORGENTE, SPRITE };

if (require.main === module) {
  const html = costruisci();
  fs.writeFileSync(path.join(__dirname, 'scena.html'), html);
  console.log('scena.html', Buffer.byteLength(html), 'byte');
}
