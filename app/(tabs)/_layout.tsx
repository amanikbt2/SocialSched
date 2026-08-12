import React from 'react';
import { Tabs } from 'expo-router';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { Home, FileText } from 'lucide-react-native';
import { Platform } from 'react-native';

export default function TabsLayout() {
  const colors = useThemeStore((state) => state.colors);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
          elevation: 25,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.12,
          shadowRadius: 10,
          ...(Platform.OS === 'web'
            ? {
                position: 'fixed' as any,
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
              }
            : {}),
        },
        tabBarItemStyle: {
          paddingVertical: 2,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 1,
        },
      }}
    >
      {/* 1. Home Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={22} color={color} />,
        }}
      />

      {/* 2. Posts Manager Tab */}
      <Tabs.Screen
        name="posts"
        options={{
          title: 'Posts',
          tabBarIcon: ({ color }) => <FileText size={22} color={color} />,
        }}
      />

      {/* Hidden secondary routes (href: null hides them from bottom bar) */}
      <Tabs.Screen name="campaigns" options={{ href: null }} />
      <Tabs.Screen name="schedule" options={{ href: null }} />
      <Tabs.Screen name="queue" options={{ href: null }} />
      <Tabs.Screen name="library" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
