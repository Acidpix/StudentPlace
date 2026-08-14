import { solveSeating } from "./solver";
import type { SolverInput, SolverResult } from "./types";

const TIMEOUT_MS = 20_000;

/**
 * Lance le placement automatique dans un Web Worker, avec repli sur le thread
 * principal.
 *
 * Le repli n'est pas de la coquetterie : si l'empaquetage du worker échoue sur
 * une configuration particulière, mieux vaut une interface qui se fige une
 * demi-seconde qu'un bouton « Placer automatiquement » qui ne fait rien.
 */
export async function runSolver(input: SolverInput): Promise<SolverResult> {
  if (typeof window !== "undefined" && typeof Worker !== "undefined") {
    try {
      return await runInWorker(input);
    } catch (error) {
      console.warn("[placement] Worker indisponible, calcul sur le thread principal.", error);
    }
  }

  return solveSeating(input);
}

function runInWorker(input: SolverInput): Promise<SolverResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./solver.worker.ts", import.meta.url));

    const cleanup = () => {
      clearTimeout(timer);
      worker.terminate();
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Le calcul a dépassé le temps imparti."));
    }, TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<{ ok: boolean; result?: SolverResult; error?: string }>) => {
      cleanup();
      if (event.data.ok && event.data.result) {
        resolve(event.data.result);
      } else {
        reject(new Error(event.data.error ?? "Le solveur n'a rien renvoyé."));
      }
    };

    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || "Erreur du worker de placement."));
    };

    worker.postMessage(input);
  });
}
