import React from 'react';
import { TouchableOpacity, StyleSheet, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useThemeStore } from '../../stores/useThemeStore';
import { useRouter } from 'expo-router';

interface FABProps {
  label?: string;
  onPress?: () => void;
}

export const FAB: React.FC<FABProps> = ({ label = 'Create Post', onPress }) => {
  const colors = useThemeStore((state) => state.colors);
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/create-post');
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={[
        styles.fab,
        {
          backgroundColor: colors.primary,
          shadowColor: colors.primary,
        },
      ]}
    >
      <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    gap: 8,
    zIndex: 99,
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
