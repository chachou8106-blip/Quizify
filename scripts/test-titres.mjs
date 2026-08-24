// Choix de l'enregistrement pour un titre demandé.
const normTxt = (s) => String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]+/g,' ').trim();
const VERSION_AUTRE = /remaster|version|\bedit\b|\bmix\b|\blive\b|radio|acoustic|acoustique|unplugged|\bdub\b|instrumental|re-?recorded|rerecorded|pianoforte|extended|\bmono\b|\bstereo\b|\bdemo\b|session/i;
const versionAlternative = (t) => VERSION_AUTRE.test(t.title) ? 1 : 0;
const proximite = (t, v) => { const ti = normTxt(t.title); return ti === v ? 0 : ti.startsWith(v) ? 1 : 2; };
function choisir(catalogue, titre) {
  const v = normTxt(titre);
  const c = catalogue.map((x)=>({title:x})).filter((t) => normTxt(t.title).includes(v));
  if (!c.length) return null;
  c.sort((a,b)=>proximite(a,v)-proximite(b,v)||versionAlternative(a)-versionAlternative(b));
  return c[0].title;
}
const cas = [
  [['December (Based on "September")','September'],'September','September'],
  [['Macarena Christmas','Macarena'],'Macarena','Macarena'],
  [['Creep (Acoustic)','Creep'],'Creep','Creep'],
  [['All That She Wants (Extended Dub)','All That She Wants'],'All That She Wants','All That She Wants'],
  [["Rocket Man (I Think It's Going To Be A Long, Long Time)"],'Rocket Man',"Rocket Man (I Think It's Going To Be A Long, Long Time)"],
  [['Désenchantée (feat. Feder)','Désenchantée'],'Désenchantée','Désenchantée'],
  [['Wonderwall - Remastered','Wonderwall'],'Wonderwall','Wonderwall'],
  [['Hey Jude'],'Hey Jude','Hey Jude'],
  [['Thriller (Live)'],'Thriller','Thriller (Live)'],
];
let ko=0;
for (const [cat, demande, attendu] of cas) {
  const r = choisir(cat, demande);
  const bon = r === attendu;
  if(!bon) ko++;
  console.log(bon?'✅':'❌', `« ${demande} » → ${JSON.stringify(r)}`);
}
console.log(ko?`${ko} échec(s)`:`\n${cas.length} vérifications, 0 échec`);
