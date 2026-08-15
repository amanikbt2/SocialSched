import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Trash2, ArrowLeft, Mail, ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function DataDeletionScreen() {
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
        <Trash2 size={40} color="#EF4444" />
        <Text style={styles.title}>User Data Deletion Instructions</Text>
        <Text style={styles.subtitle}>Meta Platform Compliance & User Privacy</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. How SocialSched Handles Data</Text>
        <Text style={styles.paragraph}>
          SocialSched is designed with a privacy-first, client-side architecture. We do not maintain external database servers or store your personal social media credentials, profile photos, or access tokens on any cloud server owned by us. All data is saved exclusively on your local device.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. How to Delete Your Data</Text>
        <Text style={styles.paragraph}>
          If you wish to remove all data associated with SocialSched, you can do so easily through the following methods:
        </Text>
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Option A: Clear App Storage (Instant)</Text>
          <Text style={styles.cardText}>
            1. Open the SocialSched app on your device.{"\n"}
            2. Go to <Text style={styles.bold}>Settings</Text>.{"\n"}
            3. Under <Text style={styles.bold}>Storage Management</Text>, click <Text style={styles.bold}>"Wipe & Clear Storage"</Text>.{"\n"}
            This immediately deletes all saved access tokens, cached accounts, scheduled posts, and local media files from your device.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Option B: Revoke Facebook App Permissions</Text>
          <Text style={styles.cardText}>
            1. Log in to your Facebook Account.{"\n"}
            2. Go to <Text style={styles.bold}>Settings & Privacy</Text> → <Text style={styles.bold}>Settings</Text>.{"\n"}
            3. Click on <Text style={styles.bold}>Business Integrations</Text> (or Apps and Websites).{"\n"}
            4. Find <Text style={styles.bold}>SocialSched</Text> and click <Text style={styles.bold}>Remove</Text>.{"\n"}
            This immediately revokes our access tokens on Meta's servers.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Contact for Deletion Confirmation</Text>
        <Text style={styles.paragraph}>
          If you require formal verification of data deletion or assistance, please email our support contact:
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
    fontSize: 26,
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
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  cardText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
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
