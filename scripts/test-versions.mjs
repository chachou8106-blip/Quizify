const VERSION_AUTRE = /remaster|version|\bedit\b|\bmix\b|\blive\b|radio|acoustic|acoustique|unplugged|\bdub\b|instrumental|re-?recorded|rerecorded|pianoforte|extended|\bmono\b|\bstereo\b|\bdemo\b|session/i;
const cleanTitle = (s) => String(s).replace(/\s*\((?=[^)]*(?:remaster|version|edit|mix|live|radio|acoustic|acoustique|unplugged|dub|instrumental|re-?recorded|rerecorded|pianoforte|extended|mono|stereo|demo|session))[^)]*\)/gi, '').trim();
const cas = [
  ['Creep (Acoustic)', true, 'Creep'],
  ['Take On Me (MTV Unplugged)', true, 'Take On Me'],
  ['All That She Wants (Extended Dub)', true, 'All That She Wants'],
  ['Never Gonna Give You Up (Pianoforte)', true, 'Never Gonna Give You Up'],
  ['I Will Survive (Rerecorded)', true, 'I Will Survive'],
  ['Cendrillon (Acoustique - Prise 1 - Session de travail)', true, 'Cendrillon'],
  ['Sweet Dreams (Are Made of This)', false, 'Sweet Dreams (Are Made of This)'],
  ["(I Can't Get No) Satisfaction", false, "(I Can't Get No) Satisfaction"],
  ['Perfect Duet (with Beyoncé)', false, 'Perfect Duet (with Beyoncé)'],
  ['Libérée, Délivrée (De "La Reine des Neiges"/Bande Originale Française)', false, 'Libérée, Délivrée (De "La Reine des Neiges"/Bande Originale Française)'],
  ['Billie Jean', false, 'Billie Jean'],
  ['Everybody (Backstreet\'s Back)', false, 'Everybody (Backstreet\'s Back)'],
];
let ko=0;
for (const [t, alt, propre] of cas) {
  const a = VERSION_AUTRE.test(t), c = cleanTitle(t);
  const bon = a===alt && c===propre;
  if(!bon) ko++;
  console.log(bon?'✅':'❌', JSON.stringify(t), '→', a?'version alternative':'originale', '|', JSON.stringify(c));
}
console.log(ko?`${ko} échec(s)`:`\n${cas.length} vérifications, 0 échec`);
