import { Link, NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { ScrabbleTile } from './ScrabbleTile';
import { AuthModal } from './AuthModal';
import { useAuth } from '@/hooks/useAuth';

const TITLE = ['C', 'R', 'A', 'C', 'K'];
const TITLE_ROTATE = [-3, 2, -1, 2, -2];

export function Layout() {
  const { user, signOut } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="paper-bg min-h-full flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1" aria-label="CRACK home">
          {TITLE.map((letter, i) => (
            <ScrabbleTile key={i} letter={letter} size="sm" rotate={TITLE_ROTATE[i]} />
          ))}
        </Link>
        <nav className="flex items-center gap-4 font-hand text-xl text-ink">
          <NavLink to="/solo" className={({ isActive }) => (isActive ? 'underline' : 'hover:underline')}>
            solo
          </NavLink>
          <NavLink to="/mp" className={({ isActive }) => (isActive ? 'underline' : 'hover:underline')}>
            multi
          </NavLink>
          <NavLink to="/how" className={({ isActive }) => (isActive ? 'underline' : 'hover:underline')}>
            how
          </NavLink>
          {user ? (
            <button onClick={() => signOut()} className="hover:underline">
              sign out
            </button>
          ) : (
            <button onClick={() => setAuthOpen(true)} className="hover:underline">
              sign in
            </button>
          )}
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="py-4 text-center font-hand text-base text-ink-soft">
        a sunday-afternoon kitchen-table sort of game
      </footer>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
