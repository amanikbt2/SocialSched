export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceVariant: string;
  surfaceHover: string;
  border: string;
  borderLight: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  primaryContainer: string;
  onPrimary: string;
  secondary: string;
  accent: string;
  success: string;
  successContainer: string;
  warning: string;
  warningContainer: string;
  danger: string;
  dangerContainer: string;
  info: string;
  cardShadow: string;
}

export const darkColors: ThemeColors = {
  background: '#0F1115',
  surface: '#181B22',
  surfaceVariant: '#222631',
  surfaceHover: '#2C3140',
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.15)',
  textPrimary: '#F3F4F6',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  primary: '#6366F1', // MD3 Indigo Accent
  primaryLight: '#818CF8',
  primaryContainer: 'rgba(99, 102, 241, 0.15)',
  onPrimary: '#FFFFFF',
  secondary: '#8B5CF6',
  accent: '#EC4899',
  success: '#10B981',
  successContainer: 'rgba(16, 185, 129, 0.15)',
  warning: '#F59E0B',
  warningContainer: 'rgba(245, 158, 11, 0.15)',
  danger: '#EF4444',
  dangerContainer: 'rgba(239, 68, 68, 0.15)',
  info: '#3B82F6',
  cardShadow: 'rgba(0, 0, 0, 0.5)',
};

export const lightColors: ThemeColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceVariant: '#F1F5F9',
  surfaceHover: '#E2E8F0',
  border: 'rgba(0, 0, 0, 0.08)',
  borderLight: 'rgba(0, 0, 0, 0.15)',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  primary: '#4F46E5',
  primaryLight: '#6366F1',
  primaryContainer: 'rgba(79, 70, 229, 0.10)',
  onPrimary: '#FFFFFF',
  secondary: '#7C3AED',
  accent: '#DB2777',
  success: '#059669',
  successContainer: 'rgba(5, 150, 105, 0.10)',
  warning: '#D97706',
  warningContainer: 'rgba(217, 119, 6, 0.10)',
  danger: '#DC2626',
  dangerContainer: 'rgba(220, 38, 38, 0.10)',
  info: '#2563EB',
  cardShadow: 'rgba(0, 0, 0, 0.06)',
};

export const platformColors = {
  facebook: '#1877F2',
  instagram: '#E4405F',
  tiktok: '#00F2FE',
  tiktokDark: '#FF0050',
};

export const statusColors = {
  scheduled: { main: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', text: '#60A5FA' },
  published: { main: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', text: '#34D399' },
  failed: { main: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', text: '#F87171' },
  draft: { main: '#94A3B8', bg: 'rgba(148, 163, 184, 0.15)', text: '#CBD5E1' },
  paused: { main: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24' },
  missed: { main: '#F97316', bg: 'rgba(249, 115, 22, 0.15)', text: '#FB923C' },
  uploading: { main: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)', text: '#A78BFA' },
  waiting: { main: '#64748B', bg: 'rgba(100, 116, 139, 0.15)', text: '#94A3B8' },
};
