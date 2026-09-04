import type { Metadata } from "next";
import Link from "next/link";

import { PlanShowcase } from "@/components/site/plan-showcase";
import { buttonClasses } from "@/components/ui/button";
import { CARD } from "@/components/ui/card";
import {
  DownloadIcon,
  EmptyClassArt,
  EmptyPlanArt,
  RowsLayoutArt,
  SparkIcon,
  UsersIcon,
  WarningIcon,
} from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "Sisit — le plan de classe qui se fait tout seul",
  description:
    "Importez votre liste d'élèves, posez vos règles, imprimez. Sisit compose des plans de classe qui tiennent compte du comportement et des incompatibilités.",
};

/**
 * La page d'accueil, d'après la maquette Claude Design « Sisit — Pairings »,
 * direction 1c « Cahier quadrillé ».
 *
 * Elle a remplacé une redirection de huit lignes vers `/connexion` : personne
 * ne pouvait découvrir le produit sans déjà avoir un compte.
 *
 * AUCUNE COULEUR EN DUR ici, ni dans les autres pages du groupe. Les teintes de
 * la maquette vivent dans `globals.css`, sous forme de jetons — sans quoi les
 * sept palettes et les deux modes se déferaient page par page. Le jaune de la
 * maquette est `--highlight`, une constante de marque réservée aux pages
 * publiques (voir la note de `@theme inline`).
 */

const VALUE_CARDS = [
  {
    Icon: UsersIcon,
    title: "Le comportement, sur cinq niveaux",
    body: "De « calme » à « perturbateur ». C'est cette échelle qui décide qui va devant et qui s'écarte de qui — pas une note scolaire.",
  },
  {
    Icon: WarningIcon,
    title: "Les incompatibilités, respectées",
    body: "Deux élèves à séparer ne se retrouveront pas côte à côte. Si vous les rapprochez à la main, le plan vous le signale.",
  },
  {
    Icon: DownloadIcon,
    title: "Un PDF prêt à afficher",
    body: "La feuille imprimée est la copie exacte de l'écran. Les commentaires et les notes de comportement en sont exclus par défaut.",
  },
];

const STEPS = [
  {
    Art: EmptyClassArt,
    step: "Étape 1",
    title: "Votre classe",
    body: "Collez la liste de vos élèves, ou importez un CSV. Une note de comportement par élève, et c'est prêt.",
  },
  {
    Art: RowsLayoutArt,
    step: "Étape 2",
    title: "Votre salle",
    body: "Glissez les tables où elles sont vraiment, ou partez d'une des quatre dispositions types.",
  },
  {
    Art: EmptyPlanArt,
    step: "Étape 3",
    title: "Votre plan",
    body: "Placez toute la classe d'un clic, ajustez ce qui vous chante, imprimez.",
  },
];

const CONSTRAINTS = ["Séparer Théo et Lucas", "Myopes devant", "Îlots de 4"];

export default function LandingPage() {
  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 lg:py-20">
          {/* Le mot-symbole en grand, seul et centré, au-dessus du texte ET de
              l'exemple : la première chose que voit un visiteur avant même le
              titre. `size="xl"` n'existe que pour cet emploi. */}
          <div className="flex justify-center">
            <Logo size="xl" />
          </div>

          <div className="mt-10 grid items-center gap-10 lg:mt-14 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <span className="inline-block rounded-control bg-highlight-soft px-3 py-1.5 text-sm font-semibold text-highlight-ink">
                Prêt avant la sonnerie
              </span>

              <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">
                Un plan de classe juste, en trois clics.
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
                Importez la liste, cochez vos contraintes, imprimez. Sisit gère le comportement,
                les affinités et les îlots à votre place — et vous gardez la main sur chaque
                place.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/inscription" className={buttonClasses("primary", "lg")}>
                  Créer mon plan
                </Link>
                {/* Le second appel à l'action est le JAUNE de la maquette. C'est
                    une VARIANTE de `Button` et non un `bg-highlight` passé en
                    `className` : `cn()` concatène sans `tailwind-merge`, et le
                    `bg-*` de la variante de base cohabiterait avec le mien à
                    spécificité égale. Même raison que la variante `ink`. */}
                <a href="#apercu" className={buttonClasses("highlight", "lg")}>
                  Voir un exemple
                </a>
              </div>

              <ul className="mt-7 flex flex-wrap gap-2">
                {CONSTRAINTS.map((constraint) => (
                  <li
                    key={constraint}
                    className="rounded-control border border-border bg-surface px-3 py-1.5 text-sm font-medium"
                  >
                    {constraint}
                  </li>
                ))}
              </ul>
            </div>

            <div id="apercu" className="scroll-mt-24">
              <PlanShowcase />
            </div>
          </div>
        </div>
      </section>

      {/* ── Trois raisons ──────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl font-extrabold tracking-tight">
          Ce qu&apos;un tableur ne sait pas faire
        </h2>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {VALUE_CARDS.map(({ Icon, title, body }) => (
            <div key={title} className={`${CARD} p-5`}>
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-control bg-primary-soft text-primary">
                <Icon />
              </span>
              <h3 className="font-display text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trois étapes ───────────────────────────────────────────────── */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="font-display text-3xl font-extrabold tracking-tight">
            Trois écrans, et c&apos;est tout
          </h2>

          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {STEPS.map(({ Art, step, title, body }) => (
              <div key={title}>
                <Art className="h-24 w-auto text-primary" />
                <p className="eyebrow mt-4">{step}</p>
                <h3 className="mt-1 font-display text-xl font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>

          <Link
            href="/fonctionnement"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            Voir le fonctionnement en détail
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* ── Appel final ────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <SparkIcon />
        </span>
        <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          La rentrée arrive.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-lg text-muted">
          Vos données restent sur le serveur qui héberge l&apos;application. Aucun service tiers
          n&apos;est appelé.
        </p>
        <Link
          href="/inscription"
          className={buttonClasses("primary", "lg", "mt-7")}
        >
          Créer mon plan
        </Link>
      </section>
    </>
  );
}
