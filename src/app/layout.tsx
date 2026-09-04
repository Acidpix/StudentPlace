import type { Metadata, Viewport } from "next";

import { FONT_INIT_SCRIPT, FontProvider } from "@/components/font-provider";
import { PALETTE_INIT_SCRIPT, PaletteProvider } from "@/components/palette-provider";
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "StudentPlace — Plans de classe",
    template: "%s · StudentPlace",
  },
  description:
    "Composer et imprimer des plans de classe qui tiennent compte du comportement des élèves et de leurs incompatibilités.",
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
            racine. Les scripts sont synchrones, donc ils posent `data-palette`
            et `data-font` avant le premier rendu — sans eux, une page en
            palette « Prune » ou en police « Nunito » naîtrait dans les réglages
            par défaut le temps de l'hydratation. */}
        <script dangerouslySetInnerHTML={{ __html: PALETTE_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: FONT_INIT_SCRIPT }} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PaletteProvider>
            <FontProvider>{children}</FontProvider>
          </PaletteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
