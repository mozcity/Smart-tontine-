import { Linking, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button, Card, H2, P, colors } from '@/components/ui';

/** Lien profond ouvert par l'app (QR code scanné ou lien partagé). */
export const inviteLink = (code: string) => `smarttontine://rejoindre/${code}`;

/** Invitation : QR code à scanner, code à copier, partage WhatsApp ou autre application. */
export function InviteCard({ code, name, amountLabel }: { code: string; name: string; amountLabel: string }) {
  const message = `Rejoins « ${name} » sur Smart Tontine (${amountLabel}).\nLien : ${inviteLink(code)}\nOu saisis le code : ${code}`;
  return (
    <Card>
      <H2>Inviter des membres</H2>
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <QRCode value={inviteLink(code)} size={180} color={colors.brandDark} backgroundColor="#fff" />
      </View>
      <P muted>Fais scanner ce QR code, ou partage le code :</P>
      <Text selectable style={{ fontFamily: 'monospace', color: colors.brand, textAlign: 'center' }}>{code}</Text>
      <Button title="Partager sur WhatsApp" variant="green"
        onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`)} />
      <Button title="Autre application" variant="ghost" onPress={() => Share.share({ message })} />
    </Card>
  );
}
