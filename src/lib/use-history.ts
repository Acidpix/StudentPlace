"use client";

import { useCallback, useMemo, useState } from "react";

const HISTORY_LIMIT = 60;

interface HistoryState<T> {
  states: T[];
  index: number;
}

/**
 * Pile d'annulation générique.
 *
 * On conserve des instantanés complets plutôt qu'un journal de commandes
 * inversibles : l'agencement d'une salle est un objet minuscule, et un
 * instantané ne peut pas « se désynchroniser » comme le ferait une commande
 * inverse mal écrite.
 */
export function useHistory<T>(initial: T) {
  const [history, setHistory] = useState<HistoryState<T>>({ states: [initial], index: 0 });

  const current = history.states[history.index];

  const commit = useCallback((next: T) => {
    setHistory((previous) => {
      // Toute nouvelle action efface les états rétablissables.
      const states = [...previous.states.slice(0, previous.index + 1), next].slice(-HISTORY_LIMIT);
      return { states, index: states.length - 1 };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((previous) => ({ ...previous, index: Math.max(0, previous.index - 1) }));
  }, []);

  const redo = useCallback(() => {
    setHistory((previous) => ({
      ...previous,
      index: Math.min(previous.states.length - 1, previous.index + 1),
    }));
  }, []);

  /** Repart d'un état neuf, sans historique : après un enregistrement réussi. */
  const reset = useCallback((next: T) => {
    setHistory({ states: [next], index: 0 });
  }, []);

  return useMemo(
    () => ({
      current,
      commit,
      undo,
      redo,
      reset,
      canUndo: history.index > 0,
      canRedo: history.index < history.states.length - 1,
    }),
    [current, commit, undo, redo, reset, history.index, history.states.length],
  );
}
