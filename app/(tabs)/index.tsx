import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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

export default function HomeScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsToday, setClientsToday] = useState<Client[]>([]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [firstVisitDate, setFirstVisitDate] = useState('');

  const [appointmentDates, setAppointmentDates] = useState<
    Record<number, string>
  >({});

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
    <View style={styles.container}>
      <Text style={styles.title}>Barber Reminder ✂️</Text>

      {/* RESUMO */}
      <View style={styles.summaryContainer}>
        <SummaryCard title="Para chamar hoje" value={clientsToday.length} />
        <SummaryCard title="Clientes totais" value={clients.length} />
      </View>

      {/* NOVO CLIENTE */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Novo cliente</Text>

        <TextInput
          style={styles.input}
          placeholder="Nome"
          value={name}
          onChangeText={setName}
        />

        <TextInput
          style={styles.input}
          placeholder="WhatsApp"
          value={phone}
          onChangeText={setPhone}
        />

        <TextInput
          style={styles.input}
          placeholder="Data do primeiro atendimento"
          value={firstVisitDate}
          onChangeText={setFirstVisitDate}
        />

        <PrimaryButton title="Cadastrar cliente" onPress={handleSaveClient} />
      </View>

      {/* CLIENTES PARA HOJE */}
      <Text style={styles.sectionTitle}>Clientes para chamar hoje</Text>

      <FlatList
        data={clientsToday}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ClientCard
            client={item}
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
      />

      {/* TODOS CLIENTES */}
      <Text style={styles.sectionTitle}>Todos os clientes</Text>

      <FlatList
        data={clients}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ClientCard
            client={item}
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
      />
    </View>
  );
}

function SummaryCard({ title, value }: any) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{title}</Text>
    </View>
  );
}

function PrimaryButton({ title, onPress }: any) {
  return (
    <TouchableOpacity style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{title}</Text>
    </TouchableOpacity>
  );
}

function ClientCard({
  client,
  appointmentDate,
  onChangeAppointmentDate,
  onWhatsApp,
  onRegister,
  onHistory,
}: any) {
  return (
    <View style={styles.card}>
      <Text style={styles.clientName}>{client.name}</Text>

      <Text>Último corte: {client.lastVisit ?? '-'}</Text>

      <Text>
        Recorrência:{' '}
        {client.recurrenceDays
          ? `${client.recurrenceDays} dias`
          : 'calculando...'}
      </Text>

      <Text>
        Próxima sugestão:{' '}
        {client.nextVisit ?? 'aguardando histórico suficiente'}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Data do novo atendimento"
        value={appointmentDate}
        onChangeText={onChangeAppointmentDate}
      />

      <View style={styles.actions}>
        <PrimaryButton title="WhatsApp" onPress={onWhatsApp} />
        <PrimaryButton title="Registrar" onPress={onRegister} />
        <PrimaryButton title="Histórico" onPress={onHistory} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8fafc',
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 10,
  },

  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },

  summaryValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },

  summaryLabel: {
    fontSize: 13,
    color: '#555',
  },

  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
  },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },

  primaryButton: {
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },

  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  clientName: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },

  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
});