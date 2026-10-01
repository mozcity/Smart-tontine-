import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertCircle, CheckCircle2, Delete, Info, Inbox, Lock, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { CHANNELS, fcfa, num, parseAmount, type Tone } from '../lib/format';

// Identifiant de dégradé unique par logo : un logo masqué (menu latéral sur téléphone) ne doit pas casser les autres.
export function LogoMark() {
  const id = `lm${useId().replace(/:/g, '')}`;
  return (
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4A46C4" /><stop offset="1" stopColor="#1C1A5C" /></linearGradient></defs>
    <rect width="64" height="64" rx="18" fill={`url(#${id})`} />
    <circle cx="32" cy="33" r="16" fill="none" stroke="#3AA935" strokeWidth="5.5" strokeDasharray="78 23" strokeLinecap="round" transform="rotate(-60 32 33)" />
    <circle cx="32" cy="17" r="5" fill="#fff" /><circle cx="46" cy="41" r="5" fill="#fff" /><circle cx="18" cy="41" r="5" fill="#fff" />
  </svg>
  );
}

/** Bouton : affiche un indicateur pendant une action asynchrone et bloque le double clic. */
export function Button({ onClick, children, className = '', variant, size, icon: Icon, ...rest }:
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & { onClick?: () => unknown; variant?: 'green' | 'ghost' | 'white' | 'danger' | 'soft'; size?: 'sm' | 'lg' | 'block'; icon?: LucideIcon }) {
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  return (
    <button
      {...rest}
      className={['btn', variant, size, className].filter(Boolean).join(' ')}
      disabled={busy || rest.disabled}
      aria-busy={busy || undefined}
      onClick={onClick && (async () => { setBusy(true); try { await onClick(); } finally { if (mounted.current) setBusy(false); } })}
    >
      {busy ? <span className="spin" aria-hidden="true" /> : Icon && <Icon size={size === 'sm' ? 15 : 18} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

export const Field = ({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) => (
  <label className="field"><span>{label}</span>{children}{hint && <small className="hint">{hint}</small>}</label>
);
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`input ${p.className ?? ''}`} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`input ${p.className ?? ''}`} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`input ${p.className ?? ''}`} />;

export const Badge = ({ tone = 'muted', plain, children }: { tone?: Tone; plain?: boolean; children: ReactNode }) => <span className={`badge ${tone} ${plain ? 'plain' : ''}`}>{children}</span>;

const ICO_TONE: Record<string, string> = { brand: '', green: 'green', gold: 'gold', red: 'red', blue: 'blue' };
export type IcoTone = 'brand' | 'green' | 'gold' | 'red' | 'blue';
export const Ico = ({ icon: Icon, tone = 'brand', size, round }: { icon: LucideIcon; tone?: IcoTone; size?: 'sm' | 'lg'; round?: boolean }) => (
  <span className={['ico', ICO_TONE[tone], size, round && 'round'].filter(Boolean).join(' ')} aria-hidden="true"><Icon size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} strokeWidth={2} /></span>
);

export const Kpi = ({ label, value, hint, icon, tone }: { label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: IcoTone }) => (
  <div className="card tight stat">
    {icon && <Ico icon={icon} tone={tone} />}
    <div className="kpi grow"><span className="xs">{label}</span><b>{value}</b>{hint && <span className="xs">{hint}</span>}</div>
  </div>
);

