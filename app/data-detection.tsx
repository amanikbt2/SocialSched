import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Trash2, ArrowLeft, Mail } from 'lucide-react-native';
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
        <Trash2 size={40} color="#4F46E5" />
        <Text style={styles.title}>Data Deletion Instructions</Text>
        <Text style={styles.subtitle}>How to delete your connected social account data</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Client-Side Local Storage Notice</Text>
        <Text style={styles.paragraph}>
          SocialSched is a client-side social media scheduling utility. We prioritize your privacy. Because the App operates entirely locally on your device (saving credentials, schedules, and media files directly within secure local database files on your hardware), we do not run backend databases to collect or store your personal credentials or social media information.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Deauthorizing and Deleting Connected Meta Data</Text>
        <Text style={styles.paragraph}>
          You can revoke the App's access to your Facebook profile and delete associated credentials at any time by following the official Meta deauthorization flow:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>
            1. Go to your Facebook profile's <Text style={styles.bold}>Settings & Privacy &gt; Settings</Text>.
          </Text>
          <Text style={styles.bulletItem}>
            2. In the left panel, click on <Text style={styles.bold}>Apps and Websites</Text> (or <Text style={styles.bold}>Business Integrations</Text> depending on your account setup).
          </Text>
          <Text style={styles.bulletItem}>
            3. Find <Text style={styles.bold}>SocialSched</Text> (or <Text style={styles.bold}>smartflow</Text>) and click the <Text style={styles.bold}>Remove</Text> button.
          </Text>
          <Text style={styles.bulletItem}>
            4. Confirm the removal to completely revoke the tokens.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Clearing App Cache Locally</Text>
        <Text style={styles.paragraph}>
          To wipe your offline logs, media library, and token caches from your computer or mobile device:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>
            • Open the App's <Text style={styles.bold}>Settings Drawer</Text> (gear/menu icon in the top header) and click <Text style={styles.bold}>Wipe Local Storage</Text> or <Text style={styles.bold}>App Storage Folders</Text>.
          </Text>
          <Text style={styles.bulletItem}>
            • Alternatively, uninstalling the App will completely purge its local storage partition.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Contact Us for Support</Text>
        <Text style={styles.paragraph}>
          If you have questions about local data cleanup, or would like us to verify your deauthorization status, please contact us:
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
