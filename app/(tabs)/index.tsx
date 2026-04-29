import { useEffect, useState } from 'react';
import { Alert, Button, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { createClient, listClients } from '@/src/database/clientsRepository';
import { Client } from '@/src/types/Client';

import { listClientsForToday } from '@/src/database/clientsRepository';
import { openWhatsAppMessage } from '@/src/services/whatsappService';

export default function HomeScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [lastVisit, setLastVisit] = useState('');
  const [recurrenceDays, setRecurrenceDays] = useState('');
  const [clientsToday, setClientsToday] = useState<Client[]>([])

  function loadClients() {
    const data = listClients();
    setClients(data);
  }

  function loadClientsToday() {
    const data = listClientsForToday();
    setClientsToday(data)
  }

  function calculateNextVisit(lastVisitDate: string, days: number) {
    const date = new Date(lastVisitDate);
    date.setDate(date.getDate() + days);

    return date.toISOString().split('T')[0];
  }

  function handleSaveClient() {
    if (!name || !phone || !lastVisit || !recurrenceDays) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios.');
      return;
    }

    const recurrence = Number(recurrenceDays);

    if (Number.isNaN(recurrence) || recurrence <= 0) {
      Alert.alert('Atenção', 'Informe uma recorrência válida.');
      return;
    }

    const nextVisit = calculateNextVisit(lastVisit, recurrence);

    createClient({
      name,
      phone,
      lastVisit,
      recurrenceDays: recurrence,
      nextVisit,
    });

    setName('');
    setPhone('');
    setLastVisit('');
    setRecurrenceDays('');

    loadClients();

    Alert.alert('Sucesso', 'Cliente cadastrado com sucesso.');
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
        placeholder="Última visita: 2026-04-24"
        placeholderTextColor="#777"
        value={lastVisit}
        onChangeText={setLastVisit}
      />

      <TextInput
        style={styles.input}
        placeholder="Recorrência em dias: 20"
        placeholderTextColor="#777"
        value={recurrenceDays}
        onChangeText={setRecurrenceDays}
        keyboardType="numeric"
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
              Próxima visita: {item.nextVisit}
            </Text>
            <Button
                title="Chamar no WhatsApp"
                onPress={() =>
                  openWhatsAppMessage({
                    phone: item.phone,
                    clientName: item.name,
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
            <Text style={styles.clientText}>Última visita: {item.lastVisit}</Text>
            <Text style={styles.clientText}>Próxima visita: {item.nextVisit}</Text>
            <Text style={styles.clientText}>Recorrência: {item.recurrenceDays} dias</Text>
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
  },
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  clientText: {
    color: '#374151'
  }
});