import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Header } from '../../src/components/common/Header';
import { QueueProgressCard } from '../../src/components/queue/QueueProgressCard';
import { FAB } from '../../src/components/common/FAB';
import { Card } from '../../src/components/common/Card';
import { useThemeStore } from '../../src/stores/useThemeStore';
import { useCampaignStore } from '../../src/stores/useCampaignStore';
import { useQueueStore } from '../../src/stores/useQueueStore';
import { PostStatus } from '../../src/db/types';
import { Play, Pause, RefreshCw, Layers, CheckCircle2 } from 'lucide-react-native';

export default function QueueScreen() {
  const colors = useThemeStore((state) => state.colors);
  const { posts, updatePost, loadData } = useCampaignStore();
  const { engineState, setEngineState, activePostId, networkStatus, pausedReason } = useQueueStore();

  const [activeTab, setActiveTab] = useState<PostStatus | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const queuePosts = posts.filter((p) => {
    if (activeTab === 'all') {
      return p.status === 'scheduled' || p.status === 'waiting' || p.status === 'uploading' || p.status === 'paused' || p.status === 'failed' || p.status === 'missed';
    }
    return p.status === activeTab;
  });

  const handleToggleEngine = () => {
    if (engineState === 'paused') {
      if (networkStatus === 'offline') {
        Alert.alert(
          'Device is Offline',
          'Queue cannot upload posts while offline. Resume anyway? Uploading will wait for internet connection.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Resume', 
              onPress: () => {
                setEngineState('idle', null);
              } 
            }
          ]
        );
      } else {
        setEngineState('idle', null);
      }
    } else {
      setEngineState('paused', 'user');
    }
  };

  const handleRetryAll = async () => {
    const failedPosts = posts.filter((p) => p.status === 'failed' || p.status === 'missed');
    for (const p of failedPosts) {
      await updatePost(p.id, { status: 'waiting', uploadProgress: 0, failureReason: null });
    }
    setEngineState('processing');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Live Queue" subtitle="Offline-first background upload processor" />

      {/* Control Banner */}
      <View style={styles.controlBanner}>
        <View style={styles.statusGroup}>
          <Layers size={20} color={colors.primary} />
          <View>
            <Text style={[styles.controlTitle, { color: colors.textPrimary }]}>
              Queue Engine: <Text style={{ color: engineState === 'paused' ? (pausedReason === 'network' ? colors.warning : colors.error) : colors.primary }}>
                {engineState === 'paused' ? (pausedReason === 'network' ? 'WAITING FOR NETWORK' : 'PAUSED') : engineState.toUpperCase()}
              </Text>
            </Text>
            <Text style={[styles.controlSub, { color: colors.textSecondary }]}>
              {pausedReason === 'network' 
                ? 'Uploads will resume automatically when online'
                : `${queuePosts.length} items waiting in queue`}
            </Text>
          </View>
        </View>

        <View style={styles.btnGroup}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleRetryAll}
            style={[styles.smallBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
          >
            <RefreshCw size={14} color={colors.textPrimary} />
            <Text style={[styles.btnText, { color: colors.textPrimary }]}>Retry All</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleToggleEngine}
            style={[
              styles.smallBtn,
              { backgroundColor: engineState === 'paused' ? colors.successContainer : colors.warningContainer },
            ]}
          >
            {engineState === 'paused' ? (
              <>
                <Play size={14} color={colors.success} />
                <Text style={[styles.btnText, { color: colors.success }]}>Resume</Text>
              </>
            ) : (
              <>
                <Pause size={14} color={colors.warning} />
                <Text style={[styles.btnText, { color: colors.warning }]}>Pause</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Queue Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {(['all', 'uploading', 'waiting', 'paused', 'failed', 'missed'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            activeOpacity={0.8}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tabChip,
              {
                backgroundColor: activeTab === tab ? colors.primaryContainer : colors.surface,
                borderColor: activeTab === tab ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? colors.primary : colors.textSecondary },
              ]}
            >
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Queue Items List */}
      <ScrollView
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {queuePosts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <CheckCircle2 size={32} color={colors.success} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Queue is clean!</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              All scheduled posts have been published or processed.
            </Text>
          </Card>
        ) : (
          queuePosts.map((post) => (
            <QueueProgressCard key={post.id} post={post} isActive={post.id === activePostId} />
          ))
        )}
      </ScrollView>

      <FAB label="Add to Queue" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  controlBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  controlTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  controlSub: {
    fontSize: 11,
    marginTop: 2,
  },
  btnGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  btnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tabRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '800',
  },
  listContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
