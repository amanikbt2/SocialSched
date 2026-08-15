import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { FileText, ArrowLeft, Mail } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function TermsOfServiceScreen() {
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
        <FileText size={40} color="#4F46E5" />
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.subtitle}>Last updated: August 15, 2026</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Agreement to Terms</Text>
        <Text style={styles.paragraph}>
          By accessing or using SocialSched, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our application.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Use of Service & Social Media Platforms</Text>
        <Text style={styles.paragraph}>
          SocialSched enables you to schedule and publish content directly to social media networks (including Facebook and Instagram) using official Meta Graph APIs. You agree to comply with all community standards, platform policies, and terms of service of the third-party platforms you connect.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. User Content & Responsibilities</Text>
        <Text style={styles.paragraph}>
          You retain full ownership of all captions, media, photos, and videos you schedule or publish using SocialSched. You are solely responsible for ensuring your content does not violate copyright, trademark, privacy, or any applicable laws.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Disclaimer of Warranties</Text>
        <Text style={styles.paragraph}>
          SocialSched is provided on an "AS IS" and "AS AVAILABLE" basis. While we strive to maintain uninterrupted service, we do not guarantee uninterrupted operation or that third-party social media APIs will remain unchanged.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>5. Contact Information</Text>
        <Text style={styles.paragraph}>
          If you have any questions regarding these Terms of Service, please reach out to us:
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