export function EmptyState({ icon = Inbox, title, children, action }: { icon?: LucideIcon; title?: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty"><Ico icon={icon} size="lg" round />{title && <h3>{title}</h3>}{children && <p>{children}</p>}{action}</div>;
}
export const Empty = ({ children }: { children: ReactNode }) => <EmptyState>{children}</EmptyState>;

export const Skeleton = ({ h = 16, w = '100%', r }: { h?: number; w?: number | string; r?: number }) => <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />;
export const Loading = ({ rows = 3 }: { rows?: number }) => (
  <div className="stack" aria-busy="true" aria-label="Chargement">
    <Skeleton h={30} w="40%" />
    <div className="kpis">{[0, 1, 2].map((i) => <Skeleton key={i} h={92} r={16} />)}</div>
    {Array.from({ length: rows }, (_, i) => <Skeleton key={i} h={58} r={14} />)}
  </div>
);
export const ErrorBox = ({ error }: { error: string | null | undefined }) => (error ? <div className="error" role="alert"><AlertCircle size={18} />{error}</div> : null);

const NOTICE_ICON: Record<string, LucideIcon> = { info: Info, warn: TriangleAlert, ok: CheckCircle2 };
export const Notice = ({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'ok'; children: ReactNode }) => {
  const I = NOTICE_ICON[tone];
  return <div className={`notice ${tone === 'info' ? '' : tone}`}><I size={18} /><div>{children}</div></div>;
};

export function PageHead({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return <div className="page-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children && <div className="row">{children}</div>}</div>;
}

export function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return <div className="progress" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${v}%` }} /></div>;
}

/** Anneau de progression (tours d'une tontine, objectif d'épargne, score). */
export function Ring({ value, size = 56, stroke = 6, color = 'var(--green-500)', label }: { value: number; size?: number; stroke?: number; color?: string; label?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value));
  return (
    <span className="ring" style={{ width: size, height: size }} role="img" aria-label={`${Math.round(v)} %`}>
      <svg width={size} height={size}><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset .6s' }} /></svg>
      {label !== undefined && <span>{label}</span>}
    </span>
  );
}

const initialsOf = (name?: string | null) => (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
export const Avatar = ({ name, size }: { name?: string | null; size?: 'sm' }) => <span className={`avatar ${size ?? ''}`} aria-hidden="true">{initialsOf(name)}</span>;

export function Modal({ title, onClose, children, size }: { title: string; onClose: () => void; children: ReactNode; size?: 'sm' }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal stack ${size ?? ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row nowrap between" style={{ alignItems: 'flex-start' }}><h2 className="grow">{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Fermer"><X size={20} /></button></div>
        {children}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: ([T, string] | [T, string, LucideIcon])[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(([v, l, I]) => <button key={v} role="tab" aria-selected={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{I && <I size={16} />}{l}</button>)}
    </div>
  );
}

/** Saisie d'un montant en grand, avec montants rapides. */
export function AmountInput({ value, onChange, chips = [5000, 10000, 25000, 50000], label = 'Montant', autoFocus }: { value: string; onChange: (v: string) => void; chips?: number[]; label?: string; autoFocus?: boolean }) {
  const n = parseAmount(value);
  return (
    <div className="stack-sm">
      <span className="xs" style={{ fontWeight: 600 }}>{label}</span>
      <label className="amount-input">
        <input inputMode="numeric" autoFocus={autoFocus} placeholder="0" aria-label={label} value={n ? num(n) : ''} onChange={(e) => onChange(String(parseAmount(e.target.value) || ''))} />
        <span>F CFA</span>
      </label>
      {chips.length > 0 && <div className="chips">{chips.map((c) => <button type="button" key={c} className={`chip ${n === c ? 'on' : ''}`} onClick={() => onChange(String(c))}>{fcfa(c)}</button>)}</div>}
    </div>
  );
}

const OPERATOR_COLOR: Record<string, string> = { orange_money: '#FF7900', moov_money: '#0066B3', wave: '#1DC8F2', mtn_momo: '#FFCB05' };
const OPERATOR_TEXT: Record<string, string> = { orange_money: 'OM', moov_money: 'MV', wave: 'W', mtn_momo: 'MTN' };
export function OperatorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="stack-sm">
      <span className="xs" style={{ fontWeight: 600 }}>Opérateur Mobile Money</span>
      <div className="operators" role="radiogroup">
        {Object.entries(CHANNELS).map(([k, label]) => (
          <button type="button" role="radio" aria-checked={value === k} key={k} className={`operator ${value === k ? 'on' : ''}`} onClick={() => onChange(k)}>
            <i style={{ background: OPERATOR_COLOR[k], color: k === 'mtn_momo' ? '#111' : '#fff' }}>{OPERATOR_TEXT[k]}</i>{label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ───── Notifications éphémères et code PIN (clavier), disponibles partout ─────
interface UiCtx { toast: (msg: string, err?: boolean) => void; askPin: (reason: string) => Promise<string | null> }
const Ctx = createContext<UiCtx | null>(null);

function PinPad({ reason, onDone }: { reason: string; onDone: (v: string | null) => void }) {
  const [pin, setPin] = useState('');
  const press = useCallback((d: string) => setPin((p) => (p.length < 4 ? p + d : p)), []);
  useEffect(() => { if (pin.length === 4) { const t = setTimeout(() => onDone(pin), 120); return () => clearTimeout(t); } }, [pin, onDone]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [press]);
  return (
    <Modal title="Code PIN" onClose={() => onDone(null)} size="sm">
      <div className="stack center" style={{ alignItems: 'center' }}>
        <Ico icon={Lock} size="lg" round />
        <p className="muted">{reason}</p>
        <div className="pin-dots" aria-label={`${pin.length} chiffres saisis sur 4`}>{[0, 1, 2, 3].map((i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}</div>
        <div className="pinpad" style={{ width: '100%' }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => press(d)}>{d}</button>)}
          <button className="ghost" onClick={() => onDone(null)} style={{ fontSize: 14 }}>Annuler</button>
          <button onClick={() => press('0')}>0</button>
          <button className="ghost" aria-label="Effacer" onClick={() => setPin((p) => p.slice(0, -1))}><Delete size={22} /></button>
        </div>
        <p className="xs">Ne communiquez jamais votre code PIN, même au support.</p>
      </div>
    </Modal>
  );
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [toastMsg, setToast] = useState<{ msg: string; err: boolean } | null>(null);
  const [pin, setPin] = useState<{ reason: string; resolve: (v: string | null) => void } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const toast = useCallback((msg: string, err = false) => {
    setToast({ msg, err });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 4200);
  }, []);
  const askPin = useCallback((reason: string) => new Promise<string | null>((resolve) => setPin({ reason, resolve })), []);
  const done = useCallback((v: string | null) => { setPin((p) => { p?.resolve(v); return null; }); }, []);
  return (
    <Ctx.Provider value={{ toast, askPin }}>
      {children}
      {toastMsg && <div className={`toast ${toastMsg.err ? 'err' : ''}`} role="status">{toastMsg.err ? <AlertCircle size={18} /> : <CheckCircle2 size={18} color="var(--green-500)" />}{toastMsg.msg}</div>}
      {pin && <PinPad reason={pin.reason} onDone={done} />}
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
