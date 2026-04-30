import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  listClients,
  listClientsForToday,
} from '@/src/database/clientsRepository';
import { Client } from '@/src/types/Client';

const palette = {
  ink: '#17110B',
  muted: '#7A7168',
  line: '#E8DFD3',
  paper: '#FFFCF7',
  surface: '#FFFFFF',
  brandDark: '#6F4316',
  green: '#16825D',
  greenSoft: '#E8F5EE',
  warm: '#FFF2D8',
};

export default function InsightsScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsToday, setClientsToday] = useState<Client[]>([]);

  useEffect(() => {
    setClients(listClients());
    setClientsToday(listClientsForToday());
  }, []);

  const clientsWithRecurrence = useMemo(
    () => clients.filter((client) => client.recurrenceDays),
    [clients]
  );

  const averageRecurrence = useMemo(() => {
    if (!clientsWithRecurrence.length) {
      return 0;
    }

    const total = clientsWithRecurrence.reduce(
      (sum, client) => sum + (client.recurrenceDays ?? 0),
      0
    );

    return Math.round(total / clientsWithRecurrence.length);
  }, [clientsWithRecurrence]);

  const learningClients = clients.length - clientsWithRecurrence.length;
  const activationRate = clients.length
    ? Math.round((clientsWithRecurrence.length / clients.length) * 100)
    : 0;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Visão executiva</Text>
          <Text style={styles.title}>A saúde da carteira em tempo real.</Text>
          <Text style={styles.subtitle}>
            Acompanhe previsibilidade, clientes em aprendizado e contatos que merecem prioridade.
          </Text>
        </View>

        <View style={styles.grid}>
          <InsightCard
            icon="repeat-outline"
            label="Recorrência média"
            value={averageRecurrence ? `${averageRecurrence} dias` : '-'}
            description="Média dos clientes com dois ou mais atendimentos registrados."
          />
          <InsightCard
            icon="pulse-outline"
            label="Base mapeada"
            value={`${activationRate}%`}
            description="Percentual da carteira com padrão de retorno calculado."
          />
          <InsightCard
            icon="school-outline"
            label="Em aprendizado"
            value={String(learningClients)}
            description="Clientes que precisam de mais histórico para gerar previsão."
          />
          <InsightCard
            icon="chatbubbles-outline"
            label="Contatos pendentes"
            value={String(clientsToday.length)}
            description="Retornos vencidos ou previstos para hoje."
          />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelIcon}>
            <Ionicons name="bulb-outline" size={22} color={palette.brandDark} />
          </View>
          <View style={styles.panelText}>
            <Text style={styles.panelTitle}>Leitura do produto</Text>
            <Text style={styles.panelDescription}>
              Quanto mais atendimentos forem registrados, melhor o app entende o comportamento
              de cada cliente. A rotina ideal é cadastrar, registrar cada retorno e chamar pelo
              WhatsApp quando a sugestão vencer.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InsightCard({
  icon,
  label,
  value,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardIcon}>
        <Ionicons name={icon} size={22} color={palette.green} />
      </View>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  content: {
    padding: 20,
    paddingBottom: 36,
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
  grid: {
    gap: 12,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 18,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.greenSoft,
    marginBottom: 16,
  },
  cardValue: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: '900',
  },
  cardLabel: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  cardDescription: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  panel: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: palette.warm,
    borderRadius: 20,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#F0D4A7',
  },
  panelIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF80',
  },
  panelText: {
    flex: 1,
  },
  panelTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  panelDescription: {
    color: palette.brandDark,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
});
