import type { Metadata } from "next";
import Link from "next/link";

import { FeatureScroll, type FeatureStep } from "@/components/site/feature-scroll";
import { PlanShowcase } from "@/components/site/plan-showcase";
import { BehaviorMeter } from "@/components/ui/behavior-badge";
import { buttonClasses } from "@/components/ui/button";
import { CARD } from "@/components/ui/card";
import {
  CheckIcon,
  IslandsLayoutArt,
  RowsLayoutArt,
  UShapeIslandLayoutArt,
  UShapeLayoutArt,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Fonctionnement",
  description:
    "Comment Sisit compose un plan de classe : la liste d'élèves, la salle, les règles, le placement automatique, l'ajustement à la main et l'impression.",
};

/**
 * La page « Fonctionnement » : un écran par fonctionnalité, en défilement
 * vertical, sur le modèle de teetsh.com.
 *
 * Le contenu décrit le produit TEL QU'IL EST — l'échelle de comportement à cinq
 * niveaux, les deux types de relation, l'exclusion par défaut des données
 * comportementales du PDF. Ce ne sont pas des promesses commerciales mais les
 * invariants du domaine ; s'ils changent, cette page change avec eux.
 *
 * La mécanique de défilement vit dans `site/feature-scroll.tsx`, seul composant
 * client de ces pages. Les sections, elles, restent rendues côté serveur.
 */

