"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import LogoutButton from "@/components/LogoutButton";
import { BrandWordmark } from "@/components/BrandLogo";

function linksFor(session) {
  if (!session) return [{ href: "/exams", label: "Papers" }];
  const links = [
    { href: "/dashboard", label: "Workspace" },
    { href: "/exams", label: "Papers" },
    { href: "/notes", label: "Notes" }
  ];
  if (session.isAdmin) links.push({ href: "/admin", label: "Admin" });
  return links;
}

function isActive(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Header({ session }) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const burgerRef = useRef(null);
  const sheetRef = useRef(null);
  const reduce = useReducedMotion();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") { setOpen(false); burgerRef.current?.focus(); }
    }
    function onPointer(event) {
      if (sheetRef.current?.contains(event.target) || burgerRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); };
  }, [open]);

  // The homepage hero carries its own navigation.
  if (pathname === "/") return null;

  const links = linksFor(session);
  return (
    <LazyMotion features={domAnimation} strict>
      <header className="site-header">
        <div className="shell flex h-full items-center gap-6">
          <Link aria-label="EDUorbit home" className="brand-name -ml-1 flex h-11 items-center rounded-full px-1" href={session ? "/dashboard" : "/"}>
            <BrandWordmark size={24} />
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {links.map((link) => <Link aria-current={isActive(pathname, link.href) ? "page" : undefined} className="nav-link" href={link.href} key={link.href}>{link.label}</Link>)}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <ThemeSwitcher />
            {session ? <LogoutButton /> : <><Link className="button-secondary btn-sm" href="/login">Login</Link><Link className="button-primary btn-sm" href="/exams">Get started</Link></>}
          </div>
          <button
            aria-controls={menuId}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-full border border-line bg-panel md:hidden"
            onClick={() => setOpen((value) => !value)}
            ref={burgerRef}
            type="button"
          >
            <span aria-hidden="true" className="relative block h-3 w-4">
              <span className={`absolute left-0 h-[1.5px] w-4 rounded bg-current transition-transform duration-200 ${open ? "top-[5px] rotate-45" : "top-0"}`} />
              <span className={`absolute left-0 top-[5px] h-[1.5px] w-4 rounded bg-current transition-opacity duration-150 ${open ? "opacity-0" : ""}`} />
              <span className={`absolute left-0 h-[1.5px] w-4 rounded bg-current transition-transform duration-200 ${open ? "top-[5px] -rotate-45" : "top-[10px]"}`} />
            </span>
          </button>
        </div>
        <AnimatePresence>
          {open ? (
            <m.nav
              animate={{ opacity: 1, y: 0, scale: 1 }}
              aria-label="Mobile"
              className="menu-sheet absolute inset-x-4 top-[calc(var(--header-h)-4px)] origin-top-right rounded-[20px] border border-line bg-panel p-2 md:hidden"
              exit={{ opacity: 0, y: reduce ? 0 : -6, scale: reduce ? 1 : 0.985 }}
              id={menuId}
              initial={{ opacity: 0, y: reduce ? 0 : -6, scale: reduce ? 1 : 0.985 }}
              ref={sheetRef}
              transition={{ duration: reduce ? 0 : 0.18 }}
            >
              {links.map((link) => <Link aria-current={isActive(pathname, link.href) ? "page" : undefined} className="flex min-h-[48px] items-center rounded-xl px-3.5 text-[15px] font-medium text-slate-300 hover:bg-white/[.05] hover:text-foreground aria-[current=page]:text-foreground" href={link.href} key={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}
              <div className="mx-3.5 my-2 h-px bg-line" />
              <div className="flex items-center justify-between gap-3 px-3.5 py-2"><span className="text-sm text-slate-400">Theme</span><ThemeSwitcher /></div>
              <div className="mt-1 grid gap-2 p-1.5">
                {session ? <LogoutButton block /> : <><Link className="button-secondary w-full" href="/login" onClick={() => setOpen(false)}>Login</Link><Link className="button-primary w-full" href="/exams" onClick={() => setOpen(false)}>Get started</Link></>}
              </div>
            </m.nav>
          ) : null}
        </AnimatePresence>
      </header>
    </LazyMotion>
  );
}
