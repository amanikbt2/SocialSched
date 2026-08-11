import React from 'react';
import { View, Image, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface FacebookMediaGridProps {
  images: string[];
  onPressImage?: (index: number) => void;
}

export const FacebookMediaGrid: React.FC<FacebookMediaGridProps> = ({ images, onPressImage }) => {
  if (!images || images.length === 0) return null;

  const count = images.length;

  // Case 1: Single image
  if (count === 1) {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPressImage && onPressImage(0)}
        style={styles.singleContainer}
      >
        <Image source={{ uri: images[0] }} style={styles.singleImage} resizeMode="cover" />
      </TouchableOpacity>
    );
  }

  // Case 2: 2 images side-by-side
  if (count === 2) {
    return (
      <View style={styles.gridRow}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onPressImage && onPressImage(0)}
          style={styles.halfWidth}
        >
          <Image source={{ uri: images[0] }} style={styles.fullSize} resizeMode="cover" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onPressImage && onPressImage(1)}
          style={styles.halfWidth}
        >
          <Image source={{ uri: images[1] }} style={styles.fullSize} resizeMode="cover" />
        </TouchableOpacity>
      </View>
    );
  }

  // Case 3: 3 images (1 big left, 2 right stacked)
  if (count === 3) {
    return (
      <View style={styles.gridRow}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onPressImage && onPressImage(0)}
          style={styles.halfWidth}
        >
          <Image source={{ uri: images[0] }} style={styles.fullSize} resizeMode="cover" />
        </TouchableOpacity>

        <View style={styles.halfWidthColumn}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onPressImage && onPressImage(1)}
            style={styles.halfHeight}
          >
            <Image source={{ uri: images[1] }} style={styles.fullSize} resizeMode="cover" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onPressImage && onPressImage(2)}
            style={styles.halfHeight}
          >
            <Image source={{ uri: images[2] }} style={styles.fullSize} resizeMode="cover" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Case 4: 4+ images (2x2 grid with +N overlay on 4th cell)
  const remainingCount = count - 4;

  return (
    <View style={styles.quadGridContainer}>
      <View style={styles.gridRowHalf}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onPressImage && onPressImage(0)}
          style={styles.halfWidth}
        >
          <Image source={{ uri: images[0] }} style={styles.fullSize} resizeMode="cover" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onPressImage && onPressImage(1)}
          style={styles.halfWidth}
        >
          <Image source={{ uri: images[1] }} style={styles.fullSize} resizeMode="cover" />
        </TouchableOpacity>
      </View>

      <View style={styles.gridRowHalf}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onPressImage && onPressImage(2)}
          style={styles.halfWidth}
        >
          <Image source={{ uri: images[2] }} style={styles.fullSize} resizeMode="cover" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onPressImage && onPressImage(3)}
          style={styles.halfWidth}
        >
          <Image source={{ uri: images[3] }} style={styles.fullSize} resizeMode="cover" />
          {remainingCount > 0 && (
            <View style={styles.overlay}>
              <Text style={styles.overlayText}>+{remainingCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  singleContainer: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  singleImage: {
    width: '100%',
    height: '100%',
  },
  gridRow: {
    width: '100%',
    height: 220,
    flexDirection: 'row',
    gap: 4,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  quadGridContainer: {
    width: '100%',
    height: 240,
    gap: 4,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  gridRowHalf: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  halfWidth: {
    flex: 1,
    height: '100%',
    position: 'relative',
  },
  halfWidthColumn: {
    flex: 1,
    height: '100%',
    gap: 4,
  },
  halfHeight: {
    flex: 1,
    width: '100%',
  },
  fullSize: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
});
