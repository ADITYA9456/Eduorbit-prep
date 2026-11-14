"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import BrandLogo from "@/components/BrandLogo";
import styles from "./Hero.module.css";
import { HERO_COPY as copy, HERO_MEDIA as media } from "./hero-copy";

const EASE_REVEAL = [0.16, 1, 0.3, 1];
const EASE_SOFT = [0.25, 0.8, 0.3, 1];
const FADE = 0.9;
const MOBILE_QUERY = "(max-width: 552px)";

function Arrow() {
  return (
    <svg aria-hidden="true" className={styles.arw} fill="none" viewBox="0 0 12 10">
      <path d="M0.8 5h10M7.1 1.4 10.9 5l-3.8 3.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.35" />
    </svg>
  );
}

function HrefLink({ href, className, children, onClick, ...rest }) {
  if (href.startsWith("#")) return <a className={className} href={href} onClick={onClick} {...rest}>{children}</a>;
  return <Link className={className} href={href} onClick={onClick} {...rest}>{children}</Link>;
}

// Spec B section 9 timeline, expressed as framer-motion variants.
// `u` is the hero's design unit in px; `mobile` swaps in the restrained phone timings.
function buildVariants(u, mobile) {
  const hidden = (y, extra = {}) => ({ opacity: 0, y: y * u, ...extra });
  return {
    line: {
      hidden: { y: "100%" },
      show: (i) => ({ y: "0%", transition: { delay: i === 0 ? 0.12 : 0.22, duration: mobile ? 0.92 : 1.05, ease: EASE_REVEAL } })
    },
    // The logo's authored -2.4u optical offset lives in CSS on the link; the wrapper only lifts 9u.
    logo: {
      hidden: hidden(9),
      show: { opacity: 1, y: 0, transition: { delay: 0.46, duration: 0.62, ease: EASE_SOFT } }
    },
    navLink: {
      hidden: hidden(9),
      show: (i) => ({ opacity: 1, y: 0, transition: { delay: 0.54 + i * 0.045, duration: 0.55, ease: EASE_SOFT } })
    },
    sub: {
      hidden: mobile ? hidden(12) : hidden(14, { filter: "blur(4px)" }),
      show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { delay: 0.58, duration: 0.85, ease: EASE_REVEAL } }
    },
    pill: {
      hidden: hidden(8, { scale: 0.972 }),
      show: (delay) => ({ opacity: 1, y: 0, scale: 1, transition: { delay, duration: 0.55, ease: EASE_SOFT } })
    },
    cta: {
      hidden: hidden(8, { scale: 0.972 }),
      show: (delay) => ({ opacity: 1, y: 0, scale: 1, transition: { delay, duration: 0.7, ease: EASE_REVEAL } })
    }
  };
}

const INSTANT = { duration: 0, delay: 0 };

// Reduced motion: same end states, no travel, no delay.
function instant(variants) {
  const out = {};
  for (const [name, set] of Object.entries(variants)) {
    const show = set.show;
    const finalState = (custom) => ({ ...(typeof show === "function" ? show(custom) : show), transition: INSTANT });
    out[name] = { hidden: finalState, show: finalState };
  }
  return out;
}

