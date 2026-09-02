import type { Metadata, Viewport } from "next";

import { PALETTE_INIT_SCRIPT, PaletteProvider } from "@/components/palette-provider";
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
    // serveur. Le script de palette ci-dessous y pose `data-palette` pour la
    // même raison et au même moment.
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        {/* PREMIER ENFANT DU `<body>`, et non dans un `<head>` écrit à la main :
            c'est là que next-themes place le sien, et le routeur d'applications
            déconseille de composer soi-même le `<head>` de la mise en page
            racine. Le script est synchrone, donc il pose `data-palette` avant
            le premier rendu — sans lui, une page en palette « Prune » naîtrait
            corail le temps de l'hydratation. */}
        <script dangerouslySetInnerHTML={{ __html: PALETTE_INIT_SCRIPT }} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PaletteProvider>{children}</PaletteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
