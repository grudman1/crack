import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { HelpCircle, Menu, X } from 'lucide-react';
import { AuthModal } from './AuthModal';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';

export function Layout() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Landing page hides the header entirely — the wordmark on the page
  // serves as the brand mark there. Every other route gets the sticky
  // header.
  const hideHeader = pathname === '/';

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="flex min-h-full flex-col bg-paper">
      {!hideHeader && (
        <header
          className="sticky top-0 z-40 border-b border-hairline bg-paper/95 backdrop-blur"
          style={{ paddingTop: 'var(--safe-top)' }}
        >
          <div className="frame flex h-14 items-center justify-between lg:h-16">
            <Link
              to="/"
              className="font-serif text-[22px] font-bold leading-none text-ink lg:text-[24px]"
              aria-label="Crack home"
            >
              Crack
            </Link>
            <div className="flex items-center gap-1">
              <NavLink
                to="/how"
                className="-mr-1 flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-hairline/40 focus-visible:outline-2 focus-visible:outline-accent"
                aria-label="How to play"
              >
                <HelpCircle className="h-5 w-5" strokeWidth={1.5} />
              </NavLink>
              <button
                type="button"
                className="-mr-1 flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-hairline/40 focus-visible:outline-2 focus-visible:outline-accent"
                aria-label="Menu"
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
              </button>
            </div>
          </div>
          {menuOpen && (
            <div className="border-t border-hairline">
              <div className="frame flex flex-col py-2">
                {[
                  { to: '/solo', label: 'Solo' },
                  { to: '/mp', label: 'Multiplayer' },
                  { to: '/how', label: 'How to play' },
                  ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
                ].map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={closeMenu}
                    className={({ isActive }) =>
                      `py-3 font-sans text-base ${isActive ? 'text-accent' : 'text-ink'} hover:opacity-70`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
                <div className="my-1 h-px bg-hairline" />
                {user ? (
                  <button
                    type="button"
                    className="py-3 text-left font-sans text-base text-ink hover:opacity-70"
                    onClick={() => {
                      closeMenu();
                      void signOut();
                    }}
                  >
                    Sign out
                  </button>
                ) : (
                  <button
                    type="button"
                    className="py-3 text-left font-sans text-base text-ink hover:opacity-70"
                    onClick={() => {
                      closeMenu();
                      setAuthOpen(true);
                    }}
                  >
                    Sign in
                  </button>
                )}
              </div>
            </div>
          )}
        </header>
      )}
      <main className="viewport-center flex-1 py-6 lg:py-10">
        <Outlet />
      </main>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
