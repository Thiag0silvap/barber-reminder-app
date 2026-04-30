import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createClient,
  listClients,
  listClientsForToday,
  updateClientVisit,
} from '@/src/database/clientsRepository';

import {
  createAppointment,
  getAppointmentsByClient,
} from '@/src/database/appointmentsRepository';

import {
  calculateAverageRecurrence,
  calculateNextSuggestedVisit,
} from '@/src/utils/recurrenceUtils';

import { openWhatsAppMessage } from '@/src/services/whatsappService';
import { Client } from '@/src/types/Client';

type ClientSection = {
  title: string;
  subtitle: string;
  data: Client[];
};

type PrimaryButtonProps = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
};

type FieldProps = {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'phone-pad';
};

const palette = {
  ink: '#17110B',
  muted: '#7A7168',
  line: '#E8DFD3',
  paper: '#FFFCF7',
  surface: '#FFFFFF',
  brand: '#C08A3E',
  brandDark: '#6F4316',
  success: '#16825D',
  successSoft: '#E8F5EE',
  warm: '#FFF2D8',
};

export default function HomeScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsToday, setClientsToday] = useState<Client[]>([]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [firstVisitDate, setFirstVisitDate] = useState('');

  const [appointmentDates, setAppointmentDates] = useState<
    Record<number, string>
  >({});

  const dueClientIds = useMemo(
    () => new Set(clientsToday.map((client) => client.id)),
    [clientsToday]
  );

  const sections = useMemo<ClientSection[]>(
    () => [
      {
        title: 'Prioridade de hoje',
        subtitle: 'Clientes com retorno sugerido para contato agora.',
        data: clientsToday,
      },
      {
        title: 'Carteira de clientes',
        subtitle: 'Base completa ordenada por nome.',
        data: clients,
      },
    ],
    [clients, clientsToday]
  );

  function loadClients() {
    setClients(listClients());
    setClientsToday(listClientsForToday());
  }

  function handleSaveClient() {
    if (!name || !phone || !firstVisitDate) {
      Alert.alert('Atenção', 'Preencha todos os campos.');
      return;
    }

    const clientId = createClient({
      name,
      phone,
      lastVisit: firstVisitDate,
      recurrenceDays: null,
      nextVisit: null,
    });

    createAppointment({
      clientId,
      visitDate: firstVisitDate,
    });

    setName('');
    setPhone('');
    setFirstVisitDate('');

    loadClients();

    Alert.alert('Cliente cadastrado com sucesso');
  }

  function handleRegisterAppointment(client: Client) {
    const visitDate = appointmentDates[client.id];

    if (!visitDate) {
      Alert.alert('Informe a data do atendimento');
      return;
    }

    createAppointment({
      clientId: client.id,
      visitDate,
    });

    const history = getAppointmentsByClient(client.id);
    const recurrence = calculateAverageRecurrence(history);

    const nextVisit = recurrence
      ? calculateNextSuggestedVisit(visitDate, recurrence)
      : null;

    updateClientVisit(client.id, visitDate, recurrence, nextVisit);

    setAppointmentDates((prev) => ({
      ...prev,
      [client.id]: '',
    }));

    loadClients();

    Alert.alert('Atendimento registrado com sucesso');
  }

  function handleShowHistory(client: Client) {
    const history = getAppointmentsByClient(client.id);

    if (!history.length) {
      Alert.alert('Sem histórico ainda');
      return;
    }

    Alert.alert(
      `Histórico de ${client.name}`,
      history.map((h) => h.visitDate).join('\n')
    );
  }

  useEffect(() => {
    loadClients();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <Header
              clientsCount={clients.length}
              clientsTodayCount={clientsToday.length}
              name={name}
              phone={phone}
              firstVisitDate={firstVisitDate}
              onChangeName={setName}
              onChangePhone={setPhone}
              onChangeFirstVisitDate={setFirstVisitDate}
              onSave={handleSaveClient}
            />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
              </View>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item, section }) => (
            <ClientCard
              client={item}
              isDue={dueClientIds.has(item.id)}
              isPrioritySection={section.title === 'Prioridade de hoje'}
              appointmentDate={appointmentDates[item.id] ?? ''}
              onChangeAppointmentDate={(value: string) =>
                setAppointmentDates((prev) => ({
                  ...prev,
                  [item.id]: value,
                }))
              }
              onWhatsApp={() =>
                openWhatsAppMessage({
                  phone: item.phone,
                  clientName: item.name,
                  recurrenceDays: item.recurrenceDays ?? 0,
                })
              }
              onRegister={() => handleRegisterAppointment(item)}
              onHistory={() => handleShowHistory(item)}
            />
          )}
          renderSectionFooter={({ section }) =>
            section.data.length === 0 ? (
              <EmptyState
                title={
                  section.title === 'Prioridade de hoje'
                    ? 'Agenda sob controle'
                    : 'Nenhum cliente cadastrado'
                }
                description={
                  section.title === 'Prioridade de hoje'
                    ? 'Quando um retorno vencer, ele aparece aqui com ação rápida para WhatsApp.'
                    : 'Cadastre o primeiro cliente para começar a criar histórico de recorrência.'
                }
              />
            ) : null
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header({
  clientsCount,
  clientsTodayCount,
  name,
  phone,
  firstVisitDate,
  onChangeName,
  onChangePhone,
  onChangeFirstVisitDate,
  onSave,
}: {
  clientsCount: number;
  clientsTodayCount: number;
  name: string;
  phone: string;
  firstVisitDate: string;
  onChangeName: (value: string) => void;
  onChangePhone: (value: string) => void;
  onChangeFirstVisitDate: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <>
      <View style={styles.hero}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <Ionicons name="cut" size={22} color={palette.surface} />
          </View>
          <View>
            <Text style={styles.brandLabel}>Barber Reminder</Text>
            <Text style={styles.brandSubLabel}>CRM inteligente para barbearias</Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>Retornos certos, agenda sempre cheia.</Text>
        <Text style={styles.heroText}>
          Controle clientes, recorrência de cortes e chamadas por WhatsApp em um painel simples de operar.
        </Text>
      </View>

      <View style={styles.metricsGrid}>
        <MetricCard
          icon="chatbubble-ellipses-outline"
          label="Para chamar"
          value={clientsTodayCount}
          tone="gold"
        />
        <MetricCard
          icon="people-outline"
          label="Clientes ativos"
          value={clientsCount}
          tone="green"
        />
      </View>

      <View style={styles.formPanel}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.panelTitle}>Novo cliente</Text>
            <Text style={styles.panelSubtitle}>Use datas no formato AAAA-MM-DD.</Text>
          </View>
          <View style={styles.panelBadge}>
            <Ionicons name="sparkles-outline" size={14} color={palette.brandDark} />
            <Text style={styles.panelBadgeText}>Recorrência automática</Text>
          </View>
        </View>

        <Field
          icon="person-outline"
          placeholder="Nome do cliente"
          value={name}
          onChangeText={onChangeName}
        />
        <Field
          icon="logo-whatsapp"
          placeholder="WhatsApp com DDD"
          value={phone}
          keyboardType="phone-pad"
          onChangeText={onChangePhone}
        />
        <Field
          icon="calendar-outline"
          placeholder="Data do primeiro atendimento"
          value={firstVisitDate}
          onChangeText={onChangeFirstVisitDate}
        />

        <PrimaryButton
          icon="add-circle-outline"
          title="Cadastrar cliente"
          onPress={onSave}
        />
      </View>
    </>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  tone: 'gold' | 'green';
}) {
  const isGold = tone === 'gold';

  return (
    <View style={styles.metricCard}>
      <View
        style={[
          styles.metricIcon,
          { backgroundColor: isGold ? palette.warm : palette.successSoft },
        ]}>
        <Ionicons
          name={icon}
          size={20}
          color={isGold ? palette.brandDark : palette.success}
        />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Field({
  icon,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Ionicons name={icon} size={19} color={palette.muted} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#A49A90"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function PrimaryButton({
  title,
  icon,
  onPress,
  variant = 'primary',
}: PrimaryButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        styles[`${variant}Button`],
        pressed && styles.buttonPressed,
      ]}
      onPress={onPress}>
      <Ionicons
        name={icon}
        size={18}
        color={variant === 'primary' ? palette.surface : palette.ink}
      />
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' ? styles.primaryButtonText : styles.secondaryButtonText,
        ]}>
        {title}
      </Text>
    </Pressable>
  );
}

