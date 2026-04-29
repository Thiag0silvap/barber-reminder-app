import { Alert, Linking } from 'react-native';

type OpenWhatsAppParams = {
  phone: string;
  clientName: string;
};

function onlyNumbers(value: string) {
  return value.replace(/\D/g, '');
}

export async function openWhatsAppMessage({
  phone,
  clientName,
}: OpenWhatsAppParams) {
  const cleanPhone = onlyNumbers(phone);

  if (!cleanPhone) {
    Alert.alert('Atenção', 'Telefone inválido para abrir o WhatsApp.');
    return;
  }

  const message = `Olá ${clientName}, tudo bem? Já está chegando o período do seu corte. Gostaria de agendar um horário?`;

  const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;

  await Linking.openURL(url);
}