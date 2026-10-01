import { useApi } from '@/lib/useApi';
import { Card, EmptyState, Screen } from '@/components/ui';
import { HistoryRow } from '@/components/HistoryRow';

export default function Historique() {
  const { data, reload, loading } = useApi<{ entries: { id: string; type: string; description: string; amount: number; created_at: string }[] }>('/wallet/history?limit=100');
  return (
    <Screen onRefresh={reload} refreshing={loading && !!data} edges={[]}>
      <Card style={{ paddingVertical: 4 }}>
        {data?.entries.length === 0 && <EmptyState title="Aucune opération" text="Tes dépôts, cotisations et retraits apparaîtront ici." />}
        {data?.entries.map((e, i, arr) => <HistoryRow key={e.id + e.created_at} {...e} last={i === arr.length - 1} />)}
      </Card>
    </Screen>
  );
}
