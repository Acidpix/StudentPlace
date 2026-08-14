import { ADJACENCY_CM } from "@/lib/domain";

import { distanceCm } from "./geometry";
import {
  DEFAULT_WEIGHTS,
  type SolverAssignment,
  type SolverInput,
  type SolverResult,
  type SolverSeat,
  type SolverStudent,
  type SolverWeights,
  type Violation,
} from "./types";

/**
 * Placement automatique des élèves.
 *
 * La fonction est PURE et sans dépendance au navigateur : elle tourne aussi
 * bien dans un Web Worker que dans un test Vitest.
 *
 * Principe : on construit une affectation de départ raisonnable (les élèves
 * les plus difficiles au plus près du bureau), puis on l'améliore par recuit
 * simulé — des échanges de places au hasard, acceptés s'ils réduisent le coût,
 * et parfois acceptés même s'ils l'aggravent, ce qui permet de s'extraire des
 * optima locaux. Plusieurs redémarrages indépendants, on garde le meilleur.
 *
 * Le coût agrège des contraintes DURES (incompatibilités, premier rang), très
 * lourdement pénalisées, et des contraintes SOUPLES (proximité du bureau,
 * isolement, affinités, gauchers) pondérées et négociables entre elles.
 *
 * Le coût est recalculé intégralement à chaque itération. C'est un choix
 * assumé : un calcul incrémental serait plus rapide mais bien plus facile à
 * fausser, et sur une salle réelle (≤ 40 places) le calcul complet reste de
 * l'ordre de la dizaine de millisecondes.
 *
 * Deux entrées facultatives gouvernent la stabilité du résultat :
 * `seed` (voir seed.ts) rend le calcul reproductible, et le couple
 * `previous` / `weights.stability` demande de rester proche d'un plan existant.
 */

