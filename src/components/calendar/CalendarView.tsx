import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Post } from '../../db/types';
import { useThemeStore } from '../../stores/useThemeStore';
import { statusColors } from '../../theme/colors';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react-native';
import { format, addDays, startOfWeek, addMonths, subMonths, isSameDay } from 'date-fns';
import { useRouter } from 'expo-router';

interface CalendarViewProps {
  posts: Post[];
}

type ViewMode = 'month' | 'week' | 'day';

export const CalendarView: React.FC<CalendarViewProps> = ({ posts }) => {
  const colors = useThemeStore((state) => state.colors);
  const router = useRouter();

  const [mode, setMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const handlePrev = () => {
    if (mode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (mode === 'week') setCurrentDate(addDays(currentDate, -7));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const handleNext = () => {
    if (mode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (mode === 'week') setCurrentDate(addDays(currentDate, 7));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const renderViewModeSelector = () => (
    <View style={[styles.modeBar, { backgroundColor: colors.surfaceVariant }]}>
      {(['month', 'week', 'day'] as ViewMode[]).map((m) => (
        <TouchableOpacity
          key={m}
          activeOpacity={0.8}
          onPress={() => setMode(m)}
          style={[
            styles.modeChip,
            mode === m && { backgroundColor: colors.surface, shadowColor: colors.cardShadow },
          ]}
        >
          <Text
            style={[
              styles.modeText,
              { color: mode === m ? colors.primary : colors.textSecondary },
            ]}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderDaysList = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: mode === 'week' ? 7 : 1 }, (_, i) => addDays(weekStart, i));

    return (
      <View style={styles.timelineContainer}>
        {days.map((day) => {
          const dayPosts = posts.filter((p) => isSameDay(new Date(p.scheduledAt), day));
          const isToday = isSameDay(day, new Date());

          return (
            <View
              key={day.toISOString()}
              style={[
                styles.dayColumn,
                {
                  backgroundColor: colors.surface,
                  borderColor: isToday ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={styles.dayHeader}>
                <Text style={[styles.dayName, { color: colors.textSecondary }]}>
                  {format(day, 'EEE')}
                </Text>
                <Text
                  style={[
                    styles.dayNum,
                    { color: isToday ? colors.primary : colors.textPrimary },
                  ]}
                >
                  {format(day, 'd')}
                </Text>
              </View>

              <View style={styles.postsList}>
                {dayPosts.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No posts</Text>
                ) : (
                  dayPosts.map((post) => {
                    const statusConf = statusColors[post.status] || statusColors.draft;
                    return (
                      <TouchableOpacity
                        key={post.id}
                        activeOpacity={0.85}
                        onPress={() => router.push(`/post-detail/${post.id}`)}
                        style={[
                          styles.postBlock,
                          {
                            backgroundColor: statusConf.bg,
                            borderLeftColor: statusConf.main,
                          },
                        ]}
                      >
                        <Text style={[styles.postTime, { color: statusConf.text }]}>
                          {format(new Date(post.scheduledAt), 'h:mm a')}
                        </Text>
                        <Text
                          style={[styles.postCaption, { color: colors.textPrimary }]}
                          numberOfLines={2}
                        >
                          {post.caption}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Calendar Top Control Header */}
      <View style={styles.topControl}>
        <View style={styles.navRow}>
          <TouchableOpacity activeOpacity={0.8} onPress={handlePrev} style={styles.iconBtn}>
            <ChevronLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.dateTitle, { color: colors.textPrimary }]}>
            {format(currentDate, 'MMMM yyyy')}
          </Text>
          <TouchableOpacity activeOpacity={0.8} onPress={handleNext} style={styles.iconBtn}>
            <ChevronRight size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {renderViewModeSelector()}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>{renderDaysList()}</ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topControl: {
    marginBottom: 14,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  iconBtn: {
    padding: 6,
  },
  modeBar: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 3,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 12,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  timelineContainer: {
    gap: 10,
    paddingBottom: 40,
  },
  dayColumn: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 8,
    marginBottom: 10,
  },
  dayName: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dayNum: {
    fontSize: 18,
    fontWeight: '800',
  },
  postsList: {
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  postBlock: {
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 10,
  },
  postTime: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  postCaption: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
});
