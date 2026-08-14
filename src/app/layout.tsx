import type { Metadata, Viewport } from "next";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "StudentPlace — Plans de classe",
    template: "%s · StudentPlace",
  },
  description:
    "Composer et imprimer des plans de classe qui tiennent compte des difficultés et des incompatibilités entre élèves.",
  robots: {
    // Application privée contenant des données d'élèves : jamais indexée.
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning : next-themes ajoute la classe « dark » sur
    // <html> avant l'hydratation, ce qui crée un écart attendu avec le rendu
    // serveur.
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        {/* Filigrane de marque, commun à toutes les pages — voir `.watermark`
            dans globals.css. Un seul élément fixe plutôt qu'un par page. */}
        <div className="watermark" aria-hidden="true" />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
