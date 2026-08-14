import { solveSeating } from "./solver";
import type { SolverInput } from "./types";

/**
 * Exécute le placement automatique hors du thread principal, pour que
 * l'interface reste réactive pendant le calcul.
 */

/**
 * Le fichier est compilé avec la bibliothèque « dom », dans laquelle `self`
 * est une `Window` — dont `postMessage` attend une origine cible. On le
 * retype donc localement, plutôt que de basculer tout le projet sur la
 * bibliothèque « webworker ».
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent<SolverInput>) => void) | null;
  postMessage: (message: unknown) => void;
}

const context = self as unknown as WorkerScope;

context.onmessage = (event: MessageEvent<SolverInput>) => {
  try {
    context.postMessage({ ok: true, result: solveSeating(event.data) });
  } catch (error) {
    context.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Erreur inconnue du solveur.",
    });
  }
};