function ClientCard({
  client,
  appointmentDate,
  isDue,
  isPrioritySection,
  onChangeAppointmentDate,
  onWhatsApp,
  onRegister,
  onHistory,
}: {
  client: Client;
  appointmentDate: string;
  isDue: boolean;
  isPrioritySection: boolean;
  onChangeAppointmentDate: (value: string) => void;
  onWhatsApp: () => void;
  onRegister: () => void;
  onHistory: () => void;
}) {
  return (
    <View style={[styles.clientCard, isDue && styles.clientCardDue]}>
      <View style={styles.clientTopRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{client.name.charAt(0).toUpperCase()}</Text>
        </View>

        <View style={styles.clientIdentity}>
          <Text style={styles.clientName}>{client.name}</Text>
          <Text style={styles.clientPhone}>{client.phone}</Text>
        </View>

        {isDue ? (
          <View style={styles.dueBadge}>
            <Ionicons name="flash-outline" size={13} color={palette.brandDark} />
            <Text style={styles.dueBadgeText}>Hoje</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.infoGrid}>
        <InfoItem label="Último corte" value={client.lastVisit ?? '-'} />
        <InfoItem
          label="Recorrência"
          value={client.recurrenceDays ? `${client.recurrenceDays} dias` : 'calculando'}
        />
        <InfoItem
          label="Próxima sugestão"
          value={client.nextVisit ?? 'aguardando histórico'}
        />
      </View>

      <Field
        icon="calendar-clear-outline"
        placeholder="Data do novo atendimento"
        value={appointmentDate}
        onChangeText={onChangeAppointmentDate}
      />

      <View style={styles.actions}>
        <PrimaryButton
          icon="logo-whatsapp"
          title="WhatsApp"
          variant={isPrioritySection ? 'primary' : 'secondary'}
          onPress={onWhatsApp}
        />
        <PrimaryButton
          icon="checkmark-circle-outline"
          title="Registrar"
          variant="secondary"
          onPress={onRegister}
        />
        <Pressable style={styles.iconButton} onPress={onHistory}>
          <Ionicons name="time-outline" size={20} color={palette.ink} />
        </Pressable>
      </View>
    </View>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={26} color={palette.brandDark} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  hero: {
    backgroundColor: palette.ink,
    borderRadius: 24,
    padding: 22,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 26,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.brand,
  },
  brandLabel: {
    color: palette.surface,
    fontSize: 15,
    fontWeight: '800',
  },
  brandSubLabel: {
    color: '#D8C7B5',
    fontSize: 12,
    marginTop: 2,
  },
  heroTitle: {
    color: palette.surface,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '900',
    marginBottom: 10,
  },
  heroText: {
    color: '#E7D8C7',
    fontSize: 14,
    lineHeight: 21,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  metricValue: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '900',
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 2,
  },
  formPanel: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 24,
  },
  panelHeader: {
    gap: 10,
    marginBottom: 14,
  },
  panelTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  panelSubtitle: {
    color: palette.muted,
    marginTop: 4,
    fontSize: 13,
  },
  panelBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.warm,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  panelBadgeText: {
    color: palette.brandDark,
    fontSize: 12,
    fontWeight: '700',
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
    marginBottom: 10,
  },
  input: {
    flex: 1,
    color: palette.ink,
    fontSize: 15,
    paddingVertical: 12,
  },
  button: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 15,
    paddingHorizontal: 14,
  },
  primaryButton: {
    backgroundColor: palette.ink,
  },
  secondaryButton: {
    backgroundColor: '#F6EFE6',
    borderWidth: 1,
    borderColor: palette.line,
  },
  ghostButton: {
    backgroundColor: 'transparent',
  },
  buttonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButtonText: {
    color: palette.surface,
  },
  secondaryButtonText: {
    color: palette.ink,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
    maxWidth: 270,
  },
  sectionCount: {
    minWidth: 36,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#F1E6D8',
    color: palette.brandDark,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  clientCard: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 14,
  },
  clientCardDue: {
    borderColor: '#D8AA67',
  },
  clientTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.ink,
  },
  avatarText: {
    color: palette.surface,
    fontSize: 18,
    fontWeight: '900',
  },
  clientIdentity: {
    flex: 1,
  },
  clientName: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  clientPhone: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 2,
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.warm,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  dueBadgeText: {
    color: palette.brandDark,
    fontSize: 12,
    fontWeight: '800',
  },
  infoGrid: {
    gap: 8,
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFAF2',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    flex: 1,
    color: palette.ink,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6EFE6',
    borderWidth: 1,
    borderColor: palette.line,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#FFF8EE',
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 10,
  },
  emptyDescription: {
    color: palette.muted,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
  },
});
