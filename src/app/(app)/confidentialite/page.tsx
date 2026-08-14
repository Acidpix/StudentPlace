import type { Metadata } from "next";

export const metadata: Metadata = { title: "Traitement des données" };

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Traitement des données</h1>
        <p className="mt-1 text-sm text-muted">
          StudentPlace enregistre des informations sur des élèves mineurs, assorties
          d&apos;appréciations comportementales. Voici précisément ce qui est stocké, et comment.
        </p>
      </div>

      <Section title="Ce qui est enregistré">
        <ul className="list-inside list-disc space-y-1">
          <li>Votre nom, votre adresse e-mail et votre mot de passe (haché, jamais lisible).</li>
          <li>Pour chaque élève : nom, prénom, note de difficulté, besoins particuliers.</li>
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
            difficulté. Les y inclure demande une action explicite de votre part.
          </li>
          <li>Les données ne quittent jamais ce serveur : aucun service tiers n&apos;est appelé.</li>
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
          supprimez pas. La bonne pratique consiste à supprimer les classes de l&apos;année écoulée
          à la rentrée suivante.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="mb-2 font-medium">{title}</h2>
      <div className="text-sm text-muted">{children}</div>
    </section>
  );
}
