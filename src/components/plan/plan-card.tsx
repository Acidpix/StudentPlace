import Link from "next/link";

import { PlanThumbnail, type ThumbnailObject } from "@/components/plan/plan-thumbnail";
import { CARD, CARD_INTERACTIVE } from "@/components/ui/card";

/**
 * La carte de plan de la maquette 2c.
 *
 * Structure fixe : un BANDEAU TEINTÉ en tête — nom du plan et effectif — puis
 * le corps, avec la silhouette de la salle, l'état du placement, et un bouton
 * d'ouverture à l'encre.
 *
 * La maquette varie la teinte du bandeau d'une carte à l'autre, pour le seul
 * plaisir de l'œil. Ici elle DIT quelque chose : vert quand toute la classe est
 * placée, neutre sinon. C'est l'information qu'on vient chercher sur un tableau
 * de bord, et elle se lit avant même d'avoir lu le compteur.
 *
 * Le bouton est à l'encre et non en corail : ouvrir un plan existant est un
 * geste neutre, le corail reste à ce qui crée.
 *
 * Extraite du tableau de bord parce que la page d'une classe montrait LE MÊME
 * OBJET avec une carte bien plus pauvre — un nom et une salle. Deux traitements
 * pour une même chose, c'était l'incohérence la plus visible du site.
 */
export interface PlanCardData {
  id: string;
  name: string;
  /** Omis quand la carte est déjà dans le contexte d'une classe. */
  classGroupName?: string;
  roomName: string;
  /** Élèves déjà placés / effectif de la classe. */
  seated: number;
  total: number;
  widthCm: number;
  heightCm: number;
  objects: ThumbnailObject[];
}

export function PlanCard({ plan }: { plan: PlanCardData }) {
  const ratio = plan.total === 0 ? 0 : Math.round((plan.seated / plan.total) * 100);
  const complete = plan.total > 0 && plan.seated === plan.total;

  return (
    <Link
      href={`/plans/${plan.id}`}
      className={`block overflow-hidden ${CARD} ${CARD_INTERACTIVE} p-0`}
    >
      <div
        className={`border-b border-border px-3.5 py-3 ${
          complete ? "bg-accent-soft" : "bg-surface-muted"
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-base font-bold">{plan.name}</h3>
          <span className="eyebrow shrink-0">
            {plan.total} élève{plan.total > 1 ? "s" : ""}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-muted">
          {plan.classGroupName ? `${plan.classGroupName} · ${plan.roomName}` : plan.roomName}
        </p>
      </div>

      <div className="p-3.5">
        <PlanThumbnail
          widthCm={plan.widthCm}
          heightCm={plan.heightCm}
          objects={plan.objects}
          className="h-20 w-full rounded-control border border-border bg-surface-muted/40"
        />

        <p className="eyebrow mt-3">
          {plan.seated}/{plan.total} placé{plan.seated > 1 ? "s" : ""}
        </p>
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"
          role="img"
          aria-label={`${plan.seated} élève${plan.seated > 1 ? "s" : ""} placé${plan.seated > 1 ? "s" : ""} sur ${plan.total}`}
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${ratio}%` }} />
        </div>

        {/* Aplat franc, comme les vrais boutons : pas de dégradé de volume.
            C'est un `<span>` et non un `Button` — la carte entière est déjà un
            lien, et imbriquer deux éléments interactifs serait fautif. */}
        <span className="mt-3 flex h-9 items-center justify-center rounded-control bg-foreground text-xs font-semibold text-background">
          Ouvrir
        </span>
      </div>
    </Link>
  );
}
