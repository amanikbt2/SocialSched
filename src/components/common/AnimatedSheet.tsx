import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableWithoutFeedback, TouchableOpacity } from 'react-native';
import { useThemeStore } from '../../stores/useThemeStore';
import { X } from 'lucide-react-native';

interface AnimatedSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  fullScreen?: boolean;
  children: React.ReactNode;
}

export const AnimatedSheet: React.FC<AnimatedSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  fullScreen = false,
  children,
}) => {
  const colors = useThemeStore((state) => state.colors);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlayContainer}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.sheetContainer,
            fullScreen ? styles.fullScreenContainer : null,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.handleBar} />
          
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
              ) : null}
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={[styles.closeBtn, { backgroundColor: colors.surfaceVariant }]}>
                <X size={18} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.content, fullScreen ? { flex: 1 } : { flexShrink: 1 }]}>
            {children}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: '85%',
    width: '100%',
  },
  fullScreenContainer: {
    flex: 1,
    height: '100%',
    maxHeight: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 40,
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(156, 163, 175, 0.4)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    minHeight: 0,
  },
});
