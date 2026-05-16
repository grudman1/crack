import { Link, NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { HelpCircle, Menu, X } from 'lucide-react';
import { AuthModal } from './AuthModal';
import { useAuth } from '@/hooks/useAuth';

export function Layout() {
  const { user, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="flex min-h-full flex-col bg-paper">
      <header className="border-b border-hairline">
        <div className="frame flex items-center justify-between py-3">
          <Link to="/" className="font-serif text-[22px] font-bold leading-none text-ink" aria-label="Crack home">
            Crack
          </Link>
          <div className="flex items-center gap-2">
            <NavLink
              to="/how"
              className="-mr-1 flex h-9 w-9 items-center justify-center text-ink hover:opacity-70"
              aria-label="How to play"
            >
              <HelpCircle className="h-5 w-5" strokeWidth={1.5} />
            </NavLink>
            <button
              type="button"
              className="-mr-1 flex h-9 w-9 items-center justify-center text-ink hover:opacity-70"
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
              ].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    `py-2 font-sans text-sm ${isActive ? 'text-accent' : 'text-ink'} hover:opacity-70`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <div className="my-1 h-px bg-hairline" />
              {user ? (
                <button
                  type="button"
                  className="py-2 text-left font-sans text-sm text-ink hover:opacity-70"
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
                  className="py-2 text-left font-sans text-sm text-ink hover:opacity-70"
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
      <main className="flex-1 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-hairline">
        <div className="frame py-4 text-center font-sans text-xs text-muted">
          the name game
        </div>
      </footer>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
