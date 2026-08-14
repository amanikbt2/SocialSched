import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface TopReloadProgressBarProps {
  loading: boolean;
  color?: string;
}

export const TopReloadProgressBar: React.FC<TopReloadProgressBarProps> = ({
  loading,
  color = '#1877F2',
}) => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading) {
      animValue.setValue(0);
      Animated.loop(
        Animated.timing(animValue, {
          toValue: 1,
          duration: 900,
          useNativeDriver: false,
        })
      ).start();
    } else {
      animValue.stopAnimation();
      animValue.setValue(0);
    }
  }, [loading]);

  if (!loading) return null;

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['-100%', '100%'],
  });

  return (
    <View style={styles.barContainer} pointerEvents="none">
      <Animated.View
        style={[
          styles.blueLine,
          {
            backgroundColor: color,
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  barContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(24, 119, 242, 0.18)',
    zIndex: 99999,
    overflow: 'hidden',
  },
  blueLine: {
    width: '65%',
    height: '100%',
    borderRadius: 2,
    shadowColor: '#1877F2',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
});
