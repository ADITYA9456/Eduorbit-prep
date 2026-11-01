"use client";
import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);
const themes = ["dark", "light", "aurora"];

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    const saved = window.localStorage.getItem("eduorbit-theme");
    const next = themes.includes(saved) ? saved : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.documentElement.classList.add("theme-transition");
  }, []);
  function changeTheme(next) {
    if (!themes.includes(next)) return;
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("eduorbit-theme", next);
  }
  return <ThemeContext.Provider value={{ theme, changeTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
