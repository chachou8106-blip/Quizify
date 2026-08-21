// Copier un texte dans le presse-papier, sans jamais échouer en silence.
//
// `navigator.clipboard` n'existe pas partout : il exige un contexte sécurisé et
// reste absent ou bloqué dans plusieurs navigateurs intégrés (Facebook,
// Instagram, certains WebView Android). Le code d'origine écrivait
// `navigator.clipboard?.writeText(url)` : quand l'objet manquait, l'appel ne
// faisait strictement rien, sans erreur ni message. D'où le « rien ne se copie ».
//
// Renvoie true si le texte est effectivement dans le presse-papier.
export async function copier(texte) {
  // 1. La voie moderne, quand elle est disponible ET autorisée.
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texte);
      return true;
    }
  } catch { /* refusée : on tente la suite */ }

  // 2. Repli historique : un champ hors écran que l'on sélectionne et copie.
  //    Fonctionne dans les navigateurs intégrés où l'API moderne est absente.
  try {
    const zone = document.createElement('textarea');
    zone.value = texte;
    zone.setAttribute('readonly', '');
    zone.style.position = 'fixed';
    zone.style.top = '-1000px';
    zone.style.opacity = '0';
    document.body.appendChild(zone);
    zone.select();
    zone.setSelectionRange(0, texte.length); // iOS exige la plage explicite
    const ok = document.execCommand('copy');
    document.body.removeChild(zone);
    if (ok) return true;
  } catch { /* on abandonne proprement */ }

  return false;
}
