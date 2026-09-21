import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
export type ThemeChoice = Theme | "system";

const KEY = "easel:theme";
const query = () => window.matchMedia("(prefers-color-scheme: dark)");

function stored(): ThemeChoice {
  const value = window.localStorage.getItem(KEY);
  return value === "light" || value === "dark" ? value : "system";
}

export function useTheme(): { theme: Theme; choice: ThemeChoice; setChoice(choice: ThemeChoice): void } {
  const [choice, setChoice] = useState<ThemeChoice>(stored);
  const [system, setSystem] = useState<Theme>(() => (query().matches ? "dark" : "light"));

  useEffect(() => {
    const media = query();
    const listener = (event: MediaQueryListEvent) => setSystem(event.matches ? "dark" : "light");
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const theme = choice === "system" ? system : choice;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (choice === "system") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, choice);
  }, [theme, choice]);

  return { theme, choice, setChoice };
}
