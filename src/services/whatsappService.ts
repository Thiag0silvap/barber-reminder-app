import { Alert, Linking } from 'react-native';

import { getWhatsappMessageTemplate } from '../database/settingsRepository';

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

function formatRecurrenceText(recurrenceDays: number) {
  if (!recurrenceDays) {
    return 'Ainda estou acompanhando seu histórico de cortes.';
  }

  return recurrenceDays === 1
    ? 'Seu retorno costuma acontecer a cada 1 dia.'
    : `Seu retorno costuma acontecer a cada ${recurrenceDays} dias.`;
}

function buildMessage(clientName: string, recurrenceDays: number) {
  const template = getWhatsappMessageTemplate();

  return template
    .replaceAll('{cliente}', clientName)
    .replaceAll('{recorrencia}', formatRecurrenceText(recurrenceDays));
}

export async function openWhatsAppMessage({
  phone,
  clientName,
  recurrenceDays,
}: Params) {
  const formattedPhone = formatBrazilianPhone(phone);

  if (!formattedPhone || formattedPhone.length < 12) {
    Alert.alert(
      'Atenção',
      'Informe o telefone com DDD. Exemplo: 85999999999.'
    );
    return;
  }

  const message = buildMessage(clientName, recurrenceDays);
  const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

  await Linking.openURL(url);
}
