import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useThemeStore } from '../src/stores/useThemeStore';
import { useCampaignStore } from '../src/stores/useCampaignStore';
import { useQueueStore } from '../src/stores/useQueueStore';
import { useMediaStore } from '../src/stores/useMediaStore';
import { startQueueEngine } from '../src/services/queueEngine';
import { View, StyleSheet } from 'react-native';

export default function RootLayout() {
  const { isDark, colors, loadTheme } = useThemeStore();
  const loadCampaignData = useCampaignStore((state) => state.loadData);
  const loadQueueSettings = useQueueStore((state) => state.loadQueueSettings);
  const loadMedia = useMediaStore((state) => state.loadMedia);

  useEffect(() => {
    async function init() {
      await loadTheme();
      await loadQueueSettings();
      await loadCampaignData();
      await loadMedia();
      startQueueEngine();
    }
    init();
  }, []);

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="create-post"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="campaign/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="magic-distribute/[campaignId]"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="missed-failed" options={{ headerShown: false }} />
        <Stack.Screen name="post-detail/[id]" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
