import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Bell, LayoutGrid, LogOut, Monitor, Moon, Sun, UserRound, type LucideIcon } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';
import { getThemeChoice, setThemeChoice, type ThemeChoice } from '../lib/theme';
import { Avatar, LogoMark } from './ui';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; count?: number; group?: string }
export interface QuickAction { label: string; icon: LucideIcon; to: string; tone?: string }
interface Notif { id: string; title: string; body: string; created_at: string; read_at: string | null }

function useOutside(ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, close]);
}

/** Cloche : notifications non lues, marquées comme lues à l'ouverture. */
function Notifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  useOutside(ref, () => setOpen(false));
  useEffect(() => { api<Notif[]>('/me/notifications').then(setItems).catch(() => setItems([])); }, [loc.pathname]);
  const unread = items?.filter((n) => !n.read_at).length ?? 0;
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="icon-btn" aria-label={`Notifications${unread ? ` (${unread} non lues)` : ''}`} aria-expanded={open}
        onClick={() => { setOpen(!open); if (!open && unread) void api('/me/notifications/read', { body: {} }).then(() => setItems((x) => x?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null)); }}>
        <Bell size={20} />{unread > 0 && <span className="dot" />}
      </button>
      {open && (
        <div className="menu notif-panel">
          <div className="row between" style={{ padding: '6px 8px 10px' }}><b>Notifications</b></div>
          {!items?.length ? <p className="xs" style={{ padding: 12 }}>Aucune notification.</p> : items.slice(0, 12).map((n) => (
            <div key={n.id} className="row nowrap" style={{ alignItems: 'flex-start', padding: '10px 8px', borderRadius: 10, background: n.read_at ? undefined : 'var(--brand-soft)', marginBottom: 4 }}>
              <div className="grow"><b className="small">{n.title}</b><p className="small muted">{n.body}</p><span className="xs">{dateTime(n.created_at)}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountMenu({ extra }: { extra?: ReactNode }) {
  const { me, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>(getThemeChoice());
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  const themes: [ThemeChoice, string, LucideIcon][] = [['light', 'Clair', Sun], ['dark', 'Sombre', Moon], ['system', 'Auto', Monitor]];
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="icon-btn" style={{ width: 'auto', padding: '0 6px', gap: 8 }} aria-label="Mon compte" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Avatar name={me?.full_name} size="sm" />
      </button>
      {open && (
        <div className="menu" onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setOpen(false); }}>
          <div style={{ padding: '8px 12px 10px' }}><b>{me?.full_name ?? 'Mon compte'}</b><div className="xs">{me?.phone}</div></div>
          <div className="sep" />
          <Link to="/app/profil"><UserRound size={17} />Profil et aide</Link>
          {extra}
          <div className="sep" />
          <div style={{ padding: '6px 8px' }}>
            <span className="xs">Apparence</span>
            <div className="segmented" style={{ marginTop: 6, width: '100%' }}>
              {themes.map(([v, l, I]) => <button key={v} className={theme === v ? 'on' : ''} style={{ flex: 1, justifyContent: 'center', padding: '6px 8px' }} onClick={() => { setThemeChoice(v); setTheme(v); }}><I size={14} />{l}</button>)}
            </div>
          </div>
          <div className="sep" />
          <button onClick={signOut} style={{ color: 'var(--danger)' }}><LogOut size={17} />Se déconnecter</button>
        </div>
      )}
    </div>
  );
}

/**
 * Mise en page des espaces connectés. Ordinateur : menu latéral + barre supérieure.
 * Téléphone : barre supérieure + onglets en bas (4 raccourcis, action centrale, « Plus » pour le reste).
 */
export function Shell({ items, tabs, fab, header, footer, accent, menuExtra, children }: {
  items: (NavItem | 'sep')[]; tabs?: NavItem[]; fab?: { label: string; icon: LucideIcon; actions: QuickAction[] };
  header?: ReactNode; footer?: ReactNode; accent?: string; menuExtra?: ReactNode; children: ReactNode;
}) {
  const [sheet, setSheet] = useState<'more' | 'fab' | null>(null);
  const loc = useLocation();
  useEffect(() => { setSheet(null); window.scrollTo(0, 0); }, [loc.pathname]);
  const navItems = items.filter((i): i is NavItem => i !== 'sep');
  const mobileTabs = (tabs ?? navItems.slice(0, 4)).slice(0, 4);
  const left = mobileTabs.slice(0, fab ? 2 : 4), right = fab ? mobileTabs.slice(2, 3) : [];
  const Fab = fab?.icon;
  let lastGroup: string | undefined;
  return (
    <div className="shell" style={accent ? ({ '--accent': accent } as CSSProperties) : undefined}>
      <a href="#contenu" className="skip-link">Aller au contenu</a>
      <aside className="sidebar" aria-label="Menu principal">
        <Link to="/" className="brand"><LogoMark /> Smart Tontine</Link>
        {header}
        {items.map((it, i) => {
          if (it === 'sep') return <div key={i} className="sep" />;
          const g = it.group !== lastGroup ? it.group : undefined;
          lastGroup = it.group;
          return (
            <div key={it.to} style={{ display: 'contents' }}>
              {g && <div className="group">{g}</div>}
              <NavLink to={it.to} end={it.end} className="item"><it.icon size={19} strokeWidth={2} />{it.label}{!!it.count && <span className="count">{it.count}</span>}</NavLink>
            </div>
          );
        })}
        <div className="foot stack-sm">{footer}</div>
      </aside>
      <div className="main-col">
        <header className="topbar">
          <Link to="/" className="brand"><LogoMark /> Smart Tontine</Link>
          <div className="grow" />
          <Notifications />
          <AccountMenu extra={menuExtra} />
        </header>
        <main className="main" id="contenu" tabIndex={-1}>{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="Navigation">
        {left.map((t) => <NavLink key={t.to} to={t.to} end={t.end}><t.icon size={22} />{t.label}</NavLink>)}
        {fab && Fab && <button onClick={() => setSheet('fab')} aria-label={fab.label}><span className="fab"><Fab size={26} /></span></button>}
        {right.map((t) => <NavLink key={t.to} to={t.to} end={t.end}><t.icon size={22} />{t.label}</NavLink>)}
        {!fab && left.length < 4 && <span />}
        <button onClick={() => setSheet('more')}><LayoutGrid size={22} />Plus</button>
      </nav>
      {sheet && (
        <>
          <div className="sheet-bg" onClick={() => setSheet(null)} />
          <div className="sheet" role="dialog" aria-label={sheet === 'fab' ? fab?.label : 'Plus'}>
            <div className="grab" />
            <h3 style={{ padding: '0 6px 10px' }}>{sheet === 'fab' ? fab?.label : 'Tout le menu'}</h3>
            <div className="sheet-grid">
              {(sheet === 'fab' ? fab!.actions : navItems).map((a) => (
                <Link key={a.label} to={a.to}><span className={`ico ${'tone' in a && a.tone ? a.tone : ''}`}><a.icon size={20} /></span>{a.label}</Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
