import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, LayoutDashboard } from "lucide-react";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-black text-destructive/20 mb-2 select-none">404</div>
        <div className="text-5xl mb-6">🤖</div>
        <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
        <p className="text-muted-foreground mb-8">This page doesn't exist in any agent's memory. It may have been moved, deleted, or never existed in this timeline.</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => setLocation("/")} variant="outline">
            <Home className="w-4 h-4 mr-2" /> Home
          </Button>
          <Button onClick={() => setLocation("/dashboard")} className="bg-destructive hover:bg-destructive/90">
            <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
