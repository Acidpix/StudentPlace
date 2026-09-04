"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * La mécanique de défilement de la page « Fonctionnement ».
 *
 * Un seul `IntersectionObserver` fait les deux choses à la fois : révéler
 * chaque section qui entre dans la vue, et allumer l'étape courante dans le
 * rail collant de gauche. Deux observateurs auraient demandé deux seuils à
 * garder d'accord.
 *
 * LE SEUL COMPOSANT CLIENT DES PAGES PUBLIQUES. Les sections elles-mêmes
 * restent rendues côté serveur et lui sont passées en `children` : il ne fait
 * que poser des attributs sur des éléments qu'il n'a pas écrits, repérés par
 * leur `data-feature-section`.
 *
 * L'ORDRE DES ÉTATS EST CELUI QUI COMPTE. Le contenu est visible par défaut, et
 * c'est cet effet qui le masque au montage (`data-reveal="armed"`) avant que
 * l'observateur ne le révèle (`"in"`). Écrire `opacity: 0` dans la feuille de
 * style aurait été plus court, et aurait rendu la page entièrement blanche
 * partout où le JavaScript ne s'exécute pas — un rendu de moteur de recherche,
 * un navigateur qui bloque les scripts, un échec de chargement. Voir aussi les
 * deux garde-fous CSS de `globals.css` : à l'impression et sous « animations
 * réduites », tout est désarmé d'office.
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

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("[data-feature-section]"),
    );
    if (sections.length === 0) return;

    // Navigateur sans IntersectionObserver : on ne masque rien et le rail
    // garde sa première étape. La page reste entièrement lisible.
    if (typeof IntersectionObserver === "undefined") return;

    // On masque MAINTENANT, et pas avant : jusqu'ici la page était complète.
    // La première section est laissée visible — elle est déjà à l'écran au
    // chargement, et l'y faire apparaître donnerait un clignotement au lieu
    // d'une révélation.
    for (const section of sections.slice(1)) {
      section.dataset.reveal = "armed";
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          if (!entry.isIntersecting) continue;

          // Une fois révélée, une section le reste : reculer dans la page ne
          // doit pas la faire disparaître à nouveau.
          element.dataset.reveal = "in";
          setActiveId(element.id);
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

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-6xl px-4">
      <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-10">
        {/* Rail de progression. Masqué sous `lg` : sur un téléphone il
            occuperait une colonne entière pour redire ce que les titres
            disent déjà en défilant. */}
        <nav aria-label="Sommaire" className="hidden lg:block">
          <ol className="sticky top-28 space-y-1 border-l border-border">
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

        <div>{children}</div>
      </div>
    </div>
  );
}
