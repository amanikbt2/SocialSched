import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PostStatus } from '../../db/types';
import { statusColors } from '../../theme/colors';

interface BadgeProps {
  status?: PostStatus;
  label?: string;
  color?: string;
  bgColor?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, label, color, bgColor, size = 'md' }) => {
  let activeColor = color;
  let activeBg = bgColor;
  let textLabel = label;

  if (status) {
    const config = statusColors[status] || statusColors.draft;
    activeColor = activeColor || config.text;
    activeBg = activeBg || config.bg;
    textLabel = textLabel || status.toUpperCase();
  }

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: activeBg || 'rgba(99, 102, 241, 0.15)',
          paddingHorizontal: size === 'sm' ? 8 : 10,
          paddingVertical: size === 'sm' ? 2 : 4,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: activeColor || '#6366F1',
            fontSize: size === 'sm' ? 10 : 11,
          },
        ]}
      >
        {textLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
