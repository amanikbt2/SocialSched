import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert } from 'react-native';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { useCampaignStore } from '../../src/stores/useCampaignStore';
import { generateMagicSchedule, DistributePreviewItem } from '../../src/services/magicDistribute';
import { MagicDistributeConfig } from '../../src/db/types';
import { X, Sparkles, Clock, Calendar, CheckCircle2, Sliders, AlertCircle } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function MagicDistributeScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId: string }>();
  const colors = useThemeStore((state) => state.colors);
  const { campaigns, posts, updatePost } = useCampaignStore();
  const router = useRouter();

  const campaign = campaigns.find((c) => c.id === campaignId);

  // Configuration State
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(tomorrowStr);
  const [startTime, setStartTime] = useState('09:00');
  const [intervalMins, setIntervalMins] = useState<number>(60);
  const [allowRandom, setAllowRandom] = useState(true);
  const [varianceMin, setVarianceMin] = useState(45);
  const [varianceMax, setVarianceMax] = useState(70);

  const [blackoutStart, setBlackoutStart] = useState('00:00');
  const [blackoutEnd, setBlackoutEnd] = useState('06:00');

  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon - Fri
  const [skipWeekends, setSkipWeekends] = useState(true);
  const [maxPostsPerDay, setMaxPostsPerDay] = useState(3);

  const [previewList, setPreviewList] = useState<DistributePreviewItem[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  const dayLabels = [
    { num: 1, name: 'Mon' },
    { num: 2, name: 'Tue' },
    { num: 3, name: 'Wed' },
    { num: 4, name: 'Thu' },
    { num: 5, name: 'Fri' },
    { num: 6, name: 'Sat' },
    { num: 0, name: 'Sun' },
  ];

  const toggleDay = (dayNum: number) => {
    if (selectedDays.includes(dayNum)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayNum));
    } else {
      setSelectedDays([...selectedDays, dayNum]);
    }
  };

  const handleGeneratePreview = () => {
    const config: MagicDistributeConfig = {
      campaignId: campaignId || '',
      startDate,
      startTime,
      intervalMinutes: intervalMins,
      allowRandomVariance: allowRandom,
      varianceMin,
      varianceMax,
      blackoutStart,
      blackoutEnd,
      selectedDays,
      skipWeekends,
      maxPostsPerDay,
    };

    const results = generateMagicSchedule(posts, config);
    setPreviewList(results);
    setHasGenerated(true);
  };

  const handleApplySchedule = async () => {
    if (previewList.length === 0) return;

    for (const item of previewList) {
      await updatePost(item.postId, {
        scheduledAt: item.newScheduledAt,
        status: 'scheduled',
      });
    }

    Alert.alert(
      '✨ Schedule Applied!',
      `Successfully generated and scheduled ${previewList.length} posts into your queue.`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header Bar */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.back()} style={styles.closeBtn}>
          <X size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>✨ Magic Distribute</Text>
          <Text style={[styles.headerSub, { color: colors.primary }]}>{campaign?.title || 'Campaign'}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Start Date & Time */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Start Date & Time</Text>
        <View style={styles.rowTwo}>
          <View style={[styles.inputBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Calendar size={16} color={colors.primary} />
            <TextInput
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={startDate}
              onChangeText={setStartDate}
              style={[styles.fieldInput, { color: colors.textPrimary }]}
            />
          </View>

          <View style={[styles.inputBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Clock size={16} color={colors.primary} />
            <TextInput
              placeholder="HH:MM"
              placeholderTextColor={colors.textMuted}
              value={startTime}
              onChangeText={setStartTime}
              style={[styles.fieldInput, { color: colors.textPrimary }]}
            />
          </View>
        </View>

        {/* Posting Interval Picker */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Posting Interval</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.intervalRow}>
          {[
            { label: '15m', val: 15 },
            { label: '30m', val: 30 },
            { label: '45m', val: 45 },
            { label: '1 hour', val: 60 },
            { label: '2 hours', val: 120 },
            { label: 'Daily', val: 1440 },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              activeOpacity={0.8}
              onPress={() => setIntervalMins(item.val)}
              style={[
                styles.intervalChip,
                {
                  backgroundColor: intervalMins === item.val ? colors.primaryContainer : colors.surface,
                  borderColor: intervalMins === item.val ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.intervalText,
                  { color: intervalMins === item.val ? colors.primary : colors.textSecondary },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Random Interval Variance */}
        <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>Random Interval Variance</Text>
            <Text style={[styles.switchSub, { color: colors.textSecondary }]}>
              Post every 45–70 mins instead of exact intervals to sound human.
            </Text>
          </View>
          <Switch
            value={allowRandom}
            onValueChange={setAllowRandom}
            trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
          />
        </View>

        {/* Blackout Hours */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Blackout Hours (Do Not Schedule)</Text>
        <View style={styles.rowTwo}>
          <View style={[styles.inputBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.prefix, { color: colors.textMuted }]}>From</Text>
            <TextInput
              placeholder="00:00"
              placeholderTextColor={colors.textMuted}
              value={blackoutStart}
              onChangeText={setBlackoutStart}
              style={[styles.fieldInput, { color: colors.textPrimary }]}
            />
          </View>

          <View style={[styles.inputBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.prefix, { color: colors.textMuted }]}>Until</Text>
            <TextInput
              placeholder="06:00"
              placeholderTextColor={colors.textMuted}
              value={blackoutEnd}
              onChangeText={setBlackoutEnd}
              style={[styles.fieldInput, { color: colors.textPrimary }]}
            />
          </View>
        </View>

        {/* Allowed Days */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Allowed Posting Days</Text>
        <View style={styles.daysRow}>
          {dayLabels.map((d) => {
            const isSel = selectedDays.includes(d.num);
            return (
              <TouchableOpacity
                key={d.num}
                activeOpacity={0.8}
                onPress={() => toggleDay(d.num)}
                style={[
                  styles.dayCircle,
                  {
                    backgroundColor: isSel ? colors.primary : colors.surface,
                    borderColor: isSel ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.dayText, { color: isSel ? '#FFFFFF' : colors.textSecondary }]}>
                  {d.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Max Posts Per Day */}
        <View style={styles.rowTwo}>
          <Text style={[styles.label, { color: colors.textSecondary, flex: 1 }]}>Max Posts Per Day</Text>
          <TextInput
            placeholder="3"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            value={String(maxPostsPerDay)}
            onChangeText={(val) => setMaxPostsPerDay(Number(val) || 0)}
            style={[styles.numInput, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
          />
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleGeneratePreview}
          style={[styles.genBtn, { backgroundColor: colors.primaryContainer, borderColor: colors.primary }]}
        >
          <Sparkles size={18} color={colors.primary} />
          <Text style={[styles.genBtnText, { color: colors.primary }]}>Generate Complete Schedule Preview</Text>
        </TouchableOpacity>

        {/* Generated Schedule Preview Section */}
        {hasGenerated && (
          <View style={styles.previewSection}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              Schedule Preview ({previewList.length} Posts)
            </Text>

            {previewList.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: colors.warningContainer }]}>
                <AlertCircle size={18} color={colors.warning} />
                <Text style={[styles.emptyText, { color: colors.warning }]}>
                  No draft posts found in this campaign to schedule.
                </Text>
              </View>
            ) : (
              previewList.map((item, idx) => (
                <View
                  key={idx}
                  style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.prevTimeGroup}>
                    <Text style={[styles.prevDay, { color: colors.primary }]}>{item.dayName}</Text>
                    <Text style={[styles.prevTime, { color: colors.textPrimary }]}>{item.formattedTime}</Text>
                  </View>
                  <Text style={[styles.prevCaption, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.postCaption}
                  </Text>
                </View>
              ))
            )}

            {previewList.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleApplySchedule}
                style={[styles.applyBtn, { backgroundColor: colors.primary }]}
              >
                <CheckCircle2 size={20} color="#FFFFFF" />
                <Text style={styles.applyBtnText}>Apply Schedule to Queue</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  content: {
    padding: 20,
    gap: 12,
    paddingBottom: 60,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  rowTwo: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  fieldInput: {
    flex: 1,
    height: 42,
    fontSize: 13,
    fontWeight: '600',
  },
  prefix: {
    fontSize: 11,
    fontWeight: '600',
  },
  intervalRow: {
    gap: 8,
  },
  intervalChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  intervalText: {
    fontSize: 12,
    fontWeight: '800',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 6,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  switchSub: {
    fontSize: 11,
    marginTop: 2,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 11,
    fontWeight: '800',
  },
  numInput: {
    width: 60,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    textAlign: 'center',
    fontWeight: '800',
  },
  genBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 8,
    marginTop: 10,
  },
  genBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  previewSection: {
    marginTop: 16,
    gap: 8,
  },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  prevTimeGroup: {
    width: 100,
  },
  prevDay: {
    fontSize: 11,
    fontWeight: '800',
  },
  prevTime: {
    fontSize: 12,
    fontWeight: '700',
  },
  prevCaption: {
    flex: 1,
    fontSize: 12,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    gap: 8,
    marginTop: 10,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
