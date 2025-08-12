import { ReactNode, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PlayCircle, FolderKanban, Cpu, Eye, Trophy, Settings, AlertCircle } from 'lucide-react';
import { SlideIn, FadeIn, ScaleIn, AnimatedCard, AnimatedNavItem, AnimatedNavIcon } from '../components/animations';

function NavItem({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-[10px] focus-ring ${
          isActive ? 'bg-[rgba(76,194,255,0.12)] text-[var(--accent)]' : 'text-textDim hover:text-text hover:bg-[rgba(255,255,255,0.05)]'
        }`
      }
    >
      {({ isActive }) => (
        <AnimatedNavItem isActive={isActive} className="flex items-center gap-3 w-full">
          <AnimatedNavIcon>
            <Icon size={18} />
          </AnimatedNavIcon>
          <span className="text-sm font-medium">{label}</span>
        </AnimatedNavItem>
      )}
    </NavLink>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = useMemo(() => {
    const p = location.pathname || '/';
    if (p.startsWith('/runs')) return 'Runs';
    if (p.startsWith('/dashboard') || p === '/') return 'Dashboard';
    if (p.startsWith('/problem-sets')) return 'Problem Sets';
    if (p.startsWith('/providers')) return 'Providers & Models';
    if (p.startsWith('/manual-review')) return 'Manual Review';
    if (p.startsWith('/review')) return 'Results Analysis';
    if (p.startsWith('/leaderboard')) return 'Leaderboard';
    if (p.startsWith('/settings')) return 'Settings';
    return 'Welcome';
  }, [location.pathname]);
  return (
    <div className="h-full grid grid-cols-[260px_1fr]" style={{ background: 'var(--bg)' }}>
      <SlideIn direction="left" className="glass border-r border-[var(--border)] px-4 py-4 flex flex-col gap-4" as="aside">
          <ScaleIn className="flex items-center gap-2 px-2">
            <AnimatedCard hover press className="h-7 w-7 rounded-lg" style={{ background: 'linear-gradient(135deg, var(--accent), #66d0ff)' }}>
              <span className="sr-only">Logo</span>
            </AnimatedCard>
            <div>
              <div className="text-sm text-textDim">ModelForge</div>
              <div className="text-xs text-textDim/70">MVP</div>
            </div>
          </ScaleIn>
          <nav className="flex flex-col gap-1">
            <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/runs" icon={PlayCircle} label="Runs" />
            <NavItem to="/problem-sets" icon={FolderKanban} label="Problem Sets" />
            <NavItem to="/providers" icon={Cpu} label="Providers & Models" />
            <NavItem to="/review" icon={Eye} label="Results Analysis" />
            <NavItem to="/manual-review" icon={AlertCircle} label="Manual Review" />
            <NavItem to="/leaderboard" icon={Trophy} label="Leaderboard" />
          </nav>
          <div className="mt-auto pt-2 border-t border-[var(--border)]">
            <NavItem to="/settings" icon={Settings} label="Settings" />
          </div>
      </SlideIn>

      <main className="min-h-0 flex flex-col">
        <SlideIn direction="down" className="glass h-14 border-b border-[var(--border)] flex items-center justify-between px-5" as="header">
            <FadeIn className="text-sm text-textDim">{pageTitle}</FadeIn>
            <div className="flex items-center gap-2">
              <ScaleIn>
                <AnimatedCard
                  hover
                  press
                  className="px-3 py-1.5 rounded-md bg-[var(--accent)] text-black text-sm font-medium shadow-[var(--elev-accent)]"
                  onClick={() => {
                    if (location.pathname.startsWith('/runs')) {
                      // Force a search change to trigger RunsPage effect even if already on ?new=1
                      navigate(`/runs?new=1&_=${Date.now()}`);
                    } else {
                      navigate('/runs?new=1');
                    }
                  }}
                >
                  New Run
                </AnimatedCard>
              </ScaleIn>
            </div>
        </SlideIn>
        <FadeIn className="min-h-0 flex-1 overflow-auto px-6 pb-6 pt-6" as="section">
            {children}
        </FadeIn>
      </main>
    </div>
  );
}


