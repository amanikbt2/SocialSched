import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Shield, ArrowLeft, Mail } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function PrivacyPolicyScreen() {
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
        <Shield size={40} color="#4F46E5" />
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.subtitle}>Last updated: August 15, 2026</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Introduction</Text>
        <Text style={styles.paragraph}>
          Welcome to SocialSched ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data. This privacy policy explains how our application processes, stores, and handles your information when you connect your Facebook and Instagram accounts.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Information We Collect & How We Use It</Text>
        <Text style={styles.paragraph}>
          Our application operates as a client-side scheduling utility. We do not run middle-man database servers to collect or store your personal social media credentials.
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>
            • <Text style={styles.bold}>Access Tokens:</Text> When you authenticate via Facebook Login, the app receives standard access tokens. These tokens are saved locally on your device using secure local storage (AsyncStorage) and are sent directly to Facebook's Graph API endpoints to schedule or publish your posts.
          </Text>
          <Text style={styles.bulletItem}>
            • <Text style={styles.bold}>Media Files:</Text> Media library photos or videos you upload to schedule posts are stored locally on your device's hidden app directory and are never uploaded to any third-party storage other than Meta's servers when publishing.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Data Deletion & Revocation</Text>
        <Text style={styles.paragraph}>
          Because all your data is stored locally on your own device, you have complete control over its deletion:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>
            • You can clear all cached accounts, tokens, and media from within the app settings by clicking "Clear App Storage".
          </Text>
          <Text style={styles.bulletItem}>
            • You can revoke the app's permissions at any time through your Facebook Account settings under "Settings & Privacy" - "Settings" - "Business Integrations".
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have any questions or feedback regarding this privacy policy, please contact us:
        </Text>
        <View style={styles.contactRow}>
          <Mail size={16} color="#6B7280" />
          <Text style={styles.contactText}>support@socialsched.local</Text>
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
  bulletList: {
    marginTop: 10,
    paddingLeft: 8,
    gap: 8,
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
