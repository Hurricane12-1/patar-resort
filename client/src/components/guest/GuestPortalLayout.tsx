import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import '../../styles/guest-portal.css';
import GuestIcon, { type GuestIconName } from './GuestIcon';
import { GuestPortalProvider, useGuestPortal } from './GuestPortalContext';
import { RESORT_CONTACT } from '../../lib/guestPortal';
import { toast } from '../Toasts';

const BOOK_A_STAY = '/client/book#reserve';
const BANNER_KEY = 'rv_guest_preview_banner_hidden';

interface NavItem {
  to: string;
  label: string;
  icon: GuestIconName;
  match: (path: string) => boolean;
}

const NAV: NavItem[] = [
  { to: '/client', label: 'My stays', icon: 'home', match: (p) => p === '/client' || p.startsWith('/client/bookings') },
  { to: '/client/profile', label: 'Profile', icon: 'user', match: (p) => p.startsWith('/client/profile') },
  { to: '/client/help', label: 'Help', icon: 'help', match: (p) => p.startsWith('/client/help') || p.startsWith('/client/requests') },
];

/** Guest dashboard shell shared by the Stays, Profile, and Help pages (Deep Blue Marine Theme). */
export default function GuestPortalLayout() {
  return (
    <GuestPortalProvider>
      <PortalFrame />
    </GuestPortalProvider>
  );
}

function RockViewMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={`shrink-0 text-[#38BDF8] filter drop-shadow-[0_0_8px_rgba(56,189,248,0.4)] ${className}`} fill="none" aria-hidden="true">
      <rect x="2" y="2" width="36" height="36" rx="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 26L15.5 11.5C16 10.7 17.1 10.7 17.6 11.5L22.2 19.2L25.4 14.5C25.9 13.8 26.9 13.8 27.4 14.5L33 26" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="28" cy="10" r="2.2" fill="currentColor" fillOpacity="0.75" />
      <path d="M6 30.5C10.5 28.4 15 32.6 20 30.5C25 28.4 29.5 32.6 34 30.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PortalFrame() {
  const portal = useGuestPortal();
  const location = useLocation();
  const path = location.pathname.toLowerCase();
  const [bannerHidden, setBannerHidden] = useState(() => {
    try {
      return window.sessionStorage.getItem(BANNER_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [path]);

  const hideBanner = () => {
    setBannerHidden(true);
    try {
      window.sessionStorage.setItem(BANNER_KEY, '1');
    } catch {
      // Ignore blocked storage.
    }
  };

  const isPreview = portal.mode === 'preview';

  return (
    <div className="guest-portal min-h-screen text-slate-100">
      <a
        href="#guest-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[95] focus:rounded-lg focus:bg-[#061533] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:ring-2 focus:ring-[#38BDF8]"
      >
        Skip to content
      </a>

      {isPreview && !bannerHidden && (
        <div className="border-b border-sky-500/20 bg-[#040e22]/95 text-slate-200">
          <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2.5 text-[13px] sm:px-6 lg:px-8">
            <GuestIcon name="eye" className="h-4 w-4 text-[#38BDF8]" />
            <p className="min-w-0 flex-1 leading-snug text-slate-300">
              <span className="font-semibold text-white">Preview access</span>
              <span className="hidden sm:inline"> · Sign-in is skipped for review. Bookings and details you add are saved on this device only.</span>
            </p>
            <button
              type="button"
              onClick={() => {
                portal.resetPreview();
                toast('Preview reset');
              }}
              className="hidden shrink-0 rounded-full border border-sky-400/30 px-3 py-1 text-[12px] font-semibold text-sky-200 transition hover:bg-sky-500/10 sm:inline-flex"
            >
              Reset preview
            </button>
            <Link
              to="/client/login"
              className="shrink-0 rounded-full bg-gradient-to-r from-[#0284C7] to-[#2563EB] px-3.5 py-1 text-[12px] font-semibold text-white shadow-[0_0_12px_rgba(56,189,248,0.3)] transition hover:brightness-110"
            >
              Sign in
            </Link>
            <button
              type="button"
              onClick={hideBanner}
              aria-label="Hide preview notice"
              className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <GuestIcon name="close" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-[100] border-b border-white/10 bg-[#040e22]/90 backdrop-blur-md supports-[backdrop-filter]:bg-[#040e22]/80 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4 sm:h-[72px] sm:px-6 lg:px-8">
          <Link to="/" className="group flex items-center gap-3" aria-label="Rock View Beach Resort home">
            <RockViewMark className="h-8 w-8 transition-transform duration-300 group-hover:scale-105 sm:h-9 sm:w-9" />
            <span className="leading-none">
              <span className="gp-display block text-[17px] font-bold tracking-[0.14em] text-white sm:text-lg">ROCK VIEW</span>
              <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.22em] text-[#38BDF8] sm:text-[10px]">Guest dashboard</span>
            </span>
          </Link>

          <nav aria-label="Guest dashboard" className="ml-6 hidden items-center gap-1.5 md:flex">
            {NAV.map((item) => {
              const active = item.match(path);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-full px-4 py-2 text-[14px] font-semibold transition ${
                    active
                      ? 'bg-gradient-to-r from-[#0284C7] to-[#2563EB] text-white shadow-[0_0_14px_rgba(56,189,248,0.35)]'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {isPreview && (
              <span className="hidden items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-950/60 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-sky-300 lg:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[#38BDF8] shadow-[0_0_6px_#38bdf8]" />
                Preview
              </span>
            )}
            <Link
              to={BOOK_A_STAY}
              className="hidden items-center gap-2 rounded-full bg-gradient-to-r from-[#0284C7] via-[#2563EB] to-[#1D4ED8] px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_0_16px_rgba(14,165,233,0.35)] transition hover:brightness-110 hover:scale-[1.02] sm:inline-flex"
            >
              <GuestIcon name="calendar-plus" className="h-4 w-4" />
              Book a stay
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>

      <main id="guest-main" className="mx-auto max-w-[1200px] px-4 pb-32 pt-6 sm:px-6 sm:pt-8 md:pb-16 lg:px-8">
        <Outlet />
      </main>

      <footer className="border-t border-white/10 bg-[#020713]/85 text-slate-400 backdrop-blur-md pb-24 md:pb-0">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-6 text-[13px] sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>Rock View Beach Resort · Bolinao, Pangasinan</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href={`tel:${RESORT_CONTACT.phoneHref}`} className="inline-flex items-center gap-1.5 font-medium text-slate-200 hover:text-[#38BDF8] transition">
              <GuestIcon name="phone" className="h-3.5 w-3.5 text-[#38BDF8]" />
              Front desk {RESORT_CONTACT.phoneDisplay}
            </a>
            <Link to="/" className="font-medium text-slate-200 hover:text-[#38BDF8] transition">
              Resort website
            </Link>
          </div>
        </div>
      </footer>

      <nav
        aria-label="Guest dashboard"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#040e22]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-4">
          {NAV.slice(0, 1).map((item) => (
            <TabLink key={item.to} item={item} active={item.match(path)} />
          ))}
          <Link to={BOOK_A_STAY} className="flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-[#38BDF8]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-[#0284C7] to-[#1D4ED8] text-white shadow-[0_0_8px_rgba(56,189,248,0.4)]">
              <GuestIcon name="plus" className="h-4 w-4" strokeWidth={2.2} />
            </span>
            Book
          </Link>
          {NAV.slice(1).map((item) => (
            <TabLink key={item.to} item={item} active={item.match(path)} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${
        active ? 'text-[#38BDF8]' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {active && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-[#38BDF8] shadow-[0_0_8px_#38bdf8]" />}
      <GuestIcon name={item.icon} className="h-[22px] w-[22px]" strokeWidth={active ? 2 : 1.8} />
      {item.label}
    </Link>
  );
}

function AccountMenu() {
  const portal = useGuestPortal();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    try {
      await portal.signOut?.();
      toast('You have been signed out');
      navigate('/client');
    } catch {
      toast('Could not sign out. Please try again.', true);
    }
  };

  const menuItem = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium text-slate-200 transition hover:bg-white/10 hover:text-white';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-1 transition hover:border-sky-400/40 hover:bg-white/10 hover:shadow-[0_0_16px_rgba(56,189,248,0.2)] sm:pr-3"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#0EA5E9] to-[#2563EB] text-[12px] font-bold tracking-wide text-white shadow-[0_0_8px_rgba(56,189,248,0.4)]">
          {portal.initials}
        </span>
        <span className="hidden max-w-[120px] truncate text-[13.5px] font-semibold text-white sm:block">{portal.firstName}</span>
        <GuestIcon name="chevron-down" className="hidden h-4 w-4 text-slate-400 sm:block" />
      </button>

      {open && (
        <div role="menu" className="gp-menu absolute right-0 top-[calc(100%+8px)] z-[110] w-[272px] rounded-2xl border border-white/15 bg-[#040e22]/95 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          <div className="flex items-center gap-3 px-3 pb-3 pt-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#0EA5E9] to-[#2563EB] text-[13px] font-bold text-white shadow-[0_0_8px_rgba(56,189,248,0.4)]">{portal.initials}</span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-white">{portal.displayName}</p>
              <p className="truncate text-[12.5px] text-slate-400">
                {portal.mode === 'preview' ? 'Preview guest · this device' : portal.account.profile.email}
              </p>
            </div>
          </div>
          <div className="my-1 h-px bg-white/10" />
          <Link role="menuitem" to="/client" className={menuItem}>
            <GuestIcon name="home" className="h-[18px] w-[18px] text-[#38BDF8]" /> My stays
          </Link>
          <Link role="menuitem" to="/client/profile" className={menuItem}>
            <GuestIcon name="user" className="h-[18px] w-[18px] text-[#38BDF8]" /> Profile & payments
          </Link>
          <Link role="menuitem" to="/client/help" className={menuItem}>
            <GuestIcon name="help" className="h-[18px] w-[18px] text-[#38BDF8]" /> Help & support
          </Link>
          <Link role="menuitem" to="/" className={menuItem}>
            <GuestIcon name="external" className="h-[18px] w-[18px] text-[#38BDF8]" /> Resort website
          </Link>
          <div className="my-1 h-px bg-white/10" />
          {portal.signOut ? (
            <button role="menuitem" type="button" onClick={handleSignOut} className={`${menuItem} text-rose-400 hover:text-rose-300 hover:bg-rose-500/10`}>
              <GuestIcon name="logout" className="h-[18px] w-[18px] text-rose-400" /> Sign out
            </button>
          ) : (
            <Link role="menuitem" to="/client/login" className={menuItem}>
              <GuestIcon name="login" className="h-[18px] w-[18px] text-[#38BDF8]" /> Sign in to your account
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
