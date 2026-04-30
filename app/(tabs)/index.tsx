import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createClient,
  deleteClient,
  listClients,
  listClientsForToday,
  updateClientInfo,
  updateClientVisit,
} from '@/src/database/clientsRepository';

import {
  createAppointment,
  deleteAppointmentsByClient,
  getAppointmentsByClient,
} from '@/src/database/appointmentsRepository';

import {
  calculateAverageRecurrence,
  calculateNextSuggestedVisit,
} from '@/src/utils/recurrenceUtils';

import { openWhatsAppMessage } from '@/src/services/whatsappService';
import { Appointment } from '@/src/types/Appointment';
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
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

type FieldProps = {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: TextInputProps['keyboardType'];
  maxLength?: number;
};

type EditClientModalProps = {
  visible: boolean;
  name: string;
  phone: string;
  onChangeName: (value: string) => void;
  onChangePhone: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

type ClientDetailsModalProps = {
  visible: boolean;
  client: Client | null;
  appointments: Appointment[];
  onClose: () => void;
  onEdit: (client: Client) => void;
  onWhatsApp: (client: Client) => void;
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
  danger: '#B94A35',
  dangerSoft: '#FCEEEA',
  warm: '#FFF2D8',
};

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function toBrazilianDate(value: string | null) {
  if (!value || !isValidIsoDate(value)) {
    return '';
  }

  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function toIsoDate(value: string) {
  if (!isValidBrazilianDate(value)) {
    return '';
  }

  const [day, month, year] = value.split('/');
  return `${year}-${month}-${day}`;
}

function onlyNumbers(value: string) {
  return value.replace(/\D/g, '');
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function clientMatchesSearch(client: Client, searchTerm: string) {
  const normalizedTerm = normalizeSearch(searchTerm);
  const numericTerm = onlyNumbers(searchTerm);

  if (!normalizedTerm && !numericTerm) {
    return true;
  }

  return (
    normalizeSearch(client.name).includes(normalizedTerm) ||
    onlyNumbers(client.phone).includes(numericTerm)
  );
}

function maskDate(value: string) {
  const numbers = onlyNumbers(value).slice(0, 8);
  const day = numbers.slice(0, 2);
  const month = numbers.slice(2, 4);
  const year = numbers.slice(4, 8);

  if (numbers.length > 4) {
    return `${day}/${month}/${year}`;
  }

  if (numbers.length > 2) {
    return `${day}/${month}`;
  }

  return day;
}

function maskPhone(value: string) {
  const numbers = onlyNumbers(value).slice(0, 11);
  const areaCode = numbers.slice(0, 2);
  const firstPart = numbers.length > 10 ? numbers.slice(2, 7) : numbers.slice(2, 6);
  const secondPart = numbers.length > 10 ? numbers.slice(7, 11) : numbers.slice(6, 10);

  if (numbers.length > 6) {
    return `(${areaCode}) ${firstPart}-${secondPart}`;
  }

  if (numbers.length > 2) {
    return `(${areaCode}) ${firstPart}`;
  }

  if (numbers.length > 0) {
    return `(${areaCode}`;
  }

  return '';
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(value);

  return (
    date instanceof Date &&
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function isValidBrazilianDate(value: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    return false;
  }

  const [day, month, year] = value.split('/').map(Number);
  const date = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);

  return (
    date instanceof Date &&
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function isFutureBrazilianDate(value: string) {
  if (!isValidBrazilianDate(value)) {
    return false;
  }

  const isoDate = toIsoDate(value);
  return new Date(isoDate).getTime() > new Date(getTodayDate()).getTime();
}

function formatDate(value: string | null) {
  if (!value || !isValidIsoDate(value)) {
    return '-';
  }

  return toBrazilianDate(value);
}

function formatRecurrence(days: number | null) {
  if (!days) {
    return 'aprendendo';
  }

  return days === 1 ? '1 dia' : `${days} dias`;
}

function getDaysUntil(date: string | null) {
  if (!date || !isValidIsoDate(date)) {
    return null;
  }

  const today = new Date(getTodayDate()).getTime();
  const target = new Date(date).getTime();
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function getClientStatus(client: Client) {
  const daysUntilNextVisit = getDaysUntil(client.nextVisit);

  if (!client.recurrenceDays) {
    return {
      label: 'Aprendendo',
      description: 'Registre mais um atendimento para calcular a recorrência.',
      tone: 'neutral' as const,
    };
  }

  if (daysUntilNextVisit === null) {
    return {
      label: 'Sem previsão',
      description: 'Ainda não há sugestão de retorno.',
      tone: 'neutral' as const,
    };
  }

  if (daysUntilNextVisit <= 0) {
    return {
      label: 'Chamar hoje',
      description: 'Cliente no período ideal de retorno.',
      tone: 'danger' as const,
    };
  }

  return {
    label: `Em ${daysUntilNextVisit} ${daysUntilNextVisit === 1 ? 'dia' : 'dias'}`,
    description: 'Retorno previsto dentro da janela calculada.',
    tone: 'success' as const,
  };
}

export default function HomeScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsToday, setClientsToday] = useState<Client[]>([]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [firstVisitDate, setFirstVisitDate] = useState(toBrazilianDate(getTodayDate()));
  const [searchTerm, setSearchTerm] = useState('');

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [detailsClient, setDetailsClient] = useState<Client | null>(null);
  const [detailsAppointments, setDetailsAppointments] = useState<Appointment[]>([]);

  const [appointmentDates, setAppointmentDates] = useState<Record<number, string>>({});

  const filteredClients = useMemo(
    () => clients.filter((client) => clientMatchesSearch(client, searchTerm)),
    [clients, searchTerm]
  );

  const filteredClientsToday = useMemo(
    () => clientsToday.filter((client) => clientMatchesSearch(client, searchTerm)),
    [clientsToday, searchTerm]
  );

  const dueClientIds = useMemo(
    () => new Set(clientsToday.map((client) => client.id)),
    [clientsToday]
  );

  const sections = useMemo<ClientSection[]>(
    () => [
      {
        title: 'Prioridade de hoje',
        subtitle: 'Clientes no período certo para uma chamada rápida.',
        data: filteredClientsToday,
      },
      {
        title: 'Carteira de clientes',
        subtitle: 'Base completa com histórico e recorrência aprendida.',
        data: filteredClients,
      },
    ],
    [filteredClients, filteredClientsToday]
  );

  function loadClients() {
    setClients(listClients());
    setClientsToday(listClientsForToday());
  }

  function handleSaveClient() {
    const normalizedName = name.trim();
    const normalizedPhone = onlyNumbers(phone);

    if (!normalizedName || !normalizedPhone || !firstVisitDate) {
      Alert.alert('Atenção', 'Preencha nome, WhatsApp e data do primeiro atendimento.');
      return;
    }

    if (normalizedPhone.length < 10) {
      Alert.alert('Atenção', 'Informe o WhatsApp com DDD.');
      return;
    }

    const phoneAlreadyExists = clients.some(
      (client) => onlyNumbers(client.phone) === normalizedPhone
    );

    if (phoneAlreadyExists) {
      Alert.alert('Cliente já cadastrado', 'Já existe um cliente com esse WhatsApp.');
      return;
    }

    if (!isValidBrazilianDate(firstVisitDate)) {
      Alert.alert('Atenção', 'Informe a data no formato DD/MM/AAAA.');
      return;
    }

    if (isFutureBrazilianDate(firstVisitDate)) {
      Alert.alert('Atenção', 'A primeira visita não pode ser uma data futura.');
      return;
    }

    const firstVisitIsoDate = toIsoDate(firstVisitDate);

    const clientId = createClient({
      name: normalizedName,
      phone: normalizedPhone,
      lastVisit: firstVisitIsoDate,
      recurrenceDays: null,
      nextVisit: null,
    });

    createAppointment({
      clientId,
      visitDate: firstVisitIsoDate,
    });

    setName('');
    setPhone('');
    setFirstVisitDate(toBrazilianDate(getTodayDate()));

    loadClients();

    Alert.alert('Cliente cadastrado', 'O primeiro atendimento já entrou no histórico.');
  }

  function registerAppointment(client: Client, visitDate: string) {
    if (!visitDate) {
      Alert.alert('Informe a data do atendimento');
      return;
    }

    if (!isValidBrazilianDate(visitDate)) {
      Alert.alert('Atenção', 'Informe a data no formato DD/MM/AAAA.');
      return;
    }

    if (isFutureBrazilianDate(visitDate)) {
      Alert.alert('Atenção', 'O atendimento não pode ser registrado em uma data futura.');
      return;
    }

    const visitIsoDate = toIsoDate(visitDate);

    createAppointment({
      clientId: client.id,
      visitDate: visitIsoDate,
    });

    const history = getAppointmentsByClient(client.id);
    const recurrence = calculateAverageRecurrence(history);
    const nextVisit = recurrence
      ? calculateNextSuggestedVisit(visitIsoDate, recurrence)
      : null;

    updateClientVisit(client.id, visitIsoDate, recurrence, nextVisit);

    setAppointmentDates((prev) => ({
      ...prev,
      [client.id]: '',
    }));

    loadClients();

    Alert.alert('Atendimento registrado', 'A sugestão de retorno foi atualizada.');
  }

  function handleRegisterAppointment(client: Client) {
    registerAppointment(client, appointmentDates[client.id]);
  }

  function handleRegisterToday(client: Client) {
    registerAppointment(client, toBrazilianDate(getTodayDate()));
  }

  function handleShowHistory(client: Client) {
    const history = getAppointmentsByClient(client.id);

    setDetailsClient(client);
    setDetailsAppointments(history);
    if (history.length >= 0) {
      return;
    }

    if (!history.length) {
      Alert.alert('Sem histórico ainda');
      return;
    }

    Alert.alert(
      `Histórico de ${client.name}`,
      history.map((appointment) => formatDate(appointment.visitDate)).join('\n')
    );
  }

  function handleCloseDetails() {
    setDetailsClient(null);
    setDetailsAppointments([]);
  }

  function handleDeleteClient(client: Client) {
    Alert.alert(
      'Excluir cliente',
      `Deseja excluir ${client.name} e todo o histórico de atendimentos? Essa ação não pode ser desfeita.`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            deleteAppointmentsByClient(client.id);
            deleteClient(client.id);
            loadClients();
            Alert.alert('Cliente excluído', 'O cliente e o histórico foram removidos.');
          },
        },
      ]
    );
  }

  function handleOpenEditClient(client: Client) {
    setEditingClient(client);
    setEditName(client.name);
    setEditPhone(maskPhone(client.phone));
  }

  function handleCloseEditClient() {
    setEditingClient(null);
    setEditName('');
    setEditPhone('');
  }

  function handleUpdateClient() {
    if (!editingClient) {
      return;
    }

    const normalizedName = editName.trim();
    const normalizedPhone = onlyNumbers(editPhone);

    if (!normalizedName || !normalizedPhone) {
      Alert.alert('Atenção', 'Preencha nome e WhatsApp.');
      return;
    }

    if (normalizedPhone.length < 10) {
      Alert.alert('Atenção', 'Informe o WhatsApp com DDD.');
      return;
    }

    const phoneAlreadyExists = clients.some(
      (client) =>
        client.id !== editingClient.id && onlyNumbers(client.phone) === normalizedPhone
    );

    if (phoneAlreadyExists) {
      Alert.alert('WhatsApp já cadastrado', 'Outro cliente já usa esse número.');
      return;
    }

    updateClientInfo(editingClient.id, normalizedName, normalizedPhone);
    handleCloseEditClient();
    loadClients();

    Alert.alert('Cliente atualizado', 'Os dados do cliente foram salvos.');
  }

  useEffect(() => {
    loadClients();
  }, []);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        style={styles.keyboardView}>
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          stickySectionHeadersEnabled={false}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <Header
              clientsCount={clients.length}
              clientsTodayCount={clientsToday.length}
              name={name}
              phone={phone}
              firstVisitDate={firstVisitDate}
              searchTerm={searchTerm}
              onChangeName={setName}
              onChangePhone={(value) => setPhone(maskPhone(value))}
              onChangeFirstVisitDate={(value) => setFirstVisitDate(maskDate(value))}
              onChangeSearchTerm={setSearchTerm}
              onUseToday={() => setFirstVisitDate(toBrazilianDate(getTodayDate()))}
              onSave={handleSaveClient}
            />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderText}>
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
                  [item.id]: maskDate(value),
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
              onRegisterToday={() => handleRegisterToday(item)}
              onHistory={() => handleShowHistory(item)}
              onEdit={() => handleOpenEditClient(item)}
              onDelete={() => handleDeleteClient(item)}
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
                    : 'Cadastre o primeiro cliente para começar a formar histórico de recorrência.'
                }
              />
            ) : null
          }
        />
      </KeyboardAvoidingView>
      <EditClientModal
        visible={!!editingClient}
        name={editName}
        phone={editPhone}
        onChangeName={setEditName}
        onChangePhone={(value) => setEditPhone(maskPhone(value))}
        onClose={handleCloseEditClient}
        onSave={handleUpdateClient}
      />
      <ClientDetailsModal
        visible={!!detailsClient}
        client={detailsClient}
        appointments={detailsAppointments}
        onClose={handleCloseDetails}
        onEdit={(client) => {
          handleCloseDetails();
          handleOpenEditClient(client);
        }}
        onWhatsApp={(client) =>
          openWhatsAppMessage({
            phone: client.phone,
            clientName: client.name,
            recurrenceDays: client.recurrenceDays ?? 0,
          })
        }
      />
    </SafeAreaView>
  );
}

