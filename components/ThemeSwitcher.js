"use client";
import { Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

const options = [
  { id: "dark", label: "Dark", icon: Moon },
  { id: "light", label: "Light", icon: Sun },
  { id: "aurora", label: "Paper", icon: Palette }
];

export default function ThemeSwitcher({ showLabels = false }) {
  const { theme, changeTheme } = useTheme();
  return (
    <div aria-label="Theme" className="segmented" role="radiogroup">
      {options.map(({ id, label, icon: Icon }) => (
        <button aria-checked={theme === id} aria-label={`${label} theme`} key={id} onClick={() => changeTheme(id)} role="radio" title={`${label} theme`} type="button">
          <Icon aria-hidden="true" size={14} strokeWidth={1.75} />
          {showLabels ? <span>{label}</span> : null}
        </button>
      ))}
    </div>
  );
}
