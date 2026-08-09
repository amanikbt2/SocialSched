import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemeStore } from '../../stores/useThemeStore';
import { useQueueStore } from '../../stores/useQueueStore';
import { useCampaignStore } from '../../stores/useCampaignStore';
import { Wifi, WifiOff, AlertTriangle, AlertCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showStatus?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title = 'SyncFlow', subtitle, showStatus = true }) => {
  const colors = useThemeStore((state) => state.colors);
  const { networkStatus, setNetworkStatus } = useQueueStore();
  const posts = useCampaignStore((state) => state.posts);
  const router = useRouter();

  const failedCount = posts.filter((p) => p.status === 'failed' || p.status === 'missed').length;

  const toggleNetwork = () => {
    if (networkStatus === 'online') setNetworkStatus('flaky');
    else if (networkStatus === 'flaky') setNetworkStatus('offline');
    else setNetworkStatus('online');
  };

  const renderNetIcon = () => {
    switch (networkStatus) {
      case 'online':
        return <Wifi size={16} color={colors.success} />;
      case 'flaky':
        return <AlertTriangle size={16} color={colors.warning} />;
      case 'offline':
        return <WifiOff size={16} color={colors.danger} />;
    }
  };

  return (
    <View style={[styles.header, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={styles.titleContainer}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>

      {showStatus && (
        <View style={styles.rightActions}>
          {failedCount > 0 && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/missed-failed')}
              style={[styles.alertBadge, { backgroundColor: colors.dangerContainer }]}
            >
              <AlertCircle size={14} color={colors.danger} />
              <Text style={[styles.alertText, { color: colors.danger }]}>{failedCount}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={toggleNetwork}
            style={[
              styles.netChip,
              {
                backgroundColor: colors.surfaceVariant,
                borderColor: colors.border,
              },
            ]}
          >
            {renderNetIcon()}
            <Text
              style={[
                styles.netText,
                {
                  color:
                    networkStatus === 'online'
                      ? colors.success
                      : networkStatus === 'flaky'
                      ? colors.warning
                      : colors.danger,
                },
              ]}
            >
              {networkStatus.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  alertText: {
    fontSize: 12,
    fontWeight: '700',
  },
  netChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  netText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
