import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SocialPlatform } from '../../db/types';
import { platformColors } from '../../theme/colors';
import { Facebook, Instagram, Video, Twitter } from 'lucide-react-native';

interface PlatformBadgeProps {
  platform: SocialPlatform;
  showLabel?: boolean;
}

export const PlatformBadge: React.FC<PlatformBadgeProps> = ({ platform, showLabel = true }) => {
  const getIcon = () => {
    switch (platform) {
      case 'facebook':
        return <Facebook size={12} color="#FFFFFF" />;
      case 'instagram':
        return <Instagram size={12} color="#FFFFFF" />;
      case 'x':
        return <Twitter size={12} color="#FFFFFF" />;
      case 'tiktok':
        return <Video size={12} color="#FFFFFF" />;
    }
  };

  const getBgColor = () => {
    switch (platform) {
      case 'facebook':
        return platformColors.facebook;
      case 'instagram':
        return platformColors.instagram;
      case 'x':
        return platformColors.x;
      case 'tiktok':
        return '#000000';
    }
  };

  return (
    <View style={[styles.badge, { backgroundColor: getBgColor() }]}>
      {getIcon()}
      {showLabel && <Text style={styles.text}>{platform.charAt(0).toUpperCase() + platform.slice(1)}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
