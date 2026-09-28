import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/lib/api';
import { fcfa } from '@/lib/format';
import { PartnerBrand, type Brand } from '@/components/PartnerBrand';
import { Button, Card, H1, P, Screen, notifyError } from '@/components/ui';

interface TontinePreview { kind: 'argent' | 'bien'; good_label: string | null; good_price: number | null; partner: Brand | null; name: string; organizer: string; contribution_amount: number; frequency: string; members: number; max_members: number; guarantee_amount: number; pot: number; status: string }
interface CoffrePreview { partner: Brand | null; name: string; organizer: string; contribution_amount: number | null; frequency: string; members: number; visibility: string; category: string }
type Target = (TontinePreview & { target: 'tontine' }) | (CoffrePreview & { target: 'coffre' });

const FREQ: Record<string, string> = { weekly: 'semaine', monthly: 'mois', daily: 'jour', free: 'libre' };

/** Ouvert par un lien d'invitation ou un QR code : aperçu puis adhésion (tontine ou coffre de groupe). */
export default function Rejoindre() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [target, setTarget] = useState<Target | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setTarget({ ...(await api<TontinePreview>(`/tontines/${code}/preview`)), target: 'tontine' }); return; } catch { /* pas une tontine */ }
      try { setTarget({ ...(await api<CoffrePreview>(`/cagnottes/${code}/preview`)), target: 'coffre' }); } catch { setError('Invitation introuvable ou expirée.'); }
    })();
  }, [code]);

  async function join() {
    try {
      if (target?.target === 'tontine') {
        await api(`/tontines/${code}/join`, { body: {} });
        router.replace({ pathname: '/tontine/[id]', params: { id: code } });
      } else {
        await api(`/cagnottes/${code}/join`, { body: {} });
        router.replace({ pathname: '/cagnotte/[id]', params: { id: code } });
      }
    } catch (e) { notifyError(e); }
  }

  if (error) return <Screen><P>{error}</P></Screen>;
  if (!target) return <Screen><P>Chargement…</P></Screen>;
  return (
    <Screen>
      <PartnerBrand brand={target.partner} />
      <H1>{target.target === 'tontine' ? (target.good_label ? '🛵' : '🔄') : '🐷'} {target.name}</H1>
      <Card>
        <P>Organisé par {target.organizer ?? '—'} · {target.members} membre(s)</P>
        {target.target === 'tontine' ? (
          <>
            {target.good_label
              ? <P>Tontine de bien : chaque membre reçoit « {target.good_label} » ({fcfa(target.good_price)}) à son tour. Cotisation : {fcfa(target.contribution_amount)} / {FREQ[target.frequency]}.</P>
              : <P>Cotisation : {fcfa(target.contribution_amount)} / {FREQ[target.frequency]} · pot de {fcfa(target.pot)}</P>}
            <P muted>Une caution de {fcfa(target.guarantee_amount)} est bloquée à l'adhésion et rendue en fin de tontine si tu cotises à chaque tour.</P>
            <Button title="Rejoindre la tontine" variant="green" onPress={join} disabled={target.status !== 'recruiting'} />
            {target.status !== 'recruiting' && <P muted>Cette tontine a déjà démarré.</P>}
          </>
        ) : (
          <>
            {target.contribution_amount ? <P>Cotisation attendue : {fcfa(target.contribution_amount)} / {FREQ[target.frequency]}</P> : null}
            {target.visibility === 'public'
              ? <Button title="Rejoindre le coffre" variant="green" onPress={join} />
              : <P muted>Coffre privé : demande à un administrateur de t'ajouter avec ton numéro.</P>}
          </>
        )}
      </Card>
    </Screen>
  );
}
