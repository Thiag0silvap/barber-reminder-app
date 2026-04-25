import { useEffect, useState } from 'react';
import { Alert, Button, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { createClient, listClients } from '@/src/database/clientsRepository';
import { Client } from '@/src/types/Client';

export default function HomeScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [lastVisit, setLastVisit] = useState('');
  const [recurrenceDays, setRecurrenceDays] = useState('');

  function loadClients() {
    const data = listClients();
    setClients(data);
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
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Barber Reminder</Text>

      <TextInput
        style={styles.input}
        placeholder="Nome do cliente"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="WhatsApp"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <TextInput
        style={styles.input}
        placeholder="Última visita: 2026-04-24"
        value={lastVisit}
        onChangeText={setLastVisit}
      />

      <TextInput
        style={styles.input}
        placeholder="Recorrência em dias: 20"
        value={recurrenceDays}
        onChangeText={setRecurrenceDays}
        keyboardType="numeric"
      />

      <Button title="Salvar cliente" onPress={handleSaveClient} />

      <Text style={styles.subtitle}>Clientes cadastrados</Text>

      <FlatList
        data={clients}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.clientCard}>
            <Text style={styles.clientName}>{item.name}</Text>
            <Text>WhatsApp: {item.phone}</Text>
            <Text>Última visita: {item.lastVisit}</Text>
            <Text>Próxima visita: {item.nextVisit}</Text>
            <Text>Recorrência: {item.recurrenceDays} dias</Text>
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    padding: 12,
  },
  clientCard: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});