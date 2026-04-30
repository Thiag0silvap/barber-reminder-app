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
import {
  diffIsoDatesInDays,
  getLocalIsoDate,
  parseIsoDateAsLocal,
} from '@/src/utils/dateUtils';

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

type DateFieldProps = {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
};

type CalendarModalProps = {
  visible: boolean;
  selectedDate: string;
  onClose: () => void;
  onSelectDate: (value: string) => void;
};

type NewClientModalProps = {
  visible: boolean;
  name: string;
  phone: string;
  firstVisitDate: string;
  onChangeName: (value: string) => void;
  onChangePhone: (value: string) => void;
  onChangeFirstVisitDate: (value: string) => void;
  onUseToday: () => void;
  onClose: () => void;
  onSave: () => void;
};

type SearchSuggestion = {
  id: number;
  name: string;
  phone: string;
  statusLabel: string;
};

type ClientDetailsModalProps = {
  visible: boolean;
  client: Client | null;
  appointments: Appointment[];
  appointmentDate: string;
  onChangeAppointmentDate: (value: string) => void;
  onRegister: () => void;
  onRegisterToday: () => void;
  onClose: () => void;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
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
  return getLocalIsoDate();
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

  const matchesName = normalizedTerm
    ? normalizeSearch(client.name).includes(normalizedTerm)
    : false;

  const matchesPhone = numericTerm
    ? onlyNumbers(client.phone).includes(numericTerm)
    : false;

  return matchesName || matchesPhone;
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
  const date = new Date(year, month - 1, day);

  return (
    date instanceof Date &&
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
    date.getDate() === day
  );
}

function isFutureBrazilianDate(value: string) {
  if (!isValidBrazilianDate(value)) {
    return false;
  }

  const isoDate = toIsoDate(value);
  return parseIsoDateAsLocal(isoDate).getTime() > parseIsoDateAsLocal(getTodayDate()).getTime();
}