const STEPS: FeatureStep[] = [
  { id: "classes", label: "Vos classes" },
  { id: "salles", label: "Vos salles" },
  { id: "regles", label: "Vos règles" },
  { id: "placement", label: "Le placement" },
  { id: "ajustement", label: "L'ajustement" },
  { id: "impression", label: "L'impression" },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 text-center">
          <p className="eyebrow">Fonctionnement</p>
          <h1 className="mx-auto mt-3 max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            De la liste d&apos;élèves au plan affiché au mur.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
            Six étapes, dont une seule est vraiment automatique. Les cinq autres sont les
            vôtres.
          </p>
        </div>
      </section>

      <FeatureScroll steps={STEPS}>
        <Feature
          id="classes"
          index={1}
          title="Vos classes, telles que vous les connaissez"
          body="Collez une liste, ou importez un CSV. Sisit reconnaît « MARTIN Camille » comme « Camille Martin » et vous montre un aperçu avant d'enregistrer quoi que ce soit."
          points={[
            "Une note de comportement de 1 à 5 par élève",
            "Besoins particuliers : premier rang, gaucher",
            "Un commentaire libre, chiffré dans la base",
          ]}
          illustration={<BehaviorScale />}
        />

        <Feature
          id="salles"
          index={2}
          reversed
          title="Vos salles, aux bonnes dimensions"
          body="Dessinez la salle une fois : les tables où elles sont, le tableau, les fenêtres, le pilier au milieu. Ou partez d'une des quatre dispositions types et corrigez ce qui dépasse."
          points={[
            "Tables de une, deux ou trois places",
            "Une salle sert à autant de classes que vous voulez",
            "Déplacer une table ne détruit pas les plans déjà composés",
          ]}
          illustration={<LayoutGallery />}
        />

        <Feature
          id="regles"
          index={3}
          title="Vos règles, en deux mots"
          body="« Rapprocher » et « Séparer » : ce sont les deux seules relations, et elles suffisent. Le seuil de proximité décide à partir de quelle distance deux élèves sont considérés comme voisins."
          points={[
            "Une paire ne porte qu'une relation à la fois",
            "Deux élèves d'une même table déclenchent l'alerte",
            "Modifiable depuis la fiche de l'élève, sans quitter le plan",
          ]}
          illustration={<RelationDemo />}
        />

        <Feature
          id="placement"
          index={4}
          reversed
          title="Le placement, en quelques secondes"
          body="Un clic place toute la classe. L'algorithme fait descendre les élèves agités vers le fond, remonte ceux qui doivent voir le tableau, et respecte vos séparations."
          points={[
            "Le même plan à chaque fois : la proposition est reproductible",
            "« Autre proposition » en explore une différente",
            "Le calcul se fait dans votre navigateur, jamais sur un serveur tiers",
          ]}
          illustration={<PlanShowcase title="4e B — Mathématiques" />}
        />

        <Feature
          id="ajustement"
          index={5}
          title="L'ajustement, parce que vous savez mieux"
          body="Le plan proposé est un point de départ. Glissez un élève sur une autre place, verrouillez celles qui ne doivent plus bouger, et relancez le placement pour le reste."
          points={[
            "Une place verrouillée porte un cerclage rouge",
            "Une incompatibilité non respectée se signale d'elle-même",
            "Tout s'enregistre automatiquement, sans bouton",
          ]}
          illustration={<SeatStates />}
        />

        <Feature
          id="impression"
          index={6}
          reversed
          title="L'impression, fidèle à l'écran"
          body="Le PDF est la copie exacte de ce que vous venez de composer : mêmes étiquettes, mêmes tailles, mêmes abrègements. Rien à redécouvrir au moment d'afficher la feuille."
          points={[
            "Commentaires et notes de comportement EXCLUS par défaut",
            "Option : cinq cases de participation sous chaque nom",
            "Option : la salle vue depuis le bureau, pivotée à 180°",
          ]}
          illustration={<PrintSheet />}
        />
      </FeatureScroll>

      <section className="mx-auto w-full max-w-6xl px-4 py-20 text-center">
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Vous avez tout vu.
        </h2>
        <Link href="/inscription" className={buttonClasses("primary", "lg", "mt-6")}>
          Créer mon plan
        </Link>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------------- */

/**
 * Un écran de la page.
 *
 * `data-feature-section` est le repère que `FeatureScroll` observe ; l'`id`
 * sert à la fois d'ancre pour le rail et de valeur remontée à l'étape active.
 * Les deux doivent rester sur le MÊME élément.
 *
 * **Fond alterné et découpe oblique** (6 septembre 2026), en remplacement du
 * simple filet (`border-b`) et du `lg:min-h-[80vh]` qui forçait chaque écran à
 * occuper au moins quatre cinquièmes de la fenêtre quel que soit son contenu —
 * c'était là l'essentiel du « trop de blanc » entre les sections. Chaque écran
 * est désormais juste assez grand pour son contenu (`py-14 lg:py-20`), et la
 * limite avec le suivant se lit à un changement de teinte (`bg-background` /
 * `bg-surface`, alterné par la parité de `index`) plutôt qu'à un vide.
 *
 * La découpe (`.diagonal-top`) n'est posée qu'à PARTIR du second écran : le
 * premier n'a rien au-dessus à trancher, sa limite est le `border-b` du hero.
 * `-mt-8`/`pt-[…]` (`lg:-mt-10`/`lg:pt-[…]`) doivent rester en phase avec les
 * hauteurs de `clip-path` de `.diagonal-top` dans `globals.css` — les trois
 * valeurs forment un seul réglage. Le remplissage se fait en `pt-[…]` et non
 * en `py-*` À CÔTÉ d'un `pt-*` : `cn()` concatène sans `tailwind-merge`, deux
 * classes qui posent toutes deux `padding-top` cohabiteraient à spécificité
 * égale et l'ordre de la feuille générée déciderait laquelle gagne.
 *
 * **LE `<section>` EST PLEINE LARGEUR** (6 septembre 2026, même lot) : le fond
 * alterné doit atteindre les deux bords de la fenêtre, pas seulement ceux de
 * la colonne de contenu. Un conteneur intérieur (`mx-auto max-w-6xl px-4`)
 * recentre le texte à la même largeur qu'avant ; `lg:pl-[15.5rem]` y réserve en
 * plus la place du rail de `FeatureScroll`, désormais `position: fixed` et non
 * plus une colonne de grille partagée avec cette section (13rem de rail +
 * 2,5rem d'écart, l'exact `gap-10` de l'ancienne grille).
 */
function Feature({
  id,
  index,
  title,
  body,
  points,
  illustration,
  reversed = false,
}: {
  id: string;
  index: number;
  title: string;
  body: string;
  points: string[];
  illustration: React.ReactNode;
  reversed?: boolean;
}) {
  const tone = index % 2 === 1 ? "bg-background" : "bg-surface";
  const diagonal = index > 1;

  return (
    <section
      id={id}
      data-feature-section
      className={cn(
        "scroll-mt-24 pb-14 lg:pb-20",
        tone,
        diagonal
          ? "diagonal-top -mt-8 pt-[5.5rem] lg:-mt-10 lg:pt-[7.5rem]"
          : "pt-14 lg:pt-20",
      )}
    >
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 lg:grid-cols-2 lg:pl-[15.5rem]">
        <div className={cn(reversed && "lg:order-2")}>
          <p className="eyebrow">
            {String(index).padStart(2, "0")} · {STEPS[index - 1]?.label}
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted">{body}</p>

          <ul className="mt-6 space-y-2.5">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <CheckIcon />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className={cn(reversed && "lg:order-1")}>{illustration}</div>
      </div>
    </section>
  );
}

/** L'échelle de comportement, dans ses cinq états. */
function BehaviorScale() {
  return (
    <div className={`${CARD} space-y-3 p-5`}>
      {([1, 2, 3, 4, 5] as const).map((behavior) => (
        <BehaviorMeter key={behavior} behavior={behavior} />
      ))}
    </div>
  );
}

/** Les quatre dispositions types, avec leurs vignettes de l'application. */
function LayoutGallery() {
  const presets = [
    { Art: RowsLayoutArt, label: "En rangées" },
    { Art: UShapeLayoutArt, label: "En U" },
    { Art: UShapeIslandLayoutArt, label: "En U avec îlot" },
    { Art: IslandsLayoutArt, label: "En îlots" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {presets.map(({ Art, label }) => (
        <div key={label} className={`${CARD} p-4`}>
          <Art className="h-20 w-full text-primary" />
          <p className="mt-2 text-center text-sm font-medium">{label}</p>
        </div>
      ))}
    </div>
  );
}

/** Deux élèves séparés par une contrainte. */
function RelationDemo() {
  return (
    <div className={`${CARD} p-6`}>
      <div className="flex items-center gap-3">
        <Chip name="Théo B." />
        <div className="flex-1 border-t-2 border-dashed border-danger" />
        <span className="rounded-control bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
          Séparer
        </span>
        <div className="flex-1 border-t-2 border-dashed border-danger" />
        <Chip name="Lucas T." />
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Chip name="Léa D." />
        <div className="flex-1 border-t-2 border-dotted border-accent" />
        <span className="rounded-control bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
          Rapprocher
        </span>
        <div className="flex-1 border-t-2 border-dotted border-accent" />
        <Chip name="Sarah L." />
      </div>
    </div>
  );
}

/** Les trois états d'une place, tels que l'éditeur les dessine. */
function SeatStates() {
  return (
    <div className={`${CARD} space-y-4 p-6`}>
      <State label="Au repos" chip={<Chip name="Camille M." />} />
      <State
        label="Verrouillée — elle ne bougera plus"
        chip={<Chip name="Hugo R." tone="pinned" />}
      />
      <State
        label="En conflit — deux élèves à séparer, côte à côte"
        chip={<Chip name="Théo B." tone="conflict" />}
      />
    </div>
  );
}

function State({ label, chip }: { label: string; chip: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <div className="shrink-0">{chip}</div>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

/** La feuille imprimée, réduite à ses repères. */
function PrintSheet() {
  return (
    <div className={`${CARD} p-6`}>
      <div className="flex items-baseline justify-between border-b border-border pb-3">
        <span className="font-display text-lg font-bold">Plan de rentrée</span>
        <span className="text-sm text-muted">3e A · Salle 204</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {["Camille M.", "Théo B.", "Léa D.", "Lucas T.", "Manon R.", "Hugo R."].map((name) => (
          <div key={name} className="rounded-control border border-border p-2">
            <p className="truncate text-center text-xs font-medium">{name}</p>
            <div className="mt-1.5 flex justify-center gap-1" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((box) => (
                <span key={box} className="h-2 w-2 border border-border" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        Cinq cases de participation, vides : à vous de décider ce qu&apos;une croix veut dire.
      </p>
    </div>
  );
}

/**
 * Une étiquette d'élève, dans l'un de ses trois états.
 *
 * Le `tone` est une PROP et non une classe passée de l'extérieur : `cn()`
 * concatène sans `tailwind-merge`, donc un `bg-danger-soft` ajouté par-dessus
 * cohabiterait avec le `bg-surface` de base à spécificité égale, et l'ordre de
 * la feuille générée trancherait. Même précaution que pour les variantes de
 * `Button` et le `tone` de `Segment`.
 */
const CHIP_TONES = {
  rest: "border-border bg-surface",
  pinned: "border-border bg-surface outline outline-2 outline-danger",
  conflict: "border-dashed border-danger bg-danger-soft text-danger",
} as const;

function Chip({
  name,
  tone = "rest",
}: {
  name: string;
  tone?: keyof typeof CHIP_TONES;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-control border-2 px-3 py-1.5 text-sm font-medium shadow-soft",
        CHIP_TONES[tone],
      )}
    >
      {name}
    </span>
  );
}
