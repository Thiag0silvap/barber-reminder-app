import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { runMigrations } from '@/src/database/migrations';
import { getAppSettings } from '@/src/database/settingsRepository';
import {
  configureNotificationHandler,
  scheduleDailyClientReminder,
} from '@/src/services/notificationService';

configureNotificationHandler();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isAppReady, setIsAppReady] = useState(false);
  const [initializationError, setInitializationError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    try {
      runMigrations();
      scheduleDailyClientReminder(getAppSettings());

      if (isMounted) {
        setIsAppReady(true);
      }
    } catch (error) {
      console.warn('Nao foi possivel inicializar o app.', error);

      if (isMounted) {
        setInitializationError(true);
        setIsAppReady(true);
      }
    }

    return () => {
      isMounted = false;
    };
  }, []);

  if (!isAppReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#C08A3E" size="large" />
        <Text style={styles.loadingText}>Preparando sua agenda...</Text>
        <StatusBar style="dark" backgroundColor="#FFFCF7" />
      </View>
    );
  }

  if (initializationError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Não foi possível iniciar o app.</Text>
        <Text style={styles.errorText}>Feche e abra novamente. Se continuar, reinstale o aplicativo.</Text>
        <StatusBar style="dark" backgroundColor="#FFFCF7" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="dark" backgroundColor="#FFFCF7" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    backgroundColor: '#FFFCF7',
  },
  loadingText: {
    color: '#17110B',
    fontSize: 15,
    fontWeight: '800',
  },
  errorTitle: {
    color: '#17110B',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  errorText: {
    color: '#7A7168',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
