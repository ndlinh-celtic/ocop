"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export const THEME_KEY = "ocop.theme";

/** Light/dark switch; without a stored choice the system preference applies. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const explicit = document.documentElement.dataset.theme;
    setDark(explicit ? explicit === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  const flip = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
    setDark(!dark);
  };
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={dark ? "Chuyển giao diện sáng" : "Chuyển giao diện tối"}
      className="rounded-md border border-line p-1.5 text-text-2"
    >
      {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  );
}

/** Inline in <head> so the stored theme applies before first paint. */
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t)document.documentElement.dataset.theme=t}catch(e){}`;
