import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Header } from '../../src/components/common/Header';
import { CalendarView } from '../../src/components/calendar/CalendarView';
import { FAB } from '../../src/components/common/FAB';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { useCampaignStore } from '../../src/stores/useCampaignStore';
import { statusColors } from '../../src/theme/colors';

export default function ScheduleScreen() {
  const colors = useThemeStore((state) => state.colors);
  const posts = useCampaignStore((state) => state.posts);

  const [activeFilter, setActiveFilter] = useState<'all' | 'facebook' | 'instagram' | 'tiktok'>('all');

  const filteredPosts = posts.filter((p) => {
    if (activeFilter === 'all') return true;
    return p.platforms.includes(activeFilter);
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Schedule" subtitle="Interactive calendar & post timeline" />

      <View style={styles.content}>
        {/* Legend Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legendRow}>
          {Object.entries(statusColors).map(([statusKey, conf]) => (
            <View key={statusKey} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: conf.main }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                {statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Platform filter tabs */}
        <View style={styles.filterRow}>
          {(['all', 'facebook', 'instagram', 'tiktok'] as const).map((plat) => (
            <TouchableOpacity
              key={plat}
              activeOpacity={0.8}
              onPress={() => setActiveFilter(plat)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeFilter === plat ? colors.primaryContainer : colors.surface,
                  borderColor: activeFilter === plat ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: activeFilter === plat ? colors.primary : colors.textSecondary },
                ]}
              >
                {plat.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <CalendarView posts={filteredPosts} />
      </View>

      <FAB label="Schedule Post" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 14,
    paddingBottom: 10,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
