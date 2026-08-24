const normTxt = (s) => String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]+/g,' ').trim();
const ok = (cible, trouve) => {
  const brut=String(trouve); const a=normTxt(brut), c=normTxt(cible);
  if (a===c) return true;
  if (c.startsWith(a+' ')) return true;
  if (a.startsWith(c+' ')) return /[&,]|\bfeat\.?\b|\bft\.?\b|\bwith\b|\bvs\.?\b/i.test(brut);
  return false;
};
const cas = [
  ['The Who','Who',false], ['Warren','Alex Warren',false], ['Bob Marley & The Wailers','Bob Marley',true],
  ['Earth, Wind & Fire','Earth, Wind & Fire',true], ['Kassav\'','Kassav\'',true], ['a-ha','a-ha',true],
  ['AC/DC','AC/DC',true], ['Édith Piaf','Edith Piaf',true], ['Jean-Philippe Marthély','Jean-philippe Marthely',true],
  ['Boney M.','Boney M.',true], ['R.E.M.','R.E.M.',true], ['P!nk','P!nk',true], ['(G)I-DLE','(G)I-DLE',true],
  ['Los del Río','Los Del Río',true], ['Michael Jackson','Michael Jackson & Paul McCartney',true],
  ['Queen','Queen Latifah',false], ['Chic','Chico & The Gypsies',false], ['Indila','Indila',true],
];
let ko=0;
for (const [c,t,att] of cas) { const r=ok(c,t); if (r!==att){ko++; console.log('❌',c,'→',t,'attendu',att,'obtenu',r);} else console.log('✅',c,'→',t,r?'accepté':'écarté'); }
console.log(ko?`${ko} échec(s)`:'\n18 vérifications, 0 échec');
