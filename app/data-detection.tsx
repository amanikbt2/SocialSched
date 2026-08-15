import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Shield, ArrowLeft, Mail, Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function DataDetectionScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backButton}
        activeOpacity={0.8}
      >
        <ArrowLeft size={16} color="#4F46E5" />
        <Text style={styles.backText}>Back to App</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Search size={40} color="#4F46E5" />
        <Text style={styles.title}>Data Detection Policy & Instructions</Text>
        <Text style={styles.subtitle}>How SocialSched detects and processes post parameters locally</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Introduction</Text>
        <Text style={styles.paragraph}>
          SocialSched ("the App") is a local, client-side social media scheduler utility. To ensure smooth scheduling and publishing of social media posts, the App uses real-time client-side detection algorithms. This policy outlines how the App detects, processes, and handles post attributes, media types, and token statuses.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Local Data Detection Mechanism</Text>
        <Text style={styles.paragraph}>
          All data detection happens locally in real-time inside the App sandbox. No details are harvested, tracked, or sent to external servers.
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>
            • <Text style={styles.bold}>Token Validity Detection:</Text> The App automatically sends minor asynchronous checks directly to Meta's APIs when opening the Settings drawer to detect whether linked page access tokens are "Active" or "Expired" so users can maintain connection integrity.
          </Text>
          <Text style={styles.bulletItem}>
            • <Text style={styles.bold}>Text Attribute Parsing:</Text> When you compose captions or comments, the editor detects `#hashtags` and `@mentions` to help suggest category tag presets and prevent invalid handles.
          </Text>
          <Text style={styles.bulletItem}>
            • <Text style={styles.bold}>Media Compatibility Scan:</Text> When attaching files to a Loop Container or individual post, the App detects resolution, file extension (.mp4, .jpeg, etc.), and file size to alert you if the file exceeds Facebook API specifications.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. User Privacy and Security</Text>
        <Text style={styles.paragraph}>
          We value data minimization. The App does not run middle-man analytics or database tracking instances:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>
            • Detected data parameters exist temporarily in local memory or inside the secure local database on your device (AsyncStorage/SQLite).
          </Text>
          <Text style={styles.bulletItem}>
            • No automated profiling or classification is performed on the content you write or upload.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have questions or feedback regarding our local data detection processes, please contact us:
        </Text>
        <View style={styles.contactRow}>
          <Mail size={16} color="#6B7280" />
          <Text style={styles.contactText}>amanikbt1@gmail.com</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 24,
    paddingTop: 40,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletList: {
    marginTop: 10,
    paddingLeft: 8,
    gap: 8,
    marginBottom: 12,
  },
  bulletItem: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#475569',
  },
});