function Header({
  clientsCount,
  clientsTodayCount,
  name,
  phone,
  firstVisitDate,
  searchTerm,
  onChangeName,
  onChangePhone,
  onChangeFirstVisitDate,
  onChangeSearchTerm,
  onUseToday,
  onSave,
}: {
  clientsCount: number;
  clientsTodayCount: number;
  name: string;
  phone: string;
  firstVisitDate: string;
  searchTerm: string;
  onChangeName: (value: string) => void;
  onChangePhone: (value: string) => void;
  onChangeFirstVisitDate: (value: string) => void;
  onChangeSearchTerm: (value: string) => void;
  onUseToday: () => void;
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
          Registre atendimentos e deixe o app aprender quando cada cliente costuma voltar.
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
          <View style={styles.panelHeaderText}>
            <Text style={styles.panelTitle}>Novo cliente</Text>
            <Text style={styles.panelSubtitle}>
              Cadastre a primeira visita. A recorrência nasce do histórico.
            </Text>
          </View>
          <View style={styles.panelBadge}>
            <Ionicons name="sparkles-outline" size={14} color={palette.brandDark} />
            <Text style={styles.panelBadgeText}>Automático</Text>
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
          maxLength={15}
          onChangeText={onChangePhone}
        />
        <Field
          icon="calendar-outline"
          placeholder="Data do primeiro atendimento"
          value={firstVisitDate}
          keyboardType="number-pad"
          maxLength={10}
          onChangeText={onChangeFirstVisitDate}
        />

        <View style={styles.formActions}>
          <PrimaryButton
            icon="today-outline"
            title="Hoje"
            variant="secondary"
            onPress={onUseToday}
          />
          <PrimaryButton
            icon="add-circle-outline"
            title="Cadastrar cliente"
            onPress={onSave}
          />
        </View>
      </View>

      <View style={styles.searchPanel}>
        <Field
          icon="search-outline"
          placeholder="Buscar cliente por nome ou WhatsApp"
          value={searchTerm}
          onChangeText={onChangeSearchTerm}
          keyboardType="default"
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
  maxLength,
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
        maxLength={maxLength}
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
        color={variant === 'primary' || variant === 'danger' ? palette.surface : palette.ink}
      />
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' || variant === 'danger'
            ? styles.primaryButtonText
            : styles.secondaryButtonText,
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
  onRegisterToday,
  onHistory,
  onEdit,
  onDelete,
}: {
  client: Client;
  appointmentDate: string;
  isDue: boolean;
  isPrioritySection: boolean;
  onChangeAppointmentDate: (value: string) => void;
  onWhatsApp: () => void;
  onRegister: () => void;
  onRegisterToday: () => void;
  onHistory: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = getClientStatus(client);

  return (
    <View style={[styles.clientCard, isDue && styles.clientCardDue]}>
      <View style={styles.clientTopRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{client.name.charAt(0).toUpperCase()}</Text>
        </View>

        <View style={styles.clientIdentity}>
          <Text style={styles.clientName}>{client.name}</Text>
          <Text style={styles.clientPhone}>{maskPhone(client.phone)}</Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            status.tone === 'danger' && styles.statusBadgeDanger,
            status.tone === 'success' && styles.statusBadgeSuccess,
          ]}>
          <Text
            style={[
              styles.statusBadgeText,
              status.tone === 'danger' && styles.statusBadgeTextDanger,
              status.tone === 'success' && styles.statusBadgeTextSuccess,
            ]}>
            {status.label}
          </Text>
        </View>
      </View>

      <Text style={styles.statusDescription}>{status.description}</Text>

      <View style={styles.infoGrid}>
        <InfoItem label="Último corte" value={formatDate(client.lastVisit)} />
        <InfoItem label="Recorrência" value={formatRecurrence(client.recurrenceDays)} />
        <InfoItem label="Próxima sugestão" value={formatDate(client.nextVisit)} />
      </View>

      <View style={styles.registerPanel}>
        <Text style={styles.registerTitle}>Registrar novo atendimento</Text>
        <Field
          icon="calendar-clear-outline"
          placeholder="DD/MM/AAAA"
          value={appointmentDate}
          keyboardType="number-pad"
          maxLength={10}
          onChangeText={onChangeAppointmentDate}
        />
        <View style={styles.actions}>
          <PrimaryButton
            icon="today-outline"
            title="Hoje"
            variant="secondary"
            onPress={onRegisterToday}
          />
          <PrimaryButton
            icon="checkmark-circle-outline"
            title="Registrar"
            variant="secondary"
            onPress={onRegister}
          />
        </View>
      </View>

      <View style={styles.footerActions}>
        <PrimaryButton
          icon="logo-whatsapp"
          title="WhatsApp"
          variant={isPrioritySection ? 'primary' : 'secondary'}
          onPress={onWhatsApp}
        />
        <Pressable style={styles.iconButton} onPress={onHistory}>
          <Ionicons name="time-outline" size={20} color={palette.ink} />
        </Pressable>
        <Pressable style={styles.iconButton} onPress={onEdit}>
          <Ionicons name="create-outline" size={20} color={palette.ink} />
        </Pressable>
        <Pressable style={[styles.iconButton, styles.deleteIconButton]} onPress={onDelete}>
          <Ionicons name="trash-outline" size={20} color={palette.danger} />
        </Pressable>
      </View>
    </View>
  );
}

