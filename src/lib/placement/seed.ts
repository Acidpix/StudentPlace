/**
 * Graines déterministes pour le placement automatique.
 *
 * Le solveur est reproductible depuis toujours — même graine, même plan — mais
 * l'éditeur en tirait une au hasard à chaque clic. Deux appels d'affilée
 * donnaient donc deux dispositions sans rapport, sans moyen de revenir à la
 * précédente. On dérive désormais la graine de l'identifiant du plan de classe :
 * « Placer automatiquement » redonne toujours la même proposition, et c'est
 * « Autre proposition » qui incrémente la variante.
 */

/**
 * FNV-1a 32 bits.
 *
 * Choisi pour sa brièveté et sa bonne dispersion sur des chaînes courtes ; ce
 * n'est pas une fonction de hachage cryptographique et il n'y a aucune raison
 * qu'elle le soit — elle n'amorce qu'un générateur pseudo-aléatoire.
 */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Graine stable d'un plan de classe.
 *
 * `variant` distingue les propositions successives : 0 est la proposition de
 * référence, celle que « Placer automatiquement » redonne indéfiniment.
 */
export function seedFromId(id: string, variant = 0): number {
  return fnv1a(`${id}#${variant}`) % 2_147_483_647;
}