export default function Hero() {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [unit, setUnit] = useState(1);
  const [mobile, setMobile] = useState(false);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const probeRef = useRef(null);
  const burgerRef = useRef(null);
  const menuRef = useRef(null);
  const videoA = useRef(null);
  const videoB = useRef(null);

  // Design unit in px, read from a hidden probe that is 1000 units wide.
  useEffect(() => {
    let frame = 0;
    const query = window.matchMedia(MOBILE_QUERY);
    const measure = () => {
      frame = 0;
      const width = probeRef.current?.getBoundingClientRect().width || 0;
      if (width > 0) setUnit(width / 1000);
      setMobile(query.matches);
    };
    const onResize = () => { if (!frame) frame = window.requestAnimationFrame(measure); };
    measure();
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); if (frame) window.cancelAnimationFrame(frame); };
  }, []);

  // Start the entrance once fonts are ready, with a 900ms ceiling.
  useEffect(() => {
    let done = false;
    const start = () => { if (!done) { done = true; setReady(true); } };
    const timer = window.setTimeout(start, 900);
    if (document.fonts?.ready) document.fonts.ready.then(start, start);
    else start();
    return () => { done = true; window.clearTimeout(timer); };
  }, []);

  // Two-video cross-fade hides the clip's loop seam (Spec B 10C).
  useEffect(() => {
    const a = videoA.current;
    const b = videoB.current;
    if (!a || !b) return undefined;
    a.muted = true;
    b.muted = true;
    const play = (video) => { const result = video.play(); if (result && typeof result.catch === "function") result.catch(() => {}); };
    if (reduce) {
      a.removeAttribute("autoplay");
      a.pause();
      b.pause();
      try { a.currentTime = 0; } catch { /* metadata not loaded yet */ }
      a.classList.add(styles.isActive);
      b.classList.remove(styles.isActive);
      return undefined;
    }
    let current = a;
    let next = b;
    const swapping = { current: false };
    let timer = 0;
    const tick = () => {
      if (swapping.current || !current.duration) return;
      if (current.duration - current.currentTime > FADE) return;
      swapping.current = true;
      const out = current;
      next.currentTime = 0;
      play(next);
      next.classList.add(styles.isActive);
      out.classList.remove(styles.isActive);
      current = next;
      next = out;
      timer = window.setTimeout(() => { out.pause(); out.currentTime = 0; swapping.current = false; }, FADE * 1000 + 100);
    };
    play(a);
    a.addEventListener("timeupdate", tick);
    b.addEventListener("timeupdate", tick);
    return () => {
      a.removeEventListener("timeupdate", tick);
      b.removeEventListener("timeupdate", tick);
      window.clearTimeout(timer);
    };
  }, [reduce]);

  // Mobile menu: close on Escape (focus back to the burger) and on outside pointerdown.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === "Escape") { setOpen(false); burgerRef.current?.focus(); } };
    const onPointer = (event) => {
      if (menuRef.current?.contains(event.target) || burgerRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); };
  }, [open]);

  const closeMenu = useCallback(() => setOpen(false), []);

  const built = buildVariants(unit, mobile);
  const v = reduce ? instant(built) : built;
  const state = ready || reduce ? "show" : "hidden";
  const motionProps = (variants, custom) => ({ "data-hero-motion": "", animate: state, custom, initial: "hidden", variants });

  return (
    <LazyMotion features={domAnimation} strict>
      <section aria-label="Introduction" className={styles.hero}>
        <noscript><style>{"[data-hero-motion]{opacity:1 !important;transform:none !important;filter:none !important}"}</style></noscript>
        <span aria-hidden="true" className={styles.probe} ref={probeRef} />

        <div aria-label={copy.videoLabel} className={styles.bg} role="img">
          <video aria-hidden="true" autoPlay className={`${styles.bgVideo} ${styles.isActive}`} disablePictureInPicture loop muted playsInline poster={media.poster} preload="auto" ref={videoA}>
            <source src={media.video} type="video/mp4" />
          </video>
          <video aria-hidden="true" className={styles.bgVideo} disablePictureInPicture loop muted playsInline poster={media.poster} preload="auto" ref={videoB}>
            <source src={media.video} type="video/mp4" />
          </video>
        </div>

        <header className={styles.nav}>
          <m.span {...motionProps(v.logo)} className={styles.item}>
            <Link aria-label={`${copy.brand} home`} className={styles.logo} href="/">
              <BrandLogo className={styles.logoMark} size="1em" title="" />
              {copy.brand}
            </Link>
          </m.span>
          <nav aria-label={copy.navLabel} className={styles.navLinks}>
            {copy.nav.map((item, index) => (
              <m.span className={styles.item} key={item.label} {...motionProps(v.navLink, index)}>
                <HrefLink className={styles.navLink} href={item.href}>{item.label}</HrefLink>
              </m.span>
            ))}
          </nav>
          <div className={styles.navActions}>
            <m.span className={styles.item} {...motionProps(v.pill, 0.68)}><HrefLink className={`${styles.btn} ${styles.btnLogin}`} href={copy.login.href}>{copy.login.label}</HrefLink></m.span>
            <m.span className={styles.item} {...motionProps(v.pill, 0.73)}><HrefLink className={`${styles.btn} ${styles.btnNavStart}`} href={copy.navStart.href}>{copy.navStart.label}<Arrow /></HrefLink></m.span>
          </div>
          <m.button
            {...motionProps(v.pill, 0.68)}
            aria-controls={menuId}
            aria-expanded={open}
            aria-label={open ? copy.menuClose : copy.menuOpen}
            className={styles.burger}
            onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}
            ref={burgerRef}
            type="button"
          >
            <span aria-hidden="true" className={styles.burgerLines} />
          </m.button>
        </header>

        <AnimatePresence>
          {open ? (
            <m.nav
              animate={{ opacity: 1, y: 0, scale: 1 }}
              aria-label={copy.mobileMenuLabel}
              className={styles.menu}
              exit={{ opacity: 0, y: -6, scale: 0.985 }}
              id={menuId}
              initial={reduce ? false : { opacity: 0, y: -6, scale: 0.985 }}
              ref={menuRef}
              transition={reduce ? INSTANT : { duration: 0.18, ease: "easeOut" }}
            >
              {copy.nav.map((item) => <HrefLink className={styles.menuLink} href={item.href} key={item.label} onClick={closeMenu}>{item.label}</HrefLink>)}
              <div className={styles.divider} />
              <HrefLink className={styles.menuLink} href={copy.login.href} onClick={closeMenu}>{copy.login.label}</HrefLink>
              <HrefLink className={styles.mStart} href={copy.navStart.href} onClick={closeMenu}>{copy.navStart.label}<Arrow /></HrefLink>
            </m.nav>
          ) : null}
        </AnimatePresence>

        <div className={styles.heroInner}>
          <h1 className={styles.title}>
            {copy.headline.map((line, index) => (
              <span className={styles.ln} key={line}>
                <m.span className={styles.lnI} {...motionProps(v.line, index)}>{line}</m.span>
              </span>
            ))}
          </h1>
          <m.p className={styles.sub} {...motionProps(v.sub)}>
            {copy.subtitle.map((line, index) => <span key={line}>{line}{index < copy.subtitle.length - 1 ? <><br />{" "}</> : null}</span>)}
          </m.p>
          <div className={styles.ctas}>
            <m.span className={styles.ctaItem} {...motionProps(v.cta, mobile ? 0.84 : 0.9)}><HrefLink className={`${styles.btn} ${styles.btnLg} ${styles.btnPrimary}`} href={copy.ctaPrimary.href}>{copy.ctaPrimary.label}<Arrow /></HrefLink></m.span>
            <m.span className={styles.ctaItem} {...motionProps(v.cta, mobile ? 0.9 : 0.97)}><HrefLink className={`${styles.btn} ${styles.btnLg} ${styles.btnGhost}`} href={copy.ctaSecondary.href}>{copy.ctaSecondary.label}<Arrow /></HrefLink></m.span>
          </div>
        </div>
      </section>
    </LazyMotion>
  );
}
