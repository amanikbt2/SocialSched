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
  mode: 'light',
  colors: lightColors,
  isDark: false,
  setMode: async (mode: ThemeMode) => {
    const isDark = mode === 'dark' ? true : false;
    const colors = isDark ? darkColors : lightColors;
    await AsyncStorage.setItem('syncflow_theme_mode', mode);
    set({ mode, colors, isDark });
  },
  loadTheme: async () => {
    try {
      const savedMode = (await AsyncStorage.getItem('syncflow_theme_mode')) as ThemeMode | null;
      if (savedMode) {
        const isDark = savedMode === 'dark' ? true : false;
        set({ mode: savedMode, colors: isDark ? darkColors : lightColors, isDark });
      } else {
        set({ mode: 'light', colors: lightColors, isDark: false });
      }
    } catch (e) {
      console.warn('Failed to load theme preference', e);
    }
  },
}));
