import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AppSettings,
  getAppSettings,
  getDefaultAppSettings,
  updateAppSettings,
} from '@/src/database/settingsRepository';
import {
  scheduleDailyClientReminder,
  sendTestReminder,
} from '@/src/services/notificationService';
import {
  exportBackupFile,
  pickBackupFile,
  restoreBackupFile,
} from '@/src/services/backupService';

const palette = {
  ink: '#17110B',
  muted: '#7A7168',
  line: '#E8DFD3',
  paper: '#FFFCF7',
  surface: '#FFFFFF',
  brand: '#C08A3E',
  brandDark: '#6F4316',
  success: '#16825D',
  warm: '#FFF2D8',
};

const manualItems = [
  {
    icon: 'person-add-outline',
    color: '#16825D',
    title: '1. Cadastrar cliente',
    description:
      'Na aba Agenda, toque em Novo cliente. Informe nome, WhatsApp com DDD e a data do primeiro atendimento. O app salva essa primeira visita no histórico automaticamente.',
  },
  {
    icon: 'cut-outline',
    color: '#C08A3E',
    title: '2. Registrar retorno',
    description:
      'Abra o cliente pela carteira ou pela busca, informe a data do atendimento e toque em Registrar. Cada novo retorno melhora o cálculo da próxima visita.',
  },
  {
    icon: 'repeat-outline',
    color: '#2563EB',
    title: '3. Recorrência automática',
    description:
      'O barbeiro não precisa informar a frequência manualmente. Depois de dois ou mais atendimentos, o app calcula o intervalo médio de retorno do cliente.',
  },
  {
    icon: 'logo-whatsapp',
    color: '#16A34A',
    title: '4. Chamar no WhatsApp',
    description:
      'Quando um cliente estiver no período certo de retorno, ele aparece em Prioridade de hoje. Toque em WhatsApp para abrir a conversa com uma mensagem pronta.',
  },
  {
    icon: 'search-outline',
    color: '#7C3AED',
    title: '5. Buscar cliente',
    description:
      'Use o campo de busca para procurar por nome ou telefone. Toque em uma sugestão para abrir rapidamente o histórico e as ações do cliente.',
  },
  {
    icon: 'bar-chart-outline',
    color: '#0EA5E9',
    title: '6. Insights',
    description:
      'A aba Insights mostra indicadores da carteira: clientes com recorrência aprendida, contatos pendentes, média de retorno e clientes ainda em aprendizado.',
  },
  {
    icon: 'notifications-outline',
    color: '#EA580C',
    title: '7. Lembrete diário',
    description:
      'Em Ajustes, ative o lembrete diário e escolha um horário. O app envia uma notificação para lembrar de revisar os clientes que precisam de contato.',
  },
  {
    icon: 'cloud-upload-outline',
    color: '#475569',
    title: '8. Backup',
    description:
      'Use Exportar backup para guardar uma cópia dos dados. Use Importar backup para restaurar clientes, atendimentos e configurações em caso de troca de celular.',
  },
];

function maskTime(value: string) {
  const numbers = value.replace(/\D/g, '').slice(0, 4);
  const hour = numbers.slice(0, 2);
  const minute = numbers.slice(2, 4);

  if (numbers.length > 2) {
    return `${hour}:${minute}`;
  }

  return hour;
}

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hour, minute] = value.split(':').map(Number);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

