import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";
type UIStyle = "teams" | "ibm";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultUIStyle?: UIStyle;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  uiStyle: UIStyle;
  setUIStyle: (style: UIStyle) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined
);

export function ThemeProvider({
  children,
  defaultTheme = "light",
  defaultUIStyle = "teams",
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) || defaultTheme
  );
  
  const [uiStyle, setUIStyle] = useState<UIStyle>(
    () => (localStorage.getItem("uiStyle") as UIStyle) || defaultUIStyle
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);
  
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("ui-teams", "ui-ibm");
    root.classList.add(`ui-${uiStyle}`);
    localStorage.setItem("uiStyle", uiStyle);
  }, [uiStyle]);

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme, uiStyle, setUIStyle }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