/** Générateur pseudo-aléatoire déterministe : même graine, même plan. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tri stable : difficulté décroissante, besoins prioritaires, puis id. */
function compareStudents(a: SolverStudent, b: SolverStudent): number {
  if (b.difficulty !== a.difficulty) return b.difficulty - a.difficulty;
  if (a.needsFront !== b.needsFront) return a.needsFront ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function solveSeating(input: SolverInput): SolverResult {
  const startedAt = Date.now();

  const weights: SolverWeights = { ...DEFAULT_WEIGHTS, ...input.weights };
  const adjacencyCm = input.adjacencyCm ?? ADJACENCY_CM;
  const proximityCm = input.proximityCm;
  const baseSeed = input.seed ?? Math.floor(Math.random() * 2_147_483_647);
  const iterations = input.iterations ?? 10_000;
  const restarts = Math.max(1, input.restarts ?? 4);

  const seats: SolverSeat[] = input.seats;
  const nSeats = seats.length;

  if (nSeats === 0) {
    return {
      assignments: [],
      unplacedStudentIds: input.students.map((s) => s.id),
      violations: [
        {
          kind: "NOT_ENOUGH_SEATS",
          message: "Cette salle ne contient aucune place. Ajoutez des tables avant de placer les élèves.",
          studentIds: input.students.map((s) => s.id),
          seatIds: [],
        },
      ],
      cost: 0,
      seed: baseSeed,
      durationMs: Date.now() - startedAt,
    };
  }

  const seatIndexById = new Map<string, number>();
  seats.forEach((seat, index) => seatIndexById.set(seat.id, index));

  // ---------------------------------------------------------------- élèves
  // Les élèves verrouillés sont retenus en priorité : leur place est imposée
  // par le professeur et ne se négocie pas, même si la salle est trop petite.
  const studentById = new Map(input.students.map((s): [string, SolverStudent] => [s.id, s]));
  const takenPinnedSeats = new Set<number>();
  const pinnedPairs: Array<{ student: SolverStudent; seatIndex: number }> = [];

  for (const [studentId, seatId] of Object.entries(input.pinned)) {
    const student = studentById.get(studentId);
    const seatIndex = seatIndexById.get(seatId);
    if (!student || seatIndex === undefined) continue;
    if (takenPinnedSeats.has(seatIndex)) continue;
    takenPinnedSeats.add(seatIndex);
    pinnedPairs.push({ student, seatIndex });
  }

  const pinnedStudentIds = new Set(pinnedPairs.map((p) => p.student.id));
  const freeStudents = input.students
    .filter((s) => !pinnedStudentIds.has(s.id))
    .sort(compareStudents);

  const freeCapacity = Math.max(0, nSeats - pinnedPairs.length);
  const seatedFreeStudents = freeStudents.slice(0, freeCapacity);
  const unplacedStudentIds = freeStudents.slice(freeCapacity).map((s) => s.id);

  const students: SolverStudent[] = [...pinnedPairs.map((p) => p.student), ...seatedFreeStudents];
  const nStudents = students.length;
  const studentIndexById = new Map<string, number>();
  students.forEach((student, index) => studentIndexById.set(student.id, index));

  // Plan de départ : place d'origine de chaque élève, -1 s'il n'en avait pas.
  // Sert à l'amorçage de la recherche ET au terme d'inertie du coût.
  //
  // `previous` et `weights.stability` vont de pair : sans poids, l'inertie est
  // désactivée d'un bloc et le plan de départ n'influence rien — ni le coût, ni
  // l'état initial. Une seule condition gouverne les deux, faute de quoi
  // transmettre `previous` changerait discrètement le résultat.
  const previousSeat = new Int32Array(nStudents).fill(-1);
  let anyPrevious = false;
  for (const [studentId, seatId] of Object.entries(input.previous ?? {})) {
    const studentIndex = studentIndexById.get(studentId);
    const seatIndex = seatIndexById.get(seatId);
    if (studentIndex === undefined || seatIndex === undefined) continue;
    previousSeat[studentIndex] = seatIndex;
    anyPrevious = true;
  }
  const useInertia = anyPrevious && weights.stability > 0;

  // ---------------------------------------------------- données précalculées
  const dist = new Float64Array(nSeats * nSeats);
  for (let i = 0; i < nSeats; i++) {
    for (let j = i + 1; j < nSeats; j++) {
      const d = distanceCm(seats[i], seats[j]);
      dist[i * nSeats + j] = d;
      dist[j * nSeats + i] = d;
    }
  }

  // Point de référence pour « être près du professeur ». Sans bureau défini,
  // on retient un point fictif juste devant la première rangée.
  const reference =
    input.teacherDesk ??
    (() => {
      const meanX = seats.reduce((sum, s) => sum + s.x, 0) / nSeats;
      const minY = Math.min(...seats.map((s) => s.y));
      return { x: meanX, y: minY - 100 };
    })();

  const rawDeskDist = seats.map((seat) => distanceCm(seat, reference));
  const maxDeskDist = Math.max(...rawDeskDist, 1);
  const deskDistNorm = Float64Array.from(rawDeskDist.map((d) => d / maxDeskDist));

  // Le premier tiers des places, mesuré depuis le tableau (en haut de la salle).
  const frontSeatCount = Math.max(1, Math.ceil(nSeats / 3));
  const isFrontSeat = new Uint8Array(nSeats);
  seats
    .map((seat, index) => ({ index, y: seat.y, x: seat.x }))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, frontSeatCount)
    .forEach(({ index }) => {
      isFrontSeat[index] = 1;
    });

  const neighbours: number[][] = seats.map((_, i) => {
    const list: number[] = [];
    for (let j = 0; j < nSeats; j++) {
      if (i !== j && dist[i * nSeats + j] <= adjacencyCm) list.push(j);
    }
    return list;
  });

  const isEndSeat = Uint8Array.from(seats.map((s) => (s.isEndSeat ? 1 : 0)));
  const studentWeight = Float64Array.from(students.map((s) => (s.difficulty - 1) / 4));
  const needsFront = Uint8Array.from(students.map((s) => (s.needsFront ? 1 : 0)));
  const leftHanded = Uint8Array.from(students.map((s) => (s.leftHanded ? 1 : 0)));

  const toIndexPairs = (pairs: Array<{ a: string; b: string }>): Array<[number, number]> =>
    pairs
      .map(({ a, b }): [number | undefined, number | undefined] => [
        studentIndexById.get(a),
        studentIndexById.get(b),
      ])
      .filter((pair): pair is [number, number] => pair[0] !== undefined && pair[1] !== undefined);

  const incompatiblePairs = toIndexPairs(input.incompatibles);
  const affinityPairs = toIndexPairs(input.affinities);

  // ------------------------------------------------------------------- état
  const occupant = new Int32Array(nSeats).fill(-1);
  const seatOfStudent = new Int32Array(nStudents).fill(-1);

  function place(studentIndex: number, seatIndex: number): void {
    occupant[seatIndex] = studentIndex;
    seatOfStudent[studentIndex] = seatIndex;
  }

  function swap(i: number, j: number): void {
    const a = occupant[i];
    const b = occupant[j];
    occupant[i] = b;
    occupant[j] = a;
    if (a >= 0) seatOfStudent[a] = j;
    if (b >= 0) seatOfStudent[b] = i;
  }

  function computeCost(): number {
    let cost = 0;

    // Contrainte dure : deux élèves incompatibles trop proches. La pénalité
    // croît à mesure qu'ils se rapprochent, pour guider la recherche plutôt
    // que de lui présenter une falaise.
    for (const [sa, sb] of incompatiblePairs) {
      const ia = seatOfStudent[sa];
      const ib = seatOfStudent[sb];
      if (ia < 0 || ib < 0) continue;
      const d = dist[ia * nSeats + ib];
      if (d < proximityCm) {
        cost += weights.incompatible * (1 + (proximityCm - d) / Math.max(proximityCm, 1));
      }
    }

    // Contrainte dure : vue ou audition, l'élève doit être au premier rang.
    for (let s = 0; s < nStudents; s++) {
      if (!needsFront[s]) continue;
      const seat = seatOfStudent[s];
      if (seat >= 0 && !isFrontSeat[seat]) cost += weights.needsFront;
    }

    for (let i = 0; i < nSeats; i++) {
      const s = occupant[i];
      if (s < 0) continue;
      const w = studentWeight[s];

      // Plus l'élève est difficile, plus l'éloignement du bureau coûte cher.
      cost += weights.proximityToDesk * w * deskDistNorm[i];

      if (leftHanded[s] && !isEndSeat[i]) cost += weights.leftHanded;

      let occupiedNeighbours = 0;
      for (const j of neighbours[i]) {
        const t = occupant[j];
        if (t < 0) continue;
        occupiedNeighbours++;
        // `j > i` : chaque paire de voisins n'est comptée qu'une fois.
        if (j > i) cost += weights.isolation * w * studentWeight[t];
      }
      // Isoler, c'est aussi limiter le NOMBRE de voisins d'un élève difficile.
      cost += weights.isolationNeighbours * w * occupiedNeighbours;
    }

    // Contrainte souple : rapprocher les élèves qui travaillent bien ensemble.
    for (const [sa, sb] of affinityPairs) {
      const ia = seatOfStudent[sa];
      const ib = seatOfStudent[sb];
      if (ia < 0 || ib < 0) continue;
      if (dist[ia * nSeats + ib] > adjacencyCm) cost += weights.affinity;
    }

    // Inertie : chaque élève déplacé par rapport au plan de départ coûte un
    // forfait. Le solveur ne bouge donc quelqu'un que si le gain dépasse ce
    // forfait, ce qui transforme « Améliorer » en retouche plutôt qu'en
    // redistribution complète.
    if (useInertia) {
      for (let s = 0; s < nStudents; s++) {
        const origin = previousSeat[s];
        if (origin >= 0 && seatOfStudent[s] !== origin) cost += weights.stability;
      }
    }

    return cost;
  }

  // ------------------------------------------------- affectation de départ
  const pinnedSeatIndices = new Set(pinnedPairs.map((p) => p.seatIndex));
  const freeSeatIndices: number[] = [];
  for (let i = 0; i < nSeats; i++) {
    if (!pinnedSeatIndices.has(i)) freeSeatIndices.push(i);
  }

  const seatsByDesk = [...freeSeatIndices].sort((a, b) => deskDistNorm[a] - deskDistNorm[b]);
  const seatsByFront = [...freeSeatIndices].sort(
    (a, b) => seats[a].y - seats[b].y || seats[a].x - seats[b].x,
  );

  function buildInitialState(shuffle: boolean, rng: () => number): void {
    occupant.fill(-1);
    seatOfStudent.fill(-1);

    for (const { student, seatIndex } of pinnedPairs) {
      const studentIndex = studentIndexById.get(student.id);
      if (studentIndex !== undefined) place(studentIndex, seatIndex);
    }

    const available = new Set(freeSeatIndices);

    let freeIndices = seatedFreeStudents.map((s) => studentIndexById.get(s.id)!);

    // Reprise du plan de départ : chaque élève retrouve sa place si elle est
    // encore disponible, les autres passent par la construction gloutonne.
    // Réservé au premier redémarrage — les suivants doivent explorer ailleurs,
    // sans quoi les quatre redémarrages exploreraient le même voisinage.
    if (!shuffle && useInertia) {
      const unseated: number[] = [];
      for (const studentIndex of freeIndices) {
        const seatIndex = previousSeat[studentIndex];
        if (seatIndex >= 0 && available.has(seatIndex)) {
          available.delete(seatIndex);
          place(studentIndex, seatIndex);
        } else {
          unseated.push(studentIndex);
        }
      }
      freeIndices = unseated;
    }

    // Les élèves à placer devant sont servis en premier : leur contrainte est
    // dure et les places du premier rang sont rares.
    const frontFirst = freeIndices.filter((s) => needsFront[s]);
    const others = freeIndices.filter((s) => !needsFront[s]);

    if (shuffle) {
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
    }

    for (const studentIndex of frontFirst) {
      const seatIndex = seatsByFront.find((s) => available.has(s));
      if (seatIndex === undefined) break;
      available.delete(seatIndex);
      place(studentIndex, seatIndex);
    }

    for (const studentIndex of others) {
      const seatIndex = seatsByDesk.find((s) => available.has(s));
      if (seatIndex === undefined) break;
      available.delete(seatIndex);
      place(studentIndex, seatIndex);
    }
  }

  // ------------------------------------------------------- recuit simulé
  let globalBestCost = Number.POSITIVE_INFINITY;
  let globalBestOccupant = new Int32Array(nSeats).fill(-1);

  const movableSeats = freeSeatIndices;

  for (let restart = 0; restart < restarts; restart++) {
    const rng = mulberry32(baseSeed + restart * 7919);
    buildInitialState(restart > 0, rng);

    let currentCost = computeCost();
    let bestCost = currentCost;
    const bestOccupant = Int32Array.from(occupant);

    if (movableSeats.length >= 2) {
      const startTemperature = Math.max(1, currentCost * 0.05);
      const endTemperature = 0.1;
      const ratio = endTemperature / startTemperature;

      for (let iter = 0; iter < iterations; iter++) {
        const temperature = startTemperature * Math.pow(ratio, iter / iterations);

        const i = movableSeats[Math.floor(rng() * movableSeats.length)];
        const j = movableSeats[Math.floor(rng() * movableSeats.length)];
        if (i === j) continue;
        // Échanger deux places vides ne change rien.
        if (occupant[i] === -1 && occupant[j] === -1) continue;

        swap(i, j);
        const candidateCost = computeCost();
        const delta = candidateCost - currentCost;

        if (delta <= 0 || rng() < Math.exp(-delta / temperature)) {
          currentCost = candidateCost;
          if (currentCost < bestCost) {
            bestCost = currentCost;
            bestOccupant.set(occupant);
          }
        } else {
          swap(i, j); // refusé : on revient en arrière
        }
      }
    }

    if (bestCost < globalBestCost) {
      globalBestCost = bestCost;
      globalBestOccupant = Int32Array.from(bestOccupant);
    }
  }

  // On restaure la meilleure configuration rencontrée, tous redémarrages
  // confondus, avant de produire le résultat.
  occupant.set(globalBestOccupant);
  seatOfStudent.fill(-1);
  for (let i = 0; i < nSeats; i++) {
    const s = occupant[i];
    if (s >= 0) seatOfStudent[s] = i;
  }

  // ---------------------------------------------------------------- sortie
  const assignments: SolverAssignment[] = [];
  for (let i = 0; i < nSeats; i++) {
    const s = occupant[i];
    if (s < 0) continue;
    assignments.push({
      seatId: seats[i].id,
      studentId: students[s].id,
      pinned: pinnedStudentIds.has(students[s].id),
    });
  }

  const violations: Violation[] = [];

  for (const [sa, sb] of incompatiblePairs) {
    const ia = seatOfStudent[sa];
    const ib = seatOfStudent[sb];
    if (ia < 0 || ib < 0) continue;
    const d = dist[ia * nSeats + ib];
    if (d < proximityCm) {
      violations.push({
        kind: "INCOMPATIBLE_TOO_CLOSE",
        message: `Aucune disposition trouvée qui éloigne suffisamment ces deux élèves (${Math.round(d)} cm pour un seuil de ${proximityCm} cm).`,
        studentIds: [students[sa].id, students[sb].id],
        seatIds: [seats[ia].id, seats[ib].id],
      });
    }
  }

  for (let s = 0; s < nStudents; s++) {
    if (!needsFront[s]) continue;
    const seat = seatOfStudent[s];
    if (seat >= 0 && !isFrontSeat[seat]) {
      violations.push({
        kind: "NEEDS_FRONT_NOT_SATISFIED",
        message: "Pas assez de places au premier rang pour tous les élèves qui en ont besoin.",
        studentIds: [students[s].id],
        seatIds: [seats[seat].id],
      });
    }
  }

  if (unplacedStudentIds.length > 0) {
    violations.push({
      kind: "NOT_ENOUGH_SEATS",
      message: `La salle compte ${nSeats} place${nSeats > 1 ? "s" : ""} pour ${input.students.length} élèves : ${unplacedStudentIds.length} n'ont pas pu être placés.`,
      studentIds: unplacedStudentIds,
      seatIds: [],
    });
  }

  return {
    assignments,
    unplacedStudentIds,
    violations,
    cost: globalBestCost,
    seed: baseSeed,
    durationMs: Date.now() - startedAt,
  };
}
