import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, TouchableOpacity } from 'react-native';
import { useThemeStore } from '../../stores/useThemeStore';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'elevated' | 'outlined' | 'flat';
}

export const Card: React.FC<CardProps> = ({ children, style, onPress, variant = 'elevated' }) => {
  const colors = useThemeStore((state) => state.colors);

  const cardStyle: ViewStyle = {
    backgroundColor: variant === 'outlined' ? 'transparent' : colors.surface,
    borderColor: colors.border,
    borderWidth: variant === 'outlined' ? 1.5 : 1,
    borderRadius: 20,
    padding: 16,
    shadowColor: colors.cardShadow,
    shadowOffset: { width: 0, height: variant === 'elevated' ? 4 : 0 },
    shadowOpacity: variant === 'elevated' ? 0.3 : 0,
    shadowRadius: variant === 'elevated' ? 8 : 0,
    elevation: variant === 'elevated' ? 4 : 0,
  };

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[cardStyle, style]}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
};
