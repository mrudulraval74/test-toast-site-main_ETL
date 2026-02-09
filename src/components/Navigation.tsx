import { ArrowLeftRight } from 'lucide-react';


export function Navigation() {
  return (
    <nav className="border-b bg-gradient-to-r from-card/90 via-card/80 to-card/90 backdrop-blur-md sticky top-0 z-50 shadow-lg">
      <div className="container mx-auto px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 shadow-md">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
                DataCompare
              </span>
              <span className="text-xs text-muted-foreground">Database Comparison Tool</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
          </div>
        </div>
      </div>
    </nav>
  );
}
