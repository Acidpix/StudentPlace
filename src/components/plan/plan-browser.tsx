"use client";

import { useMemo, useState } from "react";

import { PlanCard } from "@/components/plan/plan-card";
import { type ThumbnailObject } from "@/components/plan/plan-thumbnail";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { EmptyPlanArt } from "@/components/ui/icons";

/**
 * Liste des plans de classe du tableau de bord, filtrable par classe et par
 * salle.
 *
 * Le filtrage se fait ENTIÈREMENT DANS LE NAVIGATEUR : la page serveur envoie
 * tous les plans du compte. Un professeur en a quelques dizaines au plus, et
 * chaque plan ne coûte que la silhouette de sa salle — un rectangle par meuble.
 * Passer par l'URL et un rechargement serveur ferait clignoter la page à chaque
 * changement de menu pour aucun gain.
 *
 * Comme le panneau latéral de l'éditeur, la barre de filtres SE GOUVERNE SEULE :
 * elle n'apparaît que s'il y a réellement quelque chose à trier — au moins deux
 * classes ou deux salles parmi les plans existants.
 */

/** Nombre de vignettes affichées avant de replier le reste derrière un bouton. */
const VISIBLE = 9;

export interface PlanBrowserEntry {
  id: string;
  name: string;
  classGroupId: string;
  classGroupName: string;
  roomId: string;
  roomName: string;
  /** Élèves déjà placés / effectif de la classe. */
  seated: number;
  total: number;
  widthCm: number;
  heightCm: number;
  objects: ThumbnailObject[];
}

interface Option {
  id: string;
  name: string;
}

/**
 * Les menus ne proposent que les classes et les salles QUI ONT UN PLAN : offrir
 * un choix qui ne peut donner qu'une liste vide n'est pas un choix.
 */
function optionsFrom(plans: PlanBrowserEntry[], pick: (plan: PlanBrowserEntry) => Option): Option[] {
  const byId = new Map<string, string>();
  for (const plan of plans) {
    const option = pick(plan);
    byId.set(option.id, option.name);
  }
  return [...byId]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export function PlanBrowser({ plans }: { plans: PlanBrowserEntry[] }) {
  const [classGroupId, setClassGroupId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [expanded, setExpanded] = useState(false);

  const classGroups = useMemo(
    () => optionsFrom(plans, (plan) => ({ id: plan.classGroupId, name: plan.classGroupName })),
    [plans],
  );
  const rooms = useMemo(
    () => optionsFrom(plans, (plan) => ({ id: plan.roomId, name: plan.roomName })),
    [plans],
  );

  const filtered = useMemo(
    () =>
      plans.filter(
        (plan) =>
          (classGroupId === "" || plan.classGroupId === classGroupId) &&
          (roomId === "" || plan.roomId === roomId),
      ),
    [plans, classGroupId, roomId],
  );

  const filtering = classGroupId !== "" || roomId !== "";
  const showFilters = classGroups.length > 1 || rooms.length > 1;
  const shown = expanded ? filtered : filtered.slice(0, VISIBLE);
  const hidden = filtered.length - shown.length;

  function reset() {
    setClassGroupId("");
    setRoomId("");
  }

  return (
    <section>
      <SectionHeader
        className="flex-wrap"
        title={filtering ? "Plans de classe" : "Plans de classe récents"}
        action={
          showFilters && (
            <div className="flex flex-wrap items-center gap-2">
              {classGroups.length > 1 && (
                <div className="w-44">
                  <Select
                    aria-label="Filtrer par classe"
                    value={classGroupId}
                    onChange={(event) => {
                      setClassGroupId(event.target.value);
                      setExpanded(false);
                    }}
                  >
                    <option value="">Toutes les classes</option>
                    {classGroups.map((classGroup) => (
                      <option key={classGroup.id} value={classGroup.id}>
                        {classGroup.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {rooms.length > 1 && (
                <div className="w-44">
                  <Select
                    aria-label="Filtrer par salle"
                    value={roomId}
                    onChange={(event) => {
                      setRoomId(event.target.value);
                      setExpanded(false);
                    }}
                  >
                    <option value="">Toutes les salles</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {filtering && (
                <Button variant="ghost" size="sm" onClick={reset}>
                  Réinitialiser
                </Button>
              )}
            </div>
          )
        }
      />

      {/* Les menus n'offrant que des classes et des salles qui ont un plan, une
          liste vide ne peut venir que du CROISEMENT des deux filtres. */}
      {filtered.length === 0 ? (
        <EmptyState
          Illustration={EmptyPlanArt}
          title="Aucun plan pour ce filtre"
          description="Cette classe et cette salle n'ont pas de plan de classe en commun."
          action={
            <Button variant="secondary" onClick={reset}>
              Voir tous les plans
            </Button>
          }
        />
      ) : (
        <>
          {/* Le compte est annoncé aux lecteurs d'écran : le changement de menu
              ne déplace pas le focus, donc rien ne signalerait la mise à jour. */}
          <p className="sr-only" role="status">
            {filtered.length} plan{filtered.length > 1 ? "s" : ""} de classe
          </p>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((plan) => (
              <li key={plan.id}>
                <PlanCard plan={plan} />
              </li>
            ))}
          </ul>

          {hidden > 0 && (
            <div className="mt-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setExpanded(true)}>
                Afficher {hidden} plan{hidden > 1 ? "s" : ""} de plus
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
