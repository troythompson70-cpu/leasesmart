import { useEffect, useState } from 'react'
import { categoryStrip, laborDay } from '../content'
import { track } from '../lib/track'
import { TipsSignupForm } from './TipsSignupForm'

type HeaderProps = {
  onLaptopClick: () => void
}

export function AnnouncementBar({ onLaptopClick }: { onLaptopClick: () => void }) {
  return (
    <div className="relative z-[60] border-b border-brand-blue/40 bg-brand-blue text-white">
      <div className="wrap flex flex-col items-start justify-between gap-2 py-2.5 sm:flex-row sm:items-center">
        <p className="text-sm font-semibold tracking-wide">{laborDay.bar}</p>
        <button
          type="button"
          className="rounded-md bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-blue"
          onClick={() => {
            track('laptop_inquiry', { method: 'announcement_bar' })
            onLaptopClick()
          }}
          data-cta="announcement-laptop"
        >
          SHOP / EMAIL US
        </button>
      </div>
    </div>
  )
}

export function SiteHeader({ onLaptopClick }: HeaderProps) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { label: 'Tips', href: '#signup' },
    { label: 'Laptop', href: '#laptop' },
    { label: 'Videos', href: '#videos' },
    { label: 'Gates', href: '#gates' },
    { label: 'Remote Help', href: '#remote-help' },
    { label: 'Referral', href: '#referral' },
    { label: 'Business IT', href: '#business-it' },
  ]

  return (
    <header
      className={`sticky top-0 z-50 border-b transition ${
        scrolled
          ? 'border-slate-line bg-white/95 text-navy-900 backdrop-blur'
          : 'border-transparent bg-navy-900/80 text-white backdrop-blur'
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1320px] items-center justify-between gap-4 px-5 sm:h-20 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-3" aria-label="TGT Technologies home">
          <img
            src="/media/tgt-logo-2026.svg"
            alt="TGT Technologies"
            className={`h-10 w-auto sm:h-11 ${scrolled ? '' : 'brightness-0 invert'}`}
          />
        </a>

        <nav className="hidden items-center gap-5 xl:flex" aria-label="Primary">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-sm font-semibold transition ${
                scrolled ? 'text-navy-900 hover:text-brand-blue' : 'text-white/90 hover:text-white'
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          <a href="#signup" className="btn-primary !py-2.5" data-cta="nav-signup">
            SIGN UP FREE
          </a>
          <button
            type="button"
            className={`rounded-md border px-4 py-2.5 text-sm font-bold ${
              scrolled
                ? 'border-slate-line text-navy-900'
                : 'border-white/30 text-white'
            }`}
            onClick={onLaptopClick}
            data-cta="nav-laptop"
          >
            $280 LAPTOP
          </button>
        </div>

        <button
          type="button"
          className={`inline-flex items-center justify-center rounded-md border px-4 py-2.5 text-sm font-semibold xl:hidden ${
            scrolled ? 'border-slate-line text-navy-900' : 'border-white/30 text-white'
          }`}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          Menu
        </button>
      </div>

      {open ? (
        <div id="mobile-nav" className="border-t border-slate-line bg-white xl:hidden">
          <div className="wrap flex flex-col gap-1 py-4">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-3 text-base font-medium text-navy-900 hover:bg-slate-soft"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a href="#signup" className="btn-primary mt-2" onClick={() => setOpen(false)}>
              SIGN UP FREE
            </a>
            <button
              type="button"
              className="btn-outline mt-2"
              onClick={() => {
                setOpen(false)
                onLaptopClick()
              }}
            >
              GET THE $280 LAPTOP
            </button>
          </div>
        </div>
      ) : null}
    </header>
  )
}

export function Hero({ onLaptopClick }: { onLaptopClick: () => void }) {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden bg-navy-900 pt-4 text-white"
    >
      <img
        src="/media/hero.jpg"
        alt="Professionals collaborating with modern workplace technology"
        className="absolute inset-0 h-full w-full object-cover"
        fetchPriority="high"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-navy-950/95 via-navy-900/90 to-navy-900/60"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(47,116,216,0.28),transparent_45%)]"
        aria-hidden="true"
      />

      <div className="wrap relative grid items-start gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:py-16">
        <div>
          <p className="eyebrow fade-up !text-blue-200 before:!bg-brand-blue-light">
            TGT Technologies Inc.
          </p>
          <h1 className="fade-up fade-up-d1 font-display text-[clamp(2.1rem,7vw,4rem)] font-semibold leading-[1.05] tracking-tight">
            TECH MADE SIMPLE.
            <span className="block">AI MADE USEFUL.</span>
          </h1>
          <p className="fade-up fade-up-d2 mt-4 max-w-xl text-base leading-relaxed text-blue-50/85 sm:text-lg">
            Tips, support, AI-ready laptops, scam alerts, and practical technology
            help for everyday people and small businesses.
          </p>

          <div className="fade-up fade-up-d3 mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href="#signup"
              className="btn-primary"
              onClick={() => track('signup_click', { location: 'hero' })}
              data-cta="hero-signup"
            >
              SIGN UP FREE FOR TGT TIPS
            </a>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                track('laptop_inquiry', { method: 'hero' })
                onLaptopClick()
              }}
              data-cta="hero-laptop"
            >
              SHOP THE $280 AI-READY LAPTOP
            </button>
            <a href="#remote-help" className="btn-secondary" data-cta="hero-help">
              NEED TECH HELP?
            </a>
          </div>

          <div className="fade-up fade-up-d3 mt-6 flex flex-wrap gap-2" aria-label="What TGT offers">
            {categoryStrip.map((item) => (
              <span key={item} className="chip">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="fade-up fade-up-d3">
          <TipsSignupForm id="signup" dark />
        </div>
      </div>
    </section>
  )
}
