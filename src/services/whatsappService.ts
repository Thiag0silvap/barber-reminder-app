import { Alert, Linking } from 'react-native';

type Params = {
  phone: string;
  clientName: string;
  recurrenceDays: number;
};

function formatBrazilianPhone(value: string) {
  const numbers = value.replace(/\D/g, '');

  if (numbers.startsWith('55') && numbers.length >= 12) {
    return numbers;
  }

  if (numbers.length === 10 || numbers.length === 11) {
    return `55${numbers}`;
  }

  return numbers;
}

export async function openWhatsAppMessage({
  phone,
  clientName,
  recurrenceDays,
}: Params) {
  const formattedPhone = formatBrazilianPhone(phone);
  const recurrenceText = recurrenceDays
    ? `Costumo ver você por aqui a cada ${recurrenceDays} dias.`
    : 'Já faz um tempinho desde o seu último corte.';

  if (!formattedPhone || formattedPhone.length < 12) {
    Alert.alert(
      'Atenção',
      'Informe o telefone com DDD. Exemplo: 85999999999.'
    );
    return;
  }

  const message = `Olá ${clientName}, tudo bem? ${recurrenceText} Quer reservar um horário esta semana?`;

  const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

  await Linking.openURL(url);
}
