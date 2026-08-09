import { create } from 'zustand';
import { ThemeMode, ThemeColors, darkColors, lightColors } from '../theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeState {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'dark',
  colors: darkColors,
  isDark: true,
  setMode: async (mode: ThemeMode) => {
    const isDark = mode === 'dark' || (mode === 'system' ? true : false); // Default dark for system
    const colors = isDark ? darkColors : lightColors;
    await AsyncStorage.setItem('syncflow_theme_mode', mode);
    set({ mode, colors, isDark });
  },
  loadTheme: async () => {
    try {
      const savedMode = (await AsyncStorage.getItem('syncflow_theme_mode')) as ThemeMode | null;
      if (savedMode) {
        const isDark = savedMode === 'dark' || (savedMode === 'system' ? true : false);
        set({ mode: savedMode, colors: isDark ? darkColors : lightColors, isDark });
      }
    } catch (e) {
      console.warn('Failed to load theme preference', e);
    }
  },
}));
