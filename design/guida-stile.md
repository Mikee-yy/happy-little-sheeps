# Guida di stile — Happy Little Sheeps

Riferimento visivo: `Happy Little Sheeps - Tavola di stile v2.dc.html`. Colori e misure in `design-tokens.css`.

## Il tratto
- **Un solo tratto, Notte (`--colore-inchiostro`), attorno a tutto.** A scala carta (250×350): cornice 6, forme 4, dettagli interni (riccioli, sopracciglia, righe) 3.
- Estremità e giunture sempre `round`. Niente tratteggi nelle illustrazioni (il tratteggio è riservato a "vuoto / in attesa" nell'interfaccia).
- Forme composte (vello, nuvole, cespugli): disegna i cerchi **due volte**, prima Notte con tratto 8, poi il colore senza tratto. Così resta solo il contorno esterno.

## Forme
- Tutto nasce da cerchi, ellissi e rettangoli arrotondati. Zampe = rettangoli con `rx` pari a metà larghezza.
- Vello = 5–9 cerchi sovrapposti + un'ellisse centrale. Due o tre riccioli a "u" rovesciata (tratto 3) sul vello.
- Ombra a terra solo sotto i personaggi: ellisse Notte al 15%. Nessun'altra ombra o sfumatura.

## Occhi e musi
- Occhi = cerchietti pieni r 2.5–3, **chiari su muso scuro** (o scuri su muso chiaro, solo Nerina). Mai pupille, mai riflessi.
- L'espressione la fanno sopracciglia (linee), palpebre (archi) e inclinazione della testa, non la bocca. Bocca al massimo un piccolo arco.

## Colore
- Massimo **3 pastelli per carta** + Notte + Gesso. Fondo dell'illustrazione a tinta unita, diverso dal colore dell'oggetto principale.
- Ogni colore va scritto come variabile con valore di riserva (`style="fill:var(--colore-lilla,#C4B3EE)"`), così il file si vede anche aperto da solo.
- Vermiglio (`--colore-pericolo`) **mai** nelle illustrazioni: solo avvisi di pericolo nell'interfaccia.
- Il colore del tipo di Guaio riempie l'intera carta Guaio; la sua illustrazione sta su Gesso.

## Leggibilità
- Ogni carta deve essere riconoscibile a 88–90 px: un oggetto grande e centrato, silhouette chiara, max ~30 forme.
- L'agnellino deve reggere a 20 px: non aggiungere dettagli al simbolo `#agnello`; le pose si fanno solo con `transform`.
- Testi: Bricolage Grotesque 800 maiuscolo per i nomi, Atkinson Hyperlegible 14 px per gli effetti (max 3 righe), corsivo per i testi di colore (una riga, max due).

## Tono delle illustrazioni
- Il guaio si intuisce, non si mostra: occhi nel cespuglio, zampe che spuntano da un cuscino, agnellini che rotolano via. Mai denti, sangue o contatto fisico.
- Il dado e la Testata sono momenti di festa: Limone, Menta, Albicocca, linee di velocità, sbuffi di polvere.

## Da evitare
- Sfumature, texture, ombre sfocate, luci. Contorni di spessore diverso nella stessa scena.
- Pecore distinte solo dal colore: ognuna ha sagoma, vello e accessorio propri (cappello, cerotto, margherita, occhiali, specchietto frontale).
- Croci rosse o altri emblemi sanitari protetti: la medicina si racconta con specchietto e stetoscopio.
- Qualsiasi elemento che ricordi personaggi, carte o loghi di giochi esistenti.

## Contenuto della cartella
`design-tokens.css` · `guida-stile.md` · `svg/` (sprite.svg con tutti i simboli, pecore + avatar, agnellino, montone, dado, icone, retri, logo) · `carte/modelli/` (zone commentate) · `carte/esempi/` (7 carte + 2 extra).
