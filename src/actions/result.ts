/**
 * Résultat uniforme des Server Actions.
 *
 * On renvoie une valeur plutôt que de lever une exception : côté client, un
 * message d'erreur affichable vaut mieux qu'une page d'erreur générique.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

/** Message de la première erreur d'un `safeParse` Zod. */
export function firstIssue(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? "Données invalides.";
}
