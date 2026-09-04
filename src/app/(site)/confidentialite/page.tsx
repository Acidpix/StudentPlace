import type { Metadata } from "next";

import { CARD } from "@/components/ui/card";
import { PageWidth } from "@/components/ui/page-width";

export const metadata: Metadata = { title: "Traitement des données" };

/**
 * Cette page A CHANGÉ DE GROUPE (5 septembre 2026) : elle vivait sous `(app)`,
 * donc derrière `requireUser()`, alors que son contenu n'a jamais rien eu de
 * privé — c'est la note de traitement des données, celle qu'on veut pouvoir
 * lire AVANT de créer un compte. Le pied de page public y renvoie désormais.
 *
 * L'URL n'a pas bougé : un groupe de routes ne paraît pas dans le chemin, et le
 * lien de « Mon compte » vers `/confidentialite` fonctionne inchangé.
 *
 * Le rembourrage est porté par la page et non plus par le layout : celui du
 * groupe `(app)` posait un `px-4 py-8` pour toutes ses pages, celui de `(site)`
 * laisse chaque page composer la sienne — les sections de la landing vont d'un
 * bord à l'autre de la fenêtre.
 */
export default function PrivacyPage() {
  return (
    <PageWidth className="px-4 py-12">
      <article className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Traitement des données
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Sisit enregistre des informations sur des élèves mineurs, assorties
            d&apos;appréciations comportementales. Voici précisément ce qui est stocké, et comment.
          </p>
        </div>

        <Section title="Ce qui est enregistré">
          <ul className="list-inside list-disc space-y-1">
            <li>Votre nom, votre adresse e-mail et votre mot de passe (haché, jamais lisible).</li>
            <li>Pour chaque élève : nom, prénom, note de comportement, besoins particuliers.</li>
            <li>Le commentaire libre que vous rédigez éventuellement à son sujet.</li>
            <li>Vos salles, leur agencement, et vos plans de classe.</li>
          </ul>
        </Section>

        <Section title="Comment ces données sont protégées">
          <ul className="list-inside list-disc space-y-1">
            <li>
              Les commentaires sont <strong>chiffrés</strong> dans la base (AES-256-GCM). Une copie
              du fichier de base ne suffit pas à les lire.
            </li>
            <li>
              Chaque requête est filtrée par compte : aucun autre professeur ne peut atteindre vos
              classes, même en devinant une adresse.
            </li>
            <li>
              Les exports PDF <strong>excluent par défaut</strong> les commentaires et les notes de
              comportement. Les y inclure demande une action explicite de votre part.
            </li>
            <li>
              Les données ne quittent jamais ce serveur : aucun service tiers n&apos;est appelé.
            </li>
          </ul>
        </Section>

        <Section title="Vos droits, et vos responsabilités">
          <p>
            Vous pouvez à tout moment exporter l&apos;intégralité de vos données ou supprimer votre
            compte, depuis la page <strong>Mon compte</strong>. La suppression est immédiate et
            définitive.
          </p>
          <p className="mt-2">
            Attention : au sens du RGPD, le responsable de traitement est votre établissement, ou
            vous-même. Il vous revient de n&apos;y consigner que des observations
            <strong> pertinentes, mesurées et utiles au placement</strong>, de ne pas conserver ces
            données au-delà de l&apos;année scolaire, et de ne pas diffuser un plan de classe
            imprimé contenant des appréciations.
          </p>
        </Section>

        <Section title="Durée de conservation">
          <p>
            Rien n&apos;est effacé automatiquement : vos classes restent tant que vous ne les
            supprimez pas. La bonne pratique consiste à supprimer les classes de l&apos;année
            écoulée à la rentrée suivante.
          </p>
        </Section>
      </article>
    </PageWidth>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${CARD} p-4`}>
      <h2 className="eyebrow mb-2">{title}</h2>
      <div className="text-sm text-muted">{children}</div>
    </section>
  );
}
