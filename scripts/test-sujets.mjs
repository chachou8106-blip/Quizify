// Un sujet collectif ne doit pas être ancré sur un article d'encyclopédie.
const estUnSujetCollectif = (s) => /^(les|des|mes|nos)\s+[\p{L}'’-]+(s|x)\b/iu.test(String(s || '').trim());
const cas = [
  ['Les capitales du monde', true],
  ['Les chanteurs français', true],
  ['Les célébrités françaises', true],
  ['Les dessins animés', true],
  ['Les émissions de télévision françaises', true],
  ['Les fromages français', true],
  ['Les jeux vidéo cultes', true],
  ['Des animaux extraordinaires', true],
  ['Harry Potter', false],
  ['Le Tour de France', false],
  ['La Révolution française', false],
  ['Le système solaire', false],
  ['La mythologie grecque', false],
  ['La Formule 1', false],
  ['Le corps humain', false],
  ['Michael Jackson', false],
  ['La cuisine italienne', false],
  ['Le mariage de Julie et Tom', false],
];
let ko = 0;
for (const [sujet, att] of cas) {
  const r = estUnSujetCollectif(sujet);
  if (r !== att) { ko++; console.log('❌', `« ${sujet} » → ${r}, attendu ${att}`); }
  else console.log('✅', `« ${sujet} » → ${r ? 'culture générale' : 'ancré sur l’article'}`);
}
console.log(ko ? `\n${ko} échec(s)` : `\n${cas.length} vérifications, 0 échec`);
if (ko) process.exit(1);
