import { useState } from 'react';
import { Linking, Text } from 'react-native';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Button, Card, Field, H2, P, Screen, colors, notifyError, notifyOk } from '@/components/ui';

interface Ticket { id: string; subject: string; body: string; status: string; messages: { id: string; body: string; author_id: string }[] | null }
const STATUS: Record<string, string> = { open: 'Ouvert', pending: 'Réponse reçue', closed: 'Résolu' };

export default function Support() {
  const list = useApi<Ticket[]>('/me/support/tickets');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  async function send() {
    try {
      await api('/me/support/tickets', { body: { subject, body } });
      setSubject(''); setBody('');
      notifyOk('Message envoyé', 'Notre équipe te répond en moins de 24 h.');
      await list.reload();
    } catch (e) { notifyError(e); }
  }

  return (
    <Screen onRefresh={list.reload}>
      <Card>
        <H2>Besoin d'aide ?</H2>
        <Button title="WhatsApp +225 07 48 55 32 68" variant="green" onPress={() => Linking.openURL('https://wa.me/2250748553268')} />
        <Button title="✉️ contact@smarttontine.app" variant="ghost" onPress={() => Linking.openURL('mailto:contact@smarttontine.app')} />
      </Card>
      <Card>
        <H2>Écrire au support</H2>
        <Field label="Sujet" value={subject} onChangeText={setSubject} placeholder="Dépôt non reçu" />
        <Field label="Message" value={body} onChangeText={setBody} multiline numberOfLines={4} style={{ minHeight: 90, textAlignVertical: 'top' }} />
        <Button title="Envoyer" onPress={send} disabled={subject.length < 3 || body.length < 3} />
      </Card>
      {list.data?.map((t) => (
        <Card key={t.id}>
          <Text style={{ fontWeight: '700', color: colors.ink }}>{t.subject} · {STATUS[t.status]}</Text>
          <P>{t.body}</P>
          {t.messages?.map((m) => <P key={m.id}>↳ {m.body}</P>)}
        </Card>
      ))}
    </Screen>
  );
}
