import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { AtSign, Users, Sparkles, CheckCircle2 } from 'lucide-react-native';

interface PageSearchResult {
  id: string;
  name: string;
  category?: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
}

interface MentionPickerProps {
  text: string;
  onSelectMention: (updatedText: string) => void;
  accessToken?: string | null;
  colors: any;
  style?: any;
}

const SYSTEM_PRESET_TAGS = [
  { tag: '@followers', label: '@followers', description: 'Notify Page followers' },
  { tag: '@highlight', label: '@highlight', description: 'Highlight update in feed' },
  { tag: '@everyone', label: '@everyone', description: 'Tag all group members' },
];

export function MentionPicker({
  text,
  onSelectMention,
  accessToken,
  colors,
  style,
}: MentionPickerProps) {
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<PageSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Detect if the user is currently typing an @mention at the end or last word of text
  useEffect(() => {
    if (!text) {
      setActiveQuery(null);
      setSearchResults([]);
      return;
    }

    // Match @word at the end of the text string
    const match = text.match(/(@[a-zA-Z0-9_\-\.]*)$/);
    if (match) {
      const fullMentionStr = match[1]; // e.g. "@" or "@nike"
      const searchQuery = fullMentionStr.substring(1).trim(); // "nike"
      setActiveQuery(searchQuery);
    } else {
      setActiveQuery(null);
      setSearchResults([]);
    }
  }, [text]);

  // Search Facebook Pages via Graph API when query is typed
  useEffect(() => {
    if (activeQuery === null || activeQuery.length < 2 || !accessToken) {
      setSearchResults([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const cleanToken = accessToken.replace(/^bearer\s+/i, '').trim();
        const searchUrl = `https://graph.facebook.com/v19.0/pages/search?q=${encodeURIComponent(
          activeQuery
        )}&fields=id,name,category,picture{url}&limit=6&access_token=${encodeURIComponent(
          cleanToken
        )}`;

        const res = await fetch(searchUrl).catch(() => null);
        if (res && res.ok && isMounted) {
          const data = await res.json().catch(() => null);
          if (data && Array.isArray(data.data)) {
            setSearchResults(data.data);
          }
        }
      } catch (e) {
        console.warn('Facebook Page search exception:', e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeQuery, accessToken]);

  if (activeQuery === null) {
    return null;
  }

  const handleApplyTag = (replacementTag: string) => {
    // Replace the trailing @query with the replacementTag
    const updated = text.replace(/(@[a-zA-Z0-9_\-\.]*)$/, replacementTag + ' ');
    onSelectMention(updated);
    setActiveQuery(null);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AtSign size={14} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            TAG MENTIONS & PAGES
          </Text>
        </View>
        <Text style={[styles.hintText, { color: colors.textMuted }]}>
          {activeQuery ? `Searching for "@${activeQuery}"` : 'Type page name or pick system tag'}
        </Text>
      </View>

      {/* System Preset Tag Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {SYSTEM_PRESET_TAGS.map((item) => (
          <TouchableOpacity
            key={item.tag}
            activeOpacity={0.8}
            onPress={() => handleApplyTag(item.tag)}
            style={[
              styles.presetBadge,
              { backgroundColor: colors.primaryContainer, borderColor: colors.primary + '40' },
            ]}
          >
            <Sparkles size={12} color={colors.primary} />
            <Text style={[styles.presetBadgeText, { color: colors.primary }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search Results / Loading Spinner */}
      {isLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 8 }}>
            Searching Facebook Pages...
          </Text>
        </View>
      )}

      {!isLoading && searchResults.length > 0 && (
        <View style={styles.resultsList}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            MATCHING FACEBOOK PAGES (Click to tag):
          </Text>
          {searchResults.map((page) => {
            const avatarUrl = page.picture?.data?.url;
            return (
              <TouchableOpacity
                key={page.id}
                activeOpacity={0.7}
                onPress={() => handleApplyTag(`@[${page.id}]`)}
                style={[
                  styles.pageResultRow,
                  { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
                ]}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.pageAvatar} />
                ) : (
                  <View style={[styles.pageAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
                      {page.name.charAt(0)}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.pageName, { color: colors.textPrimary }]}>{page.name}</Text>
                  <Text style={[styles.pageMeta, { color: colors.textMuted }]}>
                    ID: {page.id} {page.category ? `• ${page.category}` : ''}
                  </Text>
                </View>
                <View style={[styles.tagActionBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.tagActionText}>+ Tag Page</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!isLoading && activeQuery.length >= 2 && searchResults.length === 0 && accessToken && (
        <Text style={[styles.emptySearchText, { color: colors.textMuted }]}>
          No Facebook Pages found for "{activeQuery}". Tap a system tag above or keep typing.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hintText: {
    fontSize: 10,
  },
  presetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 6,
  },
  presetBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  resultsList: {
    marginTop: 6,
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
  },
  pageResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  pageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  pageAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageName: {
    fontSize: 12,
    fontWeight: '700',
  },
  pageMeta: {
    fontSize: 10,
  },
  tagActionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagActionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  emptySearchText: {
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
