import { useEffect, useState } from 'react';
import { Alert, Button, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

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

import { openWhatsAppMessage } from '@/src/services/whatsappService';
import { Client } from '@/src/types/Client';

export default function HomeScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsToday, setClientsToday] = useState<Client[]>([]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [firstVisitDate, setFirstVisitDate] = useState('');

  function loadClients() {
    const data = listClients();
    setClients(data);
  }

  function loadClientsToday() {
    const data = listClientsForToday();
    setClientsToday(data);
  }

  function handleSaveClient() {
    if (!name || !phone || !firstVisitDate) {
      Alert.alert('Atenção', 'Preencha nome, WhatsApp e data do atendimento.');
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
    loadClientsToday();

    Alert.alert('Sucesso', 'Cliente cadastrado com atendimento inicial.');
  }

  function handleRegisterAppointment(client: Client) {
    const today = new Date().toISOString().split('T')[0];

    createAppointment({
      clientId: client.id,
      visitDate: today,
    });

    updateClientVisit(client.id, today, client.recurrenceDays, client.nextVisit);

    loadClients();
    loadClientsToday();

    Alert.alert('Sucesso', 'Atendimento registrado com sucesso.');
  }

  function handleShowHistory(client: Client) {
    const history = getAppointmentsByClient(client.id);

    if (!history.length) {
      Alert.alert('Histórico vazio', 'Este cliente ainda não possui atendimentos.');
      return;
    }

    const message = history.map((item) => `• ${item.visitDate}`).join('\n');

    Alert.alert(`Histórico de ${client.name}`, message);
  }

  useEffect(() => {
    loadClients();
    loadClientsToday();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Barber Reminder</Text>

      <TextInput
        style={styles.input}
        placeholder="Nome do cliente"
        placeholderTextColor="#777"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="WhatsApp"
        placeholderTextColor="#777"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <TextInput
        style={styles.input}
        placeholder="Data do atendimento: 2026-04-24"
        placeholderTextColor="#777"
        value={firstVisitDate}
        onChangeText={setFirstVisitDate}
      />

      <Button title="Salvar cliente" onPress={handleSaveClient} />

      <Text style={styles.subtitle}>Clientes para chamar hoje</Text>

      <FlatList
        data={clientsToday}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.clientCard}>
            <Text style={styles.clientName}>{item.name}</Text>
            <Text style={styles.clientText}>WhatsApp: {item.phone}</Text>
            <Text style={styles.clientText}>
              Próxima sugestão: {item.nextVisit ?? 'Aguardando histórico'}
            </Text>

            <Button
              title="Chamar no WhatsApp"
              onPress={() =>
                openWhatsAppMessage({
                  phone: item.phone,
                  clientName: item.name,
                  recurrenceDays: item.recurrenceDays ?? 0,
                })
              }
            />
          </View>
        )}
      />

      <Text style={styles.subtitle}>Clientes cadastrados</Text>

      <FlatList
        data={clients}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.clientCard}>
            <Text style={styles.clientName}>{item.name}</Text>
            <Text style={styles.clientText}>WhatsApp: {item.phone}</Text>
            <Text style={styles.clientText}>
              Último atendimento: {item.lastVisit ?? 'Não informado'}
            </Text>
            <Text style={styles.clientText}>
              Recorrência estimada:{' '}
              {item.recurrenceDays ? `${item.recurrenceDays} dias` : 'Aguardando histórico'}
            </Text>
            <Text style={styles.clientText}>
              Próxima sugestão: {item.nextVisit ?? 'Aguardando histórico'}
            </Text>

            <Button
              title="Registrar atendimento"
              onPress={() => handleRegisterAppointment(item)}
            />

            <Button
              title="Ver histórico"
              onPress={() => handleShowHistory(item)}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
    backgroundColor: '#f4f4f5',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    color: '#111827',
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 14,
    color: '#111827',
    fontSize: 16,
  },
  clientCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    gap: 6,
  },
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  clientText: {
    color: '#374151',
  },
});