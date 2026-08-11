import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const HIDDEN_MEDIA_DIR = `${FileSystem.documentDirectory}.socialsched_media/`;

/**
 * Ensures the app's hidden local media directory exists.
 */
async function ensureHiddenDirExists(): Promise<string> {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return '';
  try {
    const dirInfo = await FileSystem.getInfoAsync(HIDDEN_MEDIA_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(HIDDEN_MEDIA_DIR, { intermediates: true });
    }
    return HIDDEN_MEDIA_DIR;
  } catch (err) {
    console.warn('Error creating hidden media dir:', err);
    return '';
  }
}

/**
 * Copies a picked URI to the app's local hidden folder for permanent offline & refresh resistance.
 * Web URIs and remote http/https URLs are preserved as is.
 */
export async function saveMediaToHiddenFolder(sourceUri: string): Promise<string> {
  if (Platform.OS === 'web' || !sourceUri || sourceUri.startsWith('http')) {
    return sourceUri;
  }

  try {
    const dir = await ensureHiddenDirExists();
    if (!dir) return sourceUri;

    // Check if sourceUri is already inside our hidden folder
    if (sourceUri.includes('.socialsched_media')) {
      return sourceUri;
    }

    const ext = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
    const filename = `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const destinationUri = dir + filename;

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationUri,
    });

    console.log(`💾 Saved media to app hidden folder: ${destinationUri}`);
    return destinationUri;
  } catch (error) {
    console.warn('Failed to copy media to hidden folder, keeping source URI:', error);
    return sourceUri;
  }
}

/**
 * Saves an array of picked URIs to the hidden local directory.
 */
export async function saveMultipleMediaToHiddenFolder(uris: string[]): Promise<string[]> {
  const saved: string[] = [];
  for (const u of uris) {
    const localUri = await saveMediaToHiddenFolder(u);
    saved.push(localUri);
  }
  return saved;
}
