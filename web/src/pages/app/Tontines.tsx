import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Compass, Link2, Plus, RefreshCcw } from 'lucide-react';
import { useApi } from '../../lib/useApi';
import { dueLabel, fcfa, FREQ, TONTINE_STATUS } from '../../lib/format';
import { PartnerTag } from '../../components/Brand';
import { CreateTontineForm } from '../../components/CreateTontineForm';
import { Badge, Button, EmptyState, Input, Loading, Modal, PageHead, Ring, Segmented } from '../../components/ui';
import type { MyTontine } from './types';

type Filter = 'cours' | 'termine';

export default function Tontines() {
  const { data, loading } = useApi<MyTontine[]>('/tontines');
  const [params, setParams] = useSearchParams();
  const [code, setCode] = useState('');
  const [filter, setFilter] = useState<Filter>('cours');
  const nav = useNavigate();
  const creating = params.get('creer') === '1';
  const joinCode = code.trim().match(/[0-9a-f-]{36}/i)?.[0];
  const rows = (data ?? []).filter((t) => (filter === 'cours') === (t.status !== 'completed' && t.status !== 'cancelled'));

  return (
    <div className="stack">
      <PageHead title="Mes tontines" sub="Tontines d’argent et de biens dont vous êtes membre ou organisateur.">
        <Link to="/decouvrir" className="btn ghost"><Compass size={18} />Découvrir</Link>
        <Button icon={Plus} onClick={() => setParams({ creer: '1' })}>Créer une tontine</Button>
      </PageHead>
      <div className="card tight row">
        <span className="ico sm"><Link2 size={16} /></span>
        <Input className="grow" style={{ minWidth: 220 }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Collez un lien d’invitation ou un code pour rejoindre" aria-label="Lien ou code d’invitation" />
        <Button disabled={!joinCode} onClick={() => nav(`/rejoindre/${joinCode}`)}>Voir</Button>
      </div>
      <Segmented<Filter> value={filter} onChange={setFilter} options={[['cours', 'En cours'], ['termine', 'Terminées']]} />
      {loading ? <Loading rows={2} /> : !rows.length ? (
        <div className="card"><EmptyState icon={RefreshCcw} title={filter === 'cours' ? 'Aucune tontine en cours' : 'Aucune tontine terminée'}
          action={filter === 'cours' && <div className="row"><Button icon={Plus} onClick={() => setParams({ creer: '1' })}>Créer</Button><Link to="/decouvrir" className="btn ghost">Rejoindre</Link></div>}>
          Créez votre tontine en 1 minute, ou rejoignez une tontine publique.</EmptyState></div>
      ) : (
        <div className="grid">
          {rows.map((t) => {
            const [label, tone] = TONTINE_STATUS[t.status] ?? [t.status, 'muted'];
            const round = t.current_round?.number ?? (t.status === 'completed' ? t.max_members : 0);
            const d = t.current_round ? dueLabel(t.current_round.due_date) : null;
            return (
              <Link key={t.id} to={`/app/tontines/${t.id}`} className="card card-link stack-sm">
                <div className="row nowrap">
                  <Ring value={t.status === 'recruiting' ? (100 * t.members) / t.max_members : (100 * round) / t.max_members} size={58} stroke={6}
                    label={t.status === 'recruiting' ? `${t.members}/${t.max_members}` : `${round}/${t.max_members}`} />
                  <div className="grow"><h3 className="ellipsis">{t.name}</h3><span className="xs">{fcfa(t.contribution_amount)} / {FREQ[t.frequency]} · pot {fcfa(t.contribution_amount * t.max_members)}</span></div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <Badge tone={tone}>{label}</Badge>
                  {t.kind === 'bien' && <Badge tone="warn" plain>{t.good_label}</Badge>}
                  {t.current_round && (t.current_round.paid ? <Badge tone="ok" plain>Tour {t.current_round.number} payé</Badge> : <Badge tone={d!.tone} plain>À payer {d!.text}</Badge>)}
                </div>
                <PartnerTag partner={t.partner} />
              </Link>
            );
          })}
        </div>
      )}
      {creating && (
        <Modal title="Nouvelle tontine" onClose={() => setParams({})}>
          <CreateTontineForm onCreated={(id) => nav(`/app/tontines/${id}`)} />
        </Modal>
      )}
    </div>
  );
}
