"use client";
import { Check, Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

const options = [
  { id: "dark", label: "Dark", icon: Moon },
  { id: "light", label: "Light", icon: Sun },
  { id: "aurora", label: "Aurora", icon: Palette }
];

export default function ThemeSwitcher() {
  const { theme, changeTheme } = useTheme();
  return <div aria-label="Choose theme" className="flex items-center gap-1 rounded-xl border border-line bg-white/[.03] p-1" role="radiogroup">{options.map(({ id, label, icon: Icon }) => <button aria-checked={theme === id} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${theme === id ? "bg-electric text-ink" : "text-slate-400 hover:text-white"}`} key={id} onClick={() => changeTheme(id)} role="radio" title={`${label} theme`} type="button"><Icon size={14} /><span className="hidden md:inline">{label}</span>{theme === id ? <Check className="hidden md:block" size={12} /> : null}</button>)}</div>;
}
