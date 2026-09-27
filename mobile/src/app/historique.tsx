import { useApi } from '@/lib/useApi';
import { Empty, Screen } from '@/components/ui';
import { HistoryRow } from '@/components/HistoryRow';

export default function Historique() {
  const { data, reload, loading } = useApi<{ entries: { id: string; type: string; description: string; amount: number; created_at: string }[] }>('/wallet/history?limit=100');
  return (
    <Screen onRefresh={reload} refreshing={loading && !!data}>
      {data?.entries.length === 0 && <Empty text="Aucune opération." />}
      {data?.entries.map((e) => <HistoryRow key={e.id + e.created_at} {...e} />)}
    </Screen>
  );
}
