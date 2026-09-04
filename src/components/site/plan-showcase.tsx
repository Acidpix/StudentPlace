import { Furniture, RoomGrid } from "@/components/room/furniture";
import { BEHAVIOR_COLORS } from "@/lib/domain";
import { seatFootprintCm } from "@/lib/placement/geometry";
import { planLabelStyle, seatLabelText, seatMetrics } from "@/lib/plan-labels";
import { cn } from "@/lib/cn";

import { DEMO_OBJECTS, DEMO_ROOM, DEMO_SEATS, DEMO_STUDENTS, DEMO_TABLES } from "./demo-plan";

/**
 * L'aperçu de plan de classe des pages publiques.
 *
 * C'EST UN VRAI PLAN, pas une grille décorative. Le fond de salle est rendu par
 * les composants de l'éditeur (`RoomGrid`, `Furniture`) et les étiquettes sont
 * dimensionnées par le module du domaine (`plan-labels.ts`) : ce que le
 * visiteur voit sur la page d'accueil est, aux données près, ce qu'il obtiendra
 * en s'inscrivant. Une maquette dessinée à part aurait dérivé au premier
 * changement de barème — c'est exactement ce qui était arrivé au PDF.
 *
 * Composant SERVEUR, sans un octet de JavaScript : `RoomGrid` et `Furniture`
 * sont des fonctions pures. En revanche `SeatSpot` (`plan/plan-pieces.tsx`) ne
 * l'est pas — il appelle `useDroppable` et tire dnd-kit —, donc l'étiquette est
 * REDESSINÉE ici, une vingtaine de lignes, comme le fait déjà l'export PDF.
 *
 * `RoomGrid` DOIT rester dans le même `<svg>` que les meubles : c'est lui qui
 * porte les `<defs>` des motifs `sp-halftone` et `sp-hatch`, sans quoi le
 * tableau perdrait ses hachures.
 *
 * ─── La taille du texte sans JavaScript ────────────────────────────────────
 *
 * `seatMetrics` demande combien de pixels vaut un centimètre de salle, ce qu'un
 * rendu serveur ne peut pas savoir : il n'y a pas de fenêtre. Dans l'éditeur,
 * `usePlanScale()` le mesure au montage.
 *
 * Ici on calcule tout à une largeur NOMINALE, puis on convertit chaque longueur
 * en `cqw` — un centième de la largeur du conteneur, qui porte pour cela un
 * `container-type: inline-size`. Les valeurs restent donc proportionnelles à
 * quelque largeur que le navigateur accorde à l'aperçu, sans point de rupture,
 * sans mesure, et sans hydratation. Les positions, elles, sont déjà en
 * pourcentage — comme dans l'éditeur.
 */

/** Largeur de référence des calculs. N'importe laquelle ferait l'affaire : ce
 *  qui compte est que le RAPPORT entre les longueurs et elle soit conservé. */
const NOMINAL_PX = 620;

const PER_CM = NOMINAL_PX / DEMO_ROOM.widthCm;

/** Une longueur en pixels nominaux, exprimée en part de la largeur du cadre. */
function cqw(px: number): string {
  return `${((px / NOMINAL_PX) * 100).toFixed(4)}cqw`;
}

export interface PlanShowcaseProps {
  /** Nom de la classe affiché dans le bandeau du cadre. */
  title?: string;
  className?: string;
}

export function PlanShowcase({ title = "3e A — Français", className }: PlanShowcaseProps) {
  const footprint = seatFootprintCm(DEMO_TABLES);
  const metrics = seatMetrics(footprint, PER_CM);
  const labels = planLabelStyle(DEMO_STUDENTS, metrics);

  return (
    <div className={cn("rounded-card border border-border bg-surface p-3 shadow-lift", className)}>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-sm font-medium text-primary">Généré ✓</span>
      </div>

      {/* Le conteneur MESURÉ. `container-type: inline-size` est ce qui donne un
          sens aux `cqw` des étiquettes ; le retirer les ferait toutes tomber à
          zéro. Le rapport est celui exact de la salle, pour que le
          `preserveAspectRatio="none"` du `<svg>` ne déforme rien — même
          précaution que dans l'éditeur de plan. */}
      <div
        className="relative w-full overflow-hidden rounded-control border border-border"
        style={{
          containerType: "inline-size",
          aspectRatio: `${DEMO_ROOM.widthCm} / ${DEMO_ROOM.heightCm}`,
        }}
      >
        <svg
          viewBox={`0 0 ${DEMO_ROOM.widthCm} ${DEMO_ROOM.heightCm}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
        >
          <RoomGrid widthCm={DEMO_ROOM.widthCm} heightCm={DEMO_ROOM.heightCm} />
          {DEMO_OBJECTS.map((object) => (
            <Furniture key={object.id} object={object} />
          ))}
        </svg>

        {DEMO_SEATS.map((seat, index) => {
          const student = DEMO_STUDENTS[index];
          if (!student) return null;

          const text = seatLabelText(student, labels.form);

          return (
            <div
              key={seat.id}
              className="absolute flex items-center justify-center overflow-hidden border-2 border-border bg-surface"
              style={{
                left: `${(seat.x / DEMO_ROOM.widthCm) * 100}%`,
                top: `${(seat.y / DEMO_ROOM.heightCm) * 100}%`,
                width: cqw(metrics.width),
                height: cqw(metrics.height),
                borderRadius: cqw(metrics.radius),
                transform: "translate(-50%, -50%)",
                // Le comportement se lit à un CERCLAGE INTÉRIEUR, jamais à une
                // pastille posée sur l'étiquette : la bordure porte déjà l'état
                // de la carte, et l'`outline` le verrouillage.
                boxShadow: `inset 0 0 0 ${cqw(metrics.ring)} ${BEHAVIOR_COLORS[student.behavior]}, var(--elev-1)`,
              }}
            >
              <span
                className="w-full truncate px-0.5 text-center font-medium"
                style={{ fontSize: cqw(labels.font) }}
              >
                {text}
              </span>
            </div>
          );
        })}
      </div>

      {/* La seule information TEXTUELLE de l'aperçu, pour les lecteurs d'écran
          comme pour qui n'y verrait qu'un rectangle : le SVG est
          `aria-hidden`, et dix-huit étiquettes lues à la file n'apprendraient
          rien à personne. */}
      <p className="sr-only">
        Aperçu d&apos;un plan de classe : dix-huit élèves placés sur neuf tables de deux, face au
        tableau.
      </p>
    </div>
  );
}
