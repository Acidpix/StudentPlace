import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex justify-end p-4">
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <span
              aria-hidden="true"
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-card bg-gradient-to-br from-primary to-accent text-base font-bold text-primary-foreground shadow-lift"
            >
              SP
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">StudentPlace</h1>
            <p className="mt-1 text-sm text-muted">Vos plans de classe, sans le casse-tête.</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