function formatDate(value: string | null) {
  if (!value || !isValidIsoDate(value)) {
    return '-';
  }

  return toBrazilianDate(value);
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function buildCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const offset = firstDay.getDay();
  const days: { date: Date; currentMonth: boolean }[] = [];

  for (let i = offset; i > 0; i--) {
    days.push({
      date: new Date(year, month, 1 - i),
      currentMonth: false,
    });
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push({
      date: new Date(year, month, day),
      currentMonth: true,
    });
  }

  while (days.length % 7 !== 0) {
    const nextDay = days.length - offset - lastDay.getDate() + 1;
    days.push({
      date: new Date(year, month + 1, nextDay),
      currentMonth: false,
    });
  }

  return days;
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

  return diffIsoDatesInDays(getTodayDate(), date);
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
  const [isNewClientModalVisible, setIsNewClientModalVisible] = useState(false);

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

  const searchSuggestions = useMemo<SearchSuggestion[]>(
    () =>
      searchTerm.trim()
        ? filteredClients.slice(0, 5).map((client) => ({
            id: client.id,
            name: client.name,
            phone: client.phone,
            statusLabel: getClientStatus(client).label,
          }))
        : [],
    [filteredClients, searchTerm]
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
    setIsNewClientModalVisible(false);

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
    const historyBeforeInsert = getAppointmentsByClient(client.id);

    const appointmentAlreadyExists = historyBeforeInsert.some(
      (appointment) => appointment.visitDate === visitIsoDate
    );

    if (appointmentAlreadyExists) {
      Alert.alert('Atendimento duplicado', 'Esse cliente já possui atendimento nessa data.');
      return;
    }

    if (client.lastVisit && diffIsoDatesInDays(client.lastVisit, visitIsoDate) < 0) {
      Alert.alert(
        'Data inválida',
        `A data não pode ser anterior ao último corte (${formatDate(client.lastVisit)}).`
      );
      return;
    }

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
              searchTerm={searchTerm}
              suggestions={searchSuggestions}
              onChangeSearchTerm={setSearchTerm}
              onSelectSuggestion={(clientId) => {
                const selectedClient = clients.find((client) => client.id === clientId);

                if (selectedClient) {
                  setSearchTerm('');
                  handleShowHistory(selectedClient);
                }
              }}
              onOpenNewClient={() => setIsNewClientModalVisible(true)}
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
              onWhatsApp={() =>
                openWhatsAppMessage({
                  phone: item.phone,
                  clientName: item.name,
                  recurrenceDays: item.recurrenceDays ?? 0,
                })
              }
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
                    : 'Cadastre o primeiro cliente para começar a formar histórico de recorrência.'
                }
              />
            ) : null
          }
        />
      </KeyboardAvoidingView>
      <NewClientModal
        visible={isNewClientModalVisible}
        name={name}
        phone={phone}
        firstVisitDate={firstVisitDate}
        onChangeName={setName}
        onChangePhone={(value) => setPhone(maskPhone(value))}
        onChangeFirstVisitDate={(value) => setFirstVisitDate(maskDate(value))}
        onUseToday={() => setFirstVisitDate(toBrazilianDate(getTodayDate()))}
        onClose={() => setIsNewClientModalVisible(false)}
        onSave={handleSaveClient}
      />
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
        appointmentDate={detailsClient ? appointmentDates[detailsClient.id] ?? '' : ''}
        onChangeAppointmentDate={(value) => {
          if (!detailsClient) {
            return;
          }

          setAppointmentDates((prev) => ({
            ...prev,
            [detailsClient.id]: maskDate(value),
          }));
        }}
        onRegister={() => {
          if (detailsClient) {
            handleRegisterAppointment(detailsClient);
            handleCloseDetails();
          }
        }}
        onRegisterToday={() => {
          if (detailsClient) {
            handleRegisterToday(detailsClient);
            handleCloseDetails();
          }
        }}
        onClose={handleCloseDetails}
        onEdit={(client) => {
          handleCloseDetails();
          handleOpenEditClient(client);
        }}
        onDelete={(client) => {
          handleCloseDetails();
          handleDeleteClient(client);
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
  searchTerm,
  suggestions,
  onChangeSearchTerm,
  onSelectSuggestion,
  onOpenNewClient,
}: {
  clientsCount: number;
  clientsTodayCount: number;
  searchTerm: string;
  suggestions: SearchSuggestion[];
  onChangeSearchTerm: (value: string) => void;
  onSelectSuggestion: (clientId: number) => void;
  onOpenNewClient: () => void;
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

      <View style={styles.toolbarPanel}>
        <Field
          icon="search-outline"
          placeholder="Buscar cliente por nome ou WhatsApp"
          value={searchTerm}
          onChangeText={onChangeSearchTerm}
          keyboardType="default"
        />
        {suggestions.length ? (
          <View style={styles.suggestionsList}>
            {suggestions.map((suggestion) => (
              <Pressable
                key={suggestion.id}
                style={styles.suggestionItem}
                onPress={() => onSelectSuggestion(suggestion.id)}>
                <View style={styles.suggestionAvatar}>
                  <Text style={styles.suggestionAvatarText}>
                    {suggestion.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.suggestionText}>
                  <Text style={styles.suggestionName}>{suggestion.name}</Text>
                  <Text style={styles.suggestionPhone}>{maskPhone(suggestion.phone)}</Text>
                </View>
                <Text style={styles.suggestionStatus}>{suggestion.statusLabel}</Text>
              </Pressable>
            ))}
          </View>
        ) : searchTerm.trim() ? (
          <View style={styles.noSuggestion}>
            <Text style={styles.noSuggestionText}>Nenhum cliente encontrado</Text>
          </View>
        ) : null}
        <Pressable style={styles.newClientButton} onPress={onOpenNewClient}>
          <Ionicons name="add-circle-outline" size={20} color={palette.surface} />
          <Text style={styles.newClientButtonText}>Novo cliente</Text>
        </Pressable>
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

function DateField({ icon, placeholder, value, onChangeText }: DateFieldProps) {
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);

  return (
    <>
      <Pressable style={styles.field} onPress={() => setIsCalendarVisible(true)}>
        <Ionicons name={icon} size={19} color={palette.muted} />
        <Text style={[styles.dateFieldText, !value && styles.dateFieldPlaceholder]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down-outline" size={18} color={palette.muted} />
      </Pressable>

      <CalendarModal
        visible={isCalendarVisible}
        selectedDate={value}
        onClose={() => setIsCalendarVisible(false)}
        onSelectDate={(date) => {
          onChangeText(date);
          setIsCalendarVisible(false);
        }}
      />
    </>
  );
}

function CalendarModal({
  visible,
  selectedDate,
  onClose,
  onSelectDate,
}: CalendarModalProps) {
  const initialDate = selectedDate ? parseIsoDateAsLocal(toIsoDate(selectedDate)) : new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  );

  useEffect(() => {
    if (visible) {
      const date = selectedDate ? parseIsoDateAsLocal(toIsoDate(selectedDate)) : new Date();
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  }, [selectedDate, visible]);

  const days = buildCalendarDays(visibleMonth);
  const selectedIsoDate = selectedDate ? toIsoDate(selectedDate) : '';
  const todayIsoDate = getTodayDate();

  function handleChangeMonth(direction: -1 | 1) {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + direction, 1)
    );
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Pressable style={styles.calendarNavButton} onPress={() => handleChangeMonth(-1)}>
              <Ionicons name="chevron-back-outline" size={22} color={palette.ink} />
            </Pressable>
            <Text style={styles.calendarTitle}>{getMonthLabel(visibleMonth)}</Text>
            <Pressable style={styles.calendarNavButton} onPress={() => handleChangeMonth(1)}>
              <Ionicons name="chevron-forward-outline" size={22} color={palette.ink} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
              <Text key={`${day}-${index}`} style={styles.weekDay}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {days.map(({ date, currentMonth }) => {
              const isoDate = getLocalIsoDate(date);
              const brazilianDate = toBrazilianDate(isoDate);
              const isSelected = isoDate === selectedIsoDate;
              const isToday = isoDate === todayIsoDate;
              const isFuture = diffIsoDatesInDays(todayIsoDate, isoDate) > 0;

              return (
                <Pressable
                  key={isoDate}
                  disabled={isFuture}
                  style={[
                    styles.calendarDay,
                    !currentMonth && styles.calendarDayMuted,
                    isToday && styles.calendarDayToday,
                    isSelected && styles.calendarDaySelected,
                    isFuture && styles.calendarDayDisabled,
                  ]}
                  onPress={() => onSelectDate(brazilianDate)}>
                  <Text
                    style={[
                      styles.calendarDayText,
                      !currentMonth && styles.calendarDayTextMuted,
                      isSelected && styles.calendarDayTextSelected,
                      isFuture && styles.calendarDayTextDisabled,
                    ]}>
                    {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.calendarActions}>
            <PrimaryButton
              icon="close-circle-outline"
              title="Cancelar"
              variant="secondary"
              onPress={onClose}
            />
            <PrimaryButton
              icon="today-outline"
              title="Hoje"
              onPress={() => onSelectDate(toBrazilianDate(getTodayDate()))}
            />
          </View>
        </View>
      </View>
    </Modal>
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
  isDue,
  onWhatsApp,
  onHistory,
}: {
  client: Client;
  isDue: boolean;
  onWhatsApp: () => void;
  onHistory: () => void;
}) {
  const status = getClientStatus(client);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.clientCard,
        isDue && styles.clientCardDue,
        pressed && styles.clientCardPressed,
      ]}
      onPress={onHistory}>
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

      <View style={styles.compactActions}>
        <Pressable style={styles.compactActionButton} onPress={onHistory}>
          <Ionicons name="open-outline" size={18} color={palette.ink} />
          <Text style={styles.compactActionText}>Ver detalhes</Text>
        </Pressable>
        <Pressable style={styles.compactWhatsappButton} onPress={onWhatsApp}>
          <Ionicons name="logo-whatsapp" size={18} color={palette.surface} />
          <Text style={styles.compactWhatsappText}>WhatsApp</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function ClientDetailsModal({
  visible,
  client,
  appointments,
  appointmentDate,
  onChangeAppointmentDate,
  onRegister,
  onRegisterToday,
  onClose,
  onEdit,
  onDelete,
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

          <View style={styles.registerPanel}>
            <Text style={styles.registerTitle}>Registrar novo atendimento</Text>
          <DateField
            icon="calendar-clear-outline"
            placeholder="DD/MM/AAAA"
            value={appointmentDate}
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
          <Pressable style={styles.modalDeleteButton} onPress={() => onDelete(client)}>
            <Ionicons name="trash-outline" size={18} color={palette.danger} />
            <Text style={styles.modalDeleteText}>Excluir cliente</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function NewClientModal({
  visible,
  name,
  phone,
  firstVisitDate,
  onChangeName,
  onChangePhone,
  onChangeFirstVisitDate,
  onUseToday,
  onClose,
  onSave,
}: NewClientModalProps) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleGroup}>
              <Text style={styles.modalTitle}>Novo cliente</Text>
              <Text style={styles.modalSubtitle}>
                Cadastre a primeira visita. A recorrência nasce do histórico.
              </Text>
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
          <DateField
            icon="calendar-outline"
            placeholder="Data do primeiro atendimento"
            value={firstVisitDate}
            onChangeText={onChangeFirstVisitDate}
          />

          <View style={styles.modalActions}>
            <PrimaryButton
              icon="today-outline"
              title="Hoje"
              variant="secondary"
              onPress={onUseToday}
            />
            <PrimaryButton
              icon="add-circle-outline"
              title="Cadastrar"
              onPress={onSave}
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
  toolbarPanel: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 24,
  },
  newClientButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 15,
    backgroundColor: palette.ink,
  },
  newClientButtonText: {
    color: palette.surface,
    fontSize: 15,
    fontWeight: '900',
  },
  suggestionsList: {
    gap: 8,
    marginBottom: 10,
  },
  suggestionItem: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 15,
    backgroundColor: '#FFFAF2',
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  suggestionAvatar: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.ink,
  },
  suggestionAvatarText: {
    color: palette.surface,
    fontSize: 15,
    fontWeight: '900',
  },
  suggestionText: {
    flex: 1,
  },
  suggestionName: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  suggestionPhone: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 2,
  },
  suggestionStatus: {
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#F6EFE6',
    color: palette.brandDark,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  noSuggestion: {
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#FFFAF2',
    borderWidth: 1,
    borderColor: palette.line,
    padding: 12,
    marginBottom: 10,
  },
  noSuggestionText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
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
  dateFieldText: {
    flex: 1,
    color: palette.ink,
    fontSize: 15,
    paddingVertical: 14,
  },
  dateFieldPlaceholder: {
    color: '#A49A90',
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
  clientCardPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.995 }],
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
  compactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  compactActionButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 14,
    backgroundColor: '#F6EFE6',
    borderWidth: 1,
    borderColor: palette.line,
  },
  compactActionText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  compactWhatsappButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 14,
    backgroundColor: palette.ink,
  },
  compactWhatsappText: {
    color: palette.surface,
    fontSize: 13,
    fontWeight: '900',
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
  calendarCard: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  calendarNavButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#F6EFE6',
  },
  calendarTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDay: {
    flex: 1,
    color: palette.muted,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  calendarDayMuted: {
    opacity: 0.38,
  },
  calendarDayToday: {
    backgroundColor: palette.warm,
  },
  calendarDaySelected: {
    backgroundColor: palette.ink,
  },
  calendarDayDisabled: {
    opacity: 0.22,
  },
  calendarDayText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  calendarDayTextMuted: {
    color: palette.muted,
  },
  calendarDayTextSelected: {
    color: palette.surface,
  },
  calendarDayTextDisabled: {
    color: palette.muted,
  },
  calendarActions: {
    flexDirection: 'row',
    gap: 8,
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
  modalDeleteButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 15,
    backgroundColor: palette.dangerSoft,
    borderWidth: 1,
    borderColor: '#F1C8BE',
    marginTop: 10,
  },
  modalDeleteText: {
    color: palette.danger,
    fontSize: 14,
    fontWeight: '900',
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
