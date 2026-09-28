import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import type { Tone } from '../lib/format';

export const LogoMark = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="14" fill="#2F2C8F" />
    <circle cx="32" cy="32" r="17" fill="none" stroke="#3AA935" strokeWidth="6" />
    <circle cx="32" cy="15" r="5" fill="#fff" /><circle cx="47" cy="40" r="5" fill="#fff" /><circle cx="17" cy="40" r="5" fill="#fff" />
  </svg>
);

/** Bouton qui affiche l'attente pendant une action asynchrone et bloque le double clic. */
export function Button({ onClick, children, className = '', variant, size, ...rest }:
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & { onClick?: () => unknown; variant?: 'green' | 'ghost' | 'white' | 'danger'; size?: 'sm' | 'lg' | 'block' }) {
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  return (
    <button
      {...rest}
      className={['btn', variant, size, className].filter(Boolean).join(' ')}
      disabled={busy || rest.disabled}
      onClick={onClick && (async () => { setBusy(true); try { await onClick(); } finally { if (mounted.current) setBusy(false); } })}
    >
      {busy ? '…' : children}
    </button>
  );
}

export const Field = ({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) => (
  <label className="field"><span>{label}</span>{children}{hint && <small className="hint">{hint}</small>}</label>
);
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`input ${p.className ?? ''}`} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`input ${p.className ?? ''}`} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`input ${p.className ?? ''}`} />;

export const Badge = ({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) => <span className={`badge ${tone}`}>{children}</span>;

export const Kpi = ({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) => (
  <div className="card tight kpi"><span className="xs">{label}</span><b>{value}</b>{hint && <span className="xs">{hint}</span>}</div>
);

export const Empty = ({ children }: { children: ReactNode }) => <p className="muted center" style={{ padding: '24px 8px' }}>{children}</p>;
export const Loading = () => <p className="muted" style={{ padding: 24 }}>Chargement…</p>;
export const ErrorBox = ({ error }: { error: string | null | undefined }) => (error ? <div className="error">{error}</div> : null);

export function PageHead({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return <div className="page-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children && <div className="row">{children}</div>}</div>;
}

export function Progress({ value }: { value: number }) {
  return <div className="progress" role="progressbar" aria-valuenow={value}><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal stack" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><h2 className="grow">{title}</h2><button className="linkbtn" onClick={onClose} aria-label="Fermer">✕</button></div>
        {children}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(([v, l]) => <button key={v} role="tab" aria-selected={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

// ───── Notifications éphémères et saisie du code PIN, disponibles partout ─────
interface UiCtx { toast: (msg: string, err?: boolean) => void; askPin: (reason: string) => Promise<string | null> }
const Ctx = createContext<UiCtx | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toastMsg, setToast] = useState<{ msg: string; err: boolean } | null>(null);
  const [pin, setPin] = useState<{ reason: string; resolve: (v: string | null) => void } | null>(null);
  const [value, setValue] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const toast = useCallback((msg: string, err = false) => {
    setToast({ msg, err });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);
  const askPin = useCallback((reason: string) => new Promise<string | null>((resolve) => { setValue(''); setPin({ reason, resolve }); }), []);
  const close = (v: string | null) => { pin?.resolve(v); setPin(null); };
  return (
    <Ctx.Provider value={{ toast, askPin }}>
      {children}
      {toastMsg && <div className={`toast ${toastMsg.err ? 'err' : ''}`} role="status">{toastMsg.msg}</div>}
      {pin && (
        <Modal title="Code PIN" onClose={() => close(null)}>
          <p className="muted">{pin.reason}</p>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); if (value.length === 4) close(value); }}>
            <Input autoFocus className="pin-input" type="password" inputMode="numeric" autoComplete="off" maxLength={4} aria-label="Code PIN"
              value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} />
            <button className="btn block" disabled={value.length !== 4}>Valider</button>
          </form>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

export function useUi() {
  const c = useContext(Ctx);
  if (!c) throw new Error('UiProvider manquant');
  return c;
}

/** Exécute une action et affiche le succès ou l'erreur. Renvoie true si l'action a réussi. */
export function useAction() {
  const { toast } = useUi();
  return useCallback(async (fn: () => Promise<unknown>, success?: string) => {
    try { await fn(); if (success) toast(success); return true; } catch (e) { toast((e as Error).message, true); return false; }
  }, [toast]);
}