function ClientDetailsModal({
  visible,
  client,
  appointments,
  onClose,
  onEdit,
  onWhatsApp,
}: ClientDetailsModalProps) {
  if (!client) {
    return null;
  }

  const status = getClientStatus(client);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleGroup}>
              <Text style={styles.modalTitle}>{client.name}</Text>
              <Text style={styles.modalSubtitle}>{maskPhone(client.phone)}</Text>
            </View>
            <Pressable style={styles.modalCloseButton} onPress={onClose}>
              <Ionicons name="close-outline" size={24} color={palette.ink} />
            </Pressable>
          </View>

          <View style={styles.detailsSummary}>
            <InfoItem label="Status" value={status.label} />
            <InfoItem label="Último corte" value={formatDate(client.lastVisit)} />
            <InfoItem label="Recorrência" value={formatRecurrence(client.recurrenceDays)} />
            <InfoItem label="Próxima sugestão" value={formatDate(client.nextVisit)} />
          </View>

          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Histórico de atendimentos</Text>
            <Text style={styles.historyCount}>{appointments.length}</Text>
          </View>

          <ScrollView style={styles.historyList} nestedScrollEnabled>
            {appointments.length ? (
              appointments.map((appointment, index) => (
                <View
                  key={`${appointment.id ?? appointment.visitDate}-${index}`}
                  style={styles.historyItem}>
                  <View style={styles.historyIcon}>
                    <Ionicons name="cut-outline" size={17} color={palette.brandDark} />
                  </View>
                  <View style={styles.historyText}>
                    <Text style={styles.historyDate}>{formatDate(appointment.visitDate)}</Text>
                    <Text style={styles.historyMeta}>
                      {index === 0 ? 'Atendimento mais recente' : 'Atendimento registrado'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyHistory}>
                <Ionicons name="calendar-outline" size={24} color={palette.brandDark} />
                <Text style={styles.emptyHistoryTitle}>Sem histórico registrado</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalActions}>
            <PrimaryButton
              icon="create-outline"
              title="Editar"
              variant="secondary"
              onPress={() => onEdit(client)}
            />
            <PrimaryButton
              icon="logo-whatsapp"
              title="WhatsApp"
              onPress={() => onWhatsApp(client)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EditClientModal({
  visible,
  name,
  phone,
  onChangeName,
  onChangePhone,
  onClose,
  onSave,
}: EditClientModalProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Editar cliente</Text>
              <Text style={styles.modalSubtitle}>Atualize nome ou WhatsApp.</Text>
            </View>
            <Pressable style={styles.modalCloseButton} onPress={onClose}>
              <Ionicons name="close-outline" size={24} color={palette.ink} />
            </Pressable>
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
            maxLength={15}
            onChangeText={onChangePhone}
          />

          <View style={styles.modalActions}>
            <PrimaryButton
              icon="close-circle-outline"
              title="Cancelar"
              variant="secondary"
              onPress={onClose}
            />
            <PrimaryButton
              icon="save-outline"
              title="Salvar"
              onPress={onSave}
            />
          </View>
        </View>
      </View>
    </Modal>
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
    paddingBottom: 180,
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
  searchPanel: {
    marginBottom: 24,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  panelHeaderText: {
    flex: 1,
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
    lineHeight: 18,
  },
  panelBadge: {
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
  formActions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 15,
    paddingHorizontal: 12,
  },
  primaryButton: {
    backgroundColor: palette.ink,
  },
  secondaryButton: {
    backgroundColor: '#F6EFE6',
    borderWidth: 1,
    borderColor: palette.line,
  },
  dangerButton: {
    backgroundColor: palette.danger,
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
  sectionHeaderText: {
    flex: 1,
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
    marginBottom: 10,
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
  statusBadge: {
    backgroundColor: '#F6EFE6',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  statusBadgeDanger: {
    backgroundColor: palette.dangerSoft,
  },
  statusBadgeSuccess: {
    backgroundColor: palette.successSoft,
  },
  statusBadgeText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  statusBadgeTextDanger: {
    color: palette.danger,
  },
  statusBadgeTextSuccess: {
    color: palette.success,
  },
  statusDescription: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
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
  registerPanel: {
    backgroundColor: '#FFFAF2',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  registerTitle: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 8,
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
  deleteIconButton: {
    backgroundColor: palette.dangerSoft,
    borderColor: '#F1C8BE',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(23, 17, 11, 0.42)',
  },
  modalCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  modalTitleGroup: {
    flex: 1,
  },
  modalTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 4,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#F6EFE6',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  detailsSummary: {
    gap: 8,
    marginBottom: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  historyTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  historyCount: {
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#F1E6D8',
    color: palette.brandDark,
    fontSize: 13,
    fontWeight: '900',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  historyList: {
    gap: 8,
    maxHeight: 260,
    marginBottom: 14,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFAF2',
    borderRadius: 14,
    padding: 12,
  },
  historyIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: palette.warm,
  },
  historyText: {
    flex: 1,
  },
  historyDate: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  historyMeta: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 2,
  },
  emptyHistory: {
    alignItems: 'center',
    backgroundColor: '#FFFAF2',
    borderRadius: 16,
    padding: 18,
  },
  emptyHistoryTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 8,
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
