import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
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

        <Pressable style={styles.saveButton} onPress={handleSaveSettings}>
          <Ionicons name="save-outline" size={19} color={palette.surface} />
          <Text style={styles.saveButtonText}>Salvar configurações</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
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
});
