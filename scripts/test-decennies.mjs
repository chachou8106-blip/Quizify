// « Années 80 » ne doit pas envoyer Wikipédia dans l'Antiquité.
import { preciserDecennie } from '/home/claude/quizify/src/wiki.js';
const cas = [
  ['Les années 80', 'Les années 1980'],
  ['années 90', 'années 1990'],
  ['Année 60', 'Année 1960'],
  ['Les années 50', 'Les années 1950'],
  ['Les années 2000', 'Les années 2000'],
  ['Les années 10', 'Les années 2010'],
  ['Les années 00', 'Les années 2000'],
  ['Les années 1980', 'Les années 1980'],
  ['Harry Potter', 'Harry Potter'],
  ['Les 80 jours de Phileas Fogg', 'Les 80 jours de Phileas Fogg'],
];
let ko = 0;
for (const [avant, attendu] of cas) {
  const r = preciserDecennie(avant);
  const bon = r === attendu;
  if (!bon) ko++;
  console.log(bon ? '✅' : '❌', `« ${avant} » → « ${r} »`);
}
console.log(ko ? `\n${ko} échec(s)` : `\n${cas.length} vérifications, 0 échec`);
if (ko) process.exit(1);
