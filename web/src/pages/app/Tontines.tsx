import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useApi } from '../../lib/useApi';
import { date, fcfa, FREQ, TONTINE_STATUS } from '../../lib/format';
import { PartnerTag } from '../../components/Brand';
import { CreateTontineForm } from '../../components/CreateTontineForm';
import { Badge, Button, Empty, Input, Loading, Modal, PageHead } from '../../components/ui';
import type { MyTontine } from './types';

export default function Tontines() {
  const { data, loading } = useApi<MyTontine[]>('/tontines');
  const [params, setParams] = useSearchParams();
  const [code, setCode] = useState('');
  const nav = useNavigate();
  const creating = params.get('creer') === '1';
  const joinCode = code.trim().match(/[0-9a-f-]{36}/i)?.[0];

  return (
    <div className="stack">
      <PageHead title="Mes tontines" sub="Tontines d’argent et de biens dont vous êtes membre ou organisateur.">
        <Link to="/decouvrir" className="btn ghost">Découvrir</Link>
        <Button onClick={() => setParams({ creer: '1' })}>+ Créer une tontine</Button>
      </PageHead>
      <div className="card tight row">
        <span className="small"><b>Rejoindre avec un code ou un lien</b></span>
        <Input className="grow" style={{ minWidth: 220 }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Collez le lien d’invitation ou le code" />
        <Button disabled={!joinCode} onClick={() => nav(`/rejoindre/${joinCode}`)}>Voir la tontine</Button>
      </div>
      {loading ? <Loading /> : !data?.length ? <Empty>Vous n’êtes dans aucune tontine. Créez-en une ou rejoignez une tontine publique.</Empty> : (
        <div className="grid">
          {data.map((t) => {
            const [label, tone] = TONTINE_STATUS[t.status] ?? [t.status, 'muted'];
            return (
              <Link key={t.id} to={`/app/tontines/${t.id}`} className="card card-link stack-sm">
                <div className="row between"><Badge tone={tone}>{label}</Badge>{t.kind === 'bien' && <Badge tone="warn">🛍️ {t.good_label}</Badge>}</div>
                <h3>{t.name}</h3>
                <p><span className="amount">{fcfa(t.contribution_amount)}</span> <span className="muted small">/ {FREQ[t.frequency]} · {t.members}/{t.max_members} membres</span></p>
                {t.current_round && <p className="small">Tour {t.current_round.number} · {date(t.current_round.due_date)} · {t.current_round.paid ? <Badge tone="ok">Payé</Badge> : <Badge tone="warn">À payer</Badge>}</p>}
                {t.my_turn && <p className="xs">Mon tour : {date(t.my_turn)}</p>}
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