export default function SettingsScreen() {
  const [barbershopName, setBarbershopName] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationTime, setNotificationTime] = useState('09:00');
  const [isManualVisible, setIsManualVisible] = useState(false);

  function loadSettings() {
    const settings = getAppSettings();

    setBarbershopName(settings.barbershopName);
    setWhatsappMessage(settings.whatsappMessage);
    setNotificationsEnabled(settings.notificationsEnabled);
    setNotificationTime(formatTime(settings.notificationHour, settings.notificationMinute));
  }

  async function handleSaveSettings() {
    const parsedTime = parseTime(notificationTime);

    if (!barbershopName.trim()) {
      Alert.alert('Atenção', 'Informe o nome da barbearia.');
      return;
    }

    if (!whatsappMessage.trim()) {
      Alert.alert('Atenção', 'Informe a mensagem padrão do WhatsApp.');
      return;
    }

    if (!parsedTime) {
      Alert.alert('Atenção', 'Informe o horário no formato HH:MM.');
      return;
    }

    const settings: AppSettings = {
      barbershopName: barbershopName.trim(),
      whatsappMessage: whatsappMessage.trim(),
      notificationsEnabled,
      notificationHour: parsedTime.hour,
      notificationMinute: parsedTime.minute,
    };

    updateAppSettings(settings);
    const scheduled = await scheduleDailyClientReminder(settings, {
      requestPermission: true,
    });

    Alert.alert(
      'Configurações salvas',
      scheduled || !notificationsEnabled
        ? 'As preferências foram atualizadas.'
        : 'As preferências foram salvas, mas a permissão de notificação não foi concedida.'
    );
  }

  async function handleSendTestReminder() {
    const parsedTime = parseTime(notificationTime);
    const defaults = getDefaultAppSettings();

    const success = await sendTestReminder({
      barbershopName: barbershopName.trim() || defaults.barbershopName,
      whatsappMessage: whatsappMessage.trim() || defaults.whatsappMessage,
      notificationsEnabled,
      notificationHour: parsedTime?.hour ?? defaults.notificationHour,
      notificationMinute: parsedTime?.minute ?? defaults.notificationMinute,
    });

    Alert.alert(
      success ? 'Teste enviado' : 'Permissão necessária',
      success
        ? 'A notificação de teste deve aparecer em alguns segundos.'
        : 'Ative a permissão de notificações para usar os lembretes.'
    );
  }

  function handleRestoreMessage() {
    setWhatsappMessage(getDefaultAppSettings().whatsappMessage);
  }

  async function handleExportBackup() {
    try {
      await exportBackupFile();
    } catch {
      Alert.alert('Erro ao exportar', 'Não foi possível gerar o backup agora.');
    }
  }

  async function handleImportBackup() {
    try {
      const backup = await pickBackupFile();

      if (!backup) {
        return;
      }

      Alert.alert(
        'Restaurar backup',
        `Este backup possui ${backup.clientsCount} cliente(s) e ${backup.appointmentsCount} atendimento(s). Os dados atuais serão substituídos. Deseja continuar?`,
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Restaurar',
            style: 'destructive',
            onPress: () => {
              try {
                restoreBackupFile(backup.fileUri);
                loadSettings();
                Alert.alert('Backup restaurado', 'Os dados foram recuperados com sucesso.');
              } catch {
                Alert.alert('Erro ao restaurar', 'O arquivo selecionado não é um backup válido.');
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert('Erro ao importar', 'Não foi possível ler o arquivo de backup.');
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Ajustes</Text>
          <Text style={styles.title}>Configure a experiência da barbearia.</Text>
          <Text style={styles.subtitle}>
            Personalize a mensagem do WhatsApp e o horário do lembrete diário.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Identidade</Text>
          <View style={styles.field}>
            <Ionicons name="storefront-outline" size={19} color={palette.muted} />
            <TextInput
              style={styles.input}
              placeholder="Nome da barbearia"
              placeholderTextColor="#A49A90"
              value={barbershopName}
              onChangeText={setBarbershopName}
            />
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderText}>
              <Text style={styles.panelTitle}>Mensagem do WhatsApp</Text>
              <Text style={styles.panelSubtitle}>
                Use {'{cliente}'} para inserir o nome e {'{recorrencia}'} para inserir a frequência.
              </Text>
            </View>
            <Pressable style={styles.smallButton} onPress={handleRestoreMessage}>
              <Text style={styles.smallButtonText}>Padrão</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.messageInput}
            placeholder="Mensagem enviada para o cliente"
            placeholderTextColor="#A49A90"
            value={whatsappMessage}
            onChangeText={setWhatsappMessage}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.panel}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.panelTitle}>Lembrete diário</Text>
              <Text style={styles.panelSubtitle}>
                O app avisa todos os dias para revisar clientes que precisam de contato.
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              thumbColor={notificationsEnabled ? palette.brand : '#F4EFE8'}
              trackColor={{ false: '#D8CEC3', true: '#F2D6AA' }}
            />
          </View>

          <View style={styles.field}>
            <Ionicons name="time-outline" size={19} color={palette.muted} />
            <TextInput
              style={styles.input}
              placeholder="09:00"
              placeholderTextColor="#A49A90"
              value={notificationTime}
              keyboardType="number-pad"
              maxLength={5}
              onChangeText={(value) => setNotificationTime(maskTime(value))}
            />
          </View>

          <Pressable style={styles.testButton} onPress={handleSendTestReminder}>
            <Ionicons name="notifications-outline" size={18} color={palette.ink} />
            <Text style={styles.testButtonText}>Enviar teste</Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Backup</Text>
          <Text style={styles.panelSubtitle}>
            Exporte ou restaure um arquivo seguro com clientes, atendimentos e configurações.
          </Text>

          <Pressable style={styles.testButton} onPress={handleExportBackup}>
            <Ionicons name="download-outline" size={18} color={palette.ink} />
            <Text style={styles.testButtonText}>Exportar backup</Text>
          </Pressable>
          <Pressable style={styles.testButton} onPress={handleImportBackup}>
            <Ionicons name="cloud-upload-outline" size={18} color={palette.ink} />
            <Text style={styles.testButtonText}>Importar backup</Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Manual do usuário</Text>
          <Text style={styles.panelSubtitle}>
            Consulte o passo a passo das principais funções do Barber Reminder.
          </Text>

          <Pressable style={styles.testButton} onPress={() => setIsManualVisible(true)}>
            <Ionicons name="book-outline" size={18} color={palette.ink} />
            <Text style={styles.testButtonText}>Abrir manual</Text>
          </Pressable>
        </View>

        <Pressable style={styles.saveButton} onPress={handleSaveSettings}>
          <Ionicons name="save-outline" size={19} color={palette.surface} />
          <Text style={styles.saveButtonText}>Salvar configurações</Text>
        </Pressable>
      </ScrollView>

      <ManualModal visible={isManualVisible} onClose={() => setIsManualVisible(false)} />
    </SafeAreaView>
  );
}

function ManualModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [expandedItem, setExpandedItem] = useState(0);

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.manualSafeArea}>
        <View style={styles.manualTopBar}>
          <Pressable style={styles.manualBackButton} onPress={onClose}>
            <Ionicons name="arrow-back-outline" size={24} color={palette.ink} />
          </Pressable>
          <Text style={styles.manualTopTitle}>Manual do Usuário</Text>
          <View style={styles.manualBackButtonPlaceholder} />
        </View>

        <ScrollView contentContainerStyle={styles.manualContent}>
          <View style={styles.manualHero}>
            <View style={styles.manualHeroIcon}>
              <Ionicons name="book-outline" size={48} color={palette.surface} />
            </View>
            <Text style={styles.manualHeroTitle}>Barber Reminder</Text>
            <Text style={styles.manualHeroText}>
              Guia rápido para usar o app no dia a dia da barbearia.
            </Text>
          </View>

          <View style={styles.manualSectionHeader}>
            <View style={styles.manualSectionIcon}>
              <Ionicons name="rocket-outline" size={24} color={palette.brandDark} />
            </View>
            <Text style={styles.manualSectionTitle}>Primeiros passos</Text>
          </View>

          <View style={styles.manualCard}>
            <View style={styles.manualCardHeader}>
              <View style={styles.manualInfoIcon}>
                <Ionicons name="information-circle-outline" size={24} color={palette.brandDark} />
              </View>
              <Text style={styles.manualCardTitle}>Sobre o aplicativo</Text>
            </View>
            <Text style={styles.manualParagraph}>
              O Barber Reminder ajuda a barbearia a registrar atendimentos, aprender a recorrência
              de cada cliente e lembrar o momento certo de chamar pelo WhatsApp.
            </Text>
            <Text style={styles.manualBullet}>• Cadastre clientes com nome e WhatsApp.</Text>
            <Text style={styles.manualBullet}>• Registre cada retorno realizado.</Text>
            <Text style={styles.manualBullet}>• Acompanhe clientes que precisam de contato.</Text>
            <Text style={styles.manualBullet}>• Exporte backup para proteger os dados.</Text>
          </View>

          <View style={styles.manualCard}>
            <View style={styles.manualCardHeader}>
              <View style={styles.manualSuccessIcon}>
                <Ionicons name="checkmark-done-outline" size={24} color={palette.success} />
              </View>
              <Text style={styles.manualCardTitle}>Rotina recomendada</Text>
            </View>

            {[
              'Cadastre o cliente no primeiro atendimento.',
              'Registre todo retorno quando ele voltar.',
              'Veja a lista Prioridade de hoje diariamente.',
              'Chame o cliente pelo WhatsApp quando o retorno vencer.',
            ].map((step, index) => (
              <View key={step} style={styles.manualStep}>
                <Text style={styles.manualStepNumber}>{index + 1}</Text>
                <Text style={styles.manualStepText}>{step}</Text>
              </View>
            ))}

            <View style={styles.manualTip}>
              <Ionicons name="bulb-outline" size={20} color={palette.brandDark} />
              <Text style={styles.manualTipText}>
                Quanto mais atendimentos forem registrados, melhor fica a previsão de retorno.
              </Text>
            </View>
          </View>

          <View style={styles.manualSectionHeader}>
            <View style={styles.manualSectionIcon}>
              <Ionicons name="grid-outline" size={24} color={palette.brandDark} />
            </View>
            <Text style={styles.manualSectionTitle}>Funcionalidades do Sistema</Text>
          </View>

          {manualItems.map((item, index) => (
            <ManualAccordionItem
              key={item.title}
              icon={item.icon as keyof typeof Ionicons.glyphMap}
              color={item.color}
              title={item.title}
              description={item.description}
              expanded={expandedItem === index}
              onPress={() => setExpandedItem(expandedItem === index ? -1 : index)}
            />
          ))}

          <View style={styles.manualSupport}>
            <Ionicons name="headset-outline" size={34} color={palette.brand} />
            <Text style={styles.manualSupportTitle}>Precisa de ajuda?</Text>
            <Text style={styles.manualSupportText}>
              Fale com o desenvolvedor para tirar dúvidas ou solicitar ajustes.
            </Text>
            <Text style={styles.manualVersion}>Versão 1.0</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ManualAccordionItem({
  icon,
  color,
  title,
  description,
  expanded,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  description: string;
  expanded: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.manualAccordion} onPress={onPress}>
      <View style={styles.manualAccordionHeader}>
        <View style={[styles.manualAccordionIcon, { backgroundColor: `${color}14` }]}>
          <Ionicons name={icon} size={26} color={color} />
        </View>
        <Text style={styles.manualAccordionTitle}>{title}</Text>
        <Ionicons
          name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={22}
          color={palette.muted}
        />
      </View>

      {expanded ? <Text style={styles.manualAccordionText}>{description}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  header: {
    backgroundColor: palette.ink,
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: palette.warm,
    color: palette.brandDark,
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 24,
  },
  title: {
    color: palette.surface,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '900',
  },
  subtitle: {
    color: '#E7D8C7',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  panel: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 14,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  panelHeaderText: {
    flex: 1,
  },
  panelTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  panelSubtitle: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  field: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: '#FFFEFB',
    borderRadius: 15,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  input: {
    flex: 1,
    color: palette.ink,
    fontSize: 15,
    paddingVertical: 12,
  },
  messageInput: {
    minHeight: 130,
    color: palette.ink,
    fontSize: 15,
    lineHeight: 21,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: '#FFFEFB',
    borderRadius: 15,
    padding: 14,
  },
  smallButton: {
    backgroundColor: palette.warm,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallButtonText: {
    color: palette.brandDark,
    fontSize: 12,
    fontWeight: '900',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchText: {
    flex: 1,
  },
  testButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 15,
    backgroundColor: '#F6EFE6',
    borderWidth: 1,
    borderColor: palette.line,
    marginTop: 12,
  },
  testButtonText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  saveButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 17,
    backgroundColor: palette.ink,
    marginTop: 4,
  },
  saveButtonText: {
    color: palette.surface,
    fontSize: 15,
    fontWeight: '900',
  },
  manualSafeArea: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  manualTopBar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#D7EEF1',
    backgroundColor: palette.surface,
  },
  manualBackButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  manualBackButtonPlaceholder: {
    width: 42,
    height: 42,
  },
  manualTopTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  manualContent: {
    padding: 20,
    paddingBottom: 42,
  },
  manualHero: {
    alignItems: 'center',
    borderRadius: 24,
    padding: 28,
    marginBottom: 26,
    backgroundColor: palette.ink,
  },
  manualHeroIcon: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: palette.brand,
    marginBottom: 18,
  },
  manualHeroTitle: {
    color: palette.surface,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  manualHeroText: {
    color: '#E7D8C7',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  manualSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    marginTop: 4,
  },
  manualSectionIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: palette.warm,
  },
  manualSectionTitle: {
    flex: 1,
    color: palette.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  manualCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E9EEF4',
    marginBottom: 18,
  },
  manualCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  manualInfoIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#EAF6FB',
  },
  manualSuccessIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#E8F5EE',
  },
  manualCardTitle: {
    flex: 1,
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  manualParagraph: {
    color: '#44403A',
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 14,
  },
  manualBullet: {
    color: '#44403A',
    fontSize: 14,
    lineHeight: 23,
  },
  manualStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  manualStepNumber: {
    width: 32,
    height: 32,
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: palette.success,
    color: palette.surface,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 32,
    textAlign: 'center',
  },
  manualStepText: {
    flex: 1,
    color: '#44403A',
    fontSize: 14,
    lineHeight: 20,
  },
  manualTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#F0D4A7',
    borderRadius: 16,
    backgroundColor: '#FFF9E8',
    padding: 12,
    marginTop: 6,
  },
  manualTipText: {
    flex: 1,
    color: palette.brandDark,
    fontSize: 13,
    lineHeight: 19,
  },
  manualAccordion: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E9EEF4',
    padding: 14,
    marginBottom: 12,
  },
  manualAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  manualAccordionIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  manualAccordionTitle: {
    flex: 1,
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  manualAccordionText: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    paddingLeft: 58,
  },
  manualSupport: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    paddingTop: 26,
    marginTop: 24,
  },
  manualSupportTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 10,
  },
  manualSupportText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
  },
  manualVersion: {
    color: '#A8A29E',
    fontSize: 13,
    marginTop: 24,
  },
});
