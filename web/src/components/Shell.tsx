import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useAuth } from '../lib/auth';
import { LogoMark } from './ui';

export interface NavItem { to: string; label: string; icon: string; end?: boolean }

/** Mise en page des espaces connectés : menu latéral (tiroir sur mobile) + contenu. */
export function Shell({ items, header, footer, accent, children }: { items: (NavItem | 'sep')[]; header?: ReactNode; footer?: ReactNode; accent?: string; children: ReactNode }) {
  const { me, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <div className="shell" style={accent ? ({ '--accent': accent } as CSSProperties) : undefined}>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Link to="/" className="brand"><LogoMark /> Smart Tontine</Link>
        {header}
        {items.map((it, i) => it === 'sep'
          ? <div key={i} className="sep" />
          : <NavLink key={it.to} to={it.to} end={it.end} className="item"><span aria-hidden="true">{it.icon}</span>{it.label}</NavLink>)}
        <div className="foot stack-sm">
          {footer}
          <div className="small"><b>{me?.full_name ?? 'Mon compte'}</b><div className="xs">{me?.phone}</div></div>
          <button className="linkbtn small" style={{ textAlign: 'left' }} onClick={signOut}>Se déconnecter</button>
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <div className="topbar">
          <button className="menu-btn" style={{ display: 'block', margin: 0 }} aria-label="Menu" onClick={() => setOpen(!open)}>☰</button>
          <Link to="/" className="brand" style={{ fontSize: 16 }}><LogoMark /> Smart Tontine</Link>
        </div>
        <main className="main">{children}</main>
      </div>
      {open && <div className="modal-bg" style={{ zIndex: 35, background: 'rgba(0,0,0,.25)' }} onClick={() => setOpen(false)} />}
    </div>
  );
}
