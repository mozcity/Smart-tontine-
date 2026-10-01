import { useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { notifyError, usePinPad } from '@/components/ui';

/**
 * Demande le code PIN avant une sortie d'argent. Si le membre n'en a pas encore,
 * il le crée sur place (saisie + confirmation) : pas de détour par le profil.
 */
export function usePin() {
  const ask = usePinPad();
  const { me, refresh } = useAuth();
  return useCallback(async (reason: string): Promise<string | null> => {
    if (me?.has_pin) return ask('Code PIN', reason);
    const a = await ask('Crée ton code PIN', 'Choisis 4 chiffres : ils protègent chaque sortie d’argent.');
    if (!a) return null;
    const b = await ask('Confirme ton code PIN', 'Saisis à nouveau les 4 mêmes chiffres.');
    if (!b) return null;
    if (a !== b) { notifyError(new Error('Les deux codes sont différents, recommence.')); return null; }
    try { await api('/auth/me/pin', { method: 'PUT', body: { pin: a } }); await refresh(); return a; } catch (e) { notifyError(e); return null; }
  }, [ask, me?.has_pin, refresh]);
}
