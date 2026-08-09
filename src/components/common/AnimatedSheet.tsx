import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableWithoutFeedback, Animated } from 'react-native';
import { useThemeStore } from '../../stores/useThemeStore';
import { X } from 'lucide-react-native';

interface AnimatedSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const AnimatedSheet: React.FC<AnimatedSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
}) => {
  const colors = useThemeStore((state) => state.colors);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={[styles.sheetContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.handleBar} />
        
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
          </View>

          <TouchableWithoutFeedback onPress={onClose}>
            <View style={[styles.closeBtn, { backgroundColor: colors.surfaceVariant }]}>
              <X size={18} color={colors.textSecondary} />
            </View>
          </TouchableWithoutFeedback>
        </View>

        <View style={styles.content}>{children}</View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: '90%',
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
    paddingBottom: 20,
  },
});
