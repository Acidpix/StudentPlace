"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * La mécanique de la page « Fonctionnement ».
 *
 * TOUT LE CONTENU EST VISIBLE DÈS LE CHARGEMENT (6 septembre 2026) — il n'y a
 * plus de révélation au défilement. Il y en a eu une : chaque écran restait
 * masqué (`data-reveal="armed"`) jusqu'à ce qu'un `IntersectionObserver` le
 * révèle. Retirée sur demande explicite (« les sections doivent apparaître dès
 * le début »), avec le mécanisme CSS qui allait avec (`@keyframes reveal-up`,
 * `[data-reveal]`, `globals.css`) : il n'avait plus d'appelant.
 *
 * L'observateur qui RESTE sert à deux choses, toutes deux indépendantes de la
 * visibilité du contenu : allumer l'étape courante du rail, et activer ce
 * rail lui-même (voir plus bas).
 *
 * **LE RAIL EST `position: fixed`, PAS `sticky` DANS UNE GRILLE** (6 septembre
 * 2026, même lot). Il vivait jusqu'ici dans une grille `[13rem_1fr]` avec la
 * colonne de contenu, bornée à `max-w-6xl` — ce qui pliait chaque écran à la
 * largeur de cette colonne, empêchant leur fond alterné et leur découpe
 * oblique (`.diagonal-top`, dans `fonctionnement/page.tsx`) d'atteindre les
 * bords de la fenêtre. Les écrans sont maintenant des `<section>` PLEINE
 * LARGEUR, de simples enfants de `<main>` comme les sections de la landing ;
 * le rail n'a donc plus de colonne à partager et doit se positionner par
 * rapport à la fenêtre plutôt qu'à un parent qui n'a plus la largeur de
 * référence adéquate.
 *
 * `left: max(1rem, calc(50vw - 35rem))` replace donc la grille : 35rem est la
 * moitié de `max-w-6xl` (36rem) moins le `px-4` (1rem) que porte l'intérieur
 * de chaque écran — c'est exactement là où le rail se serait trouvé dans
 * l'ancienne mise en page. Le `max()` évite qu'il ne sorte de l'écran par la
 * gauche entre 1024 px (le seuil `lg`) et environ 1136 px de large, où
 * `calc(50vw - 35rem)` devient négatif.
 *
 * `railVisible` REMPLACE ce que le `sticky` obtenait gratuitement : ne montrer
 * le rail que pendant que les écrans défilent, pas au-dessus (le hero) ni en
 * dessous (l'appel final). Un second observateur, posé sur le conteneur
 * entier plutôt que sur chaque écran, suffit.
 */

export interface FeatureStep {
  id: string;
  label: string;
}

export function FeatureScroll({
  steps,
  children,
}: {
  steps: FeatureStep[];
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState(steps[0]?.id ?? "");
  const [railVisible, setRailVisible] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (typeof IntersectionObserver === "undefined") return;

    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("[data-feature-section]"),
    );
    if (sections.length === 0) return;

    const stepObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setActiveId((entry.target as HTMLElement).id);
        }
      },
      {
        // La section est réputée « atteinte » quand elle occupe la bande
        // centrale de la fenêtre : c'est ce qui fait avancer le rail au bon
        // moment, plutôt qu'au premier pixel visible en bas d'écran.
        rootMargin: "-35% 0px -45% 0px",
        threshold: 0,
      },
    );
    for (const section of sections) stepObserver.observe(section);

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => setRailVisible(entry.isIntersecting),
      { rootMargin: "-112px 0px -50% 0px" },
    );
    visibilityObserver.observe(root);

    return () => {
      stepObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      {/* Masqué sous `lg` : sur un téléphone il occuperait une colonne
          entière pour redire ce que les titres disent déjà en défilant. */}
      <nav
        aria-label="Sommaire"
        aria-hidden={!railVisible}
        className={cn(
          "fixed top-28 z-30 hidden w-[13rem] transition-opacity duration-200 lg:block",
          railVisible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={{ left: "max(1rem, calc(50vw - 35rem))" }}
      >
        <ol className="space-y-1 border-l border-border">
          {steps.map((step, index) => {
            const active = step.id === activeId;
            return (
              <li key={step.id}>
                <a
                  href={`#${step.id}`}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "-ml-px flex items-baseline gap-2 border-l-2 py-1.5 pl-3 text-sm transition-colors",
                    active
                      ? "border-primary font-semibold text-primary"
                      : "border-transparent text-muted hover:text-foreground",
                  )}
                >
                  <span className="eyebrow shrink-0">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {step.label}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      {children}
    </div>
  );
}
