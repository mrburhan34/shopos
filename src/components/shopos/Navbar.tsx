import { useState, useEffect } from "react";
import { Menu, Moon, Sun, Languages } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./Sidebar";
import { getTheme, toggleTheme } from "@/lib/theme";
import { getLang, setLang, useLang } from "@/lib/i18n";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  useLang();
  useEffect(() => {
    const i = setInterval(() => force((x) => x + 1), 1000 * 30);
    return () => clearInterval(i);
  }, []);
  const dark = typeof window !== "undefined" && getTheme() === "dark";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur md:px-4">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[240px] p-0">
          <Sidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle language"
        onClick={() => {
          setLang(getLang() === "en" ? "te" : "en");
          force((x) => x + 1);
        }}
      >
        <Languages className="size-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle theme"
        onClick={() => {
          toggleTheme();
          force((x) => x + 1);
        }}
      >
        {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </Button>
    </header>
  );
}
