import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const HIDDEN_MEDIA_DIR = `${FileSystem.documentDirectory}smartflow_media/`;

// Simple check to detect if we are running in Electron desktop shell
const getElectronAPI = () => {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return (window as any).electronAPI;
  }
  return null;
};

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
  if (!sourceUri) return sourceUri;

  // Windows Desktop .exe (Electron) support
  const electronAPI = getElectronAPI();
  if (Platform.OS === 'web' && electronAPI) {
    return await electronAPI.saveMediaFile(sourceUri);
  }

  // Web Browser / Remote URLs support
  if (Platform.OS === 'web' || sourceUri.startsWith('http') || sourceUri.startsWith('data:')) {
    return sourceUri;
  }

  try {
    const dir = await ensureHiddenDirExists();
    if (!dir) return sourceUri;

    // Check if sourceUri is already inside our hidden folder
    if (sourceUri.includes('smartflow_media')) {
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

/**
 * Assigns a specific file as Start or End media in local storage.
 * Renames local file to start_<containerId>.<ext> or end_<containerId>.<ext>.
 * Restores previous file to its original filename if replaced.
 */
export async function assignNamedMediaFile(
  sourceUri: string,
  targetType: 'start' | 'end',
  containerId: string,
  previousNamedUri?: string | null,
  previousOriginalUri?: string | null
): Promise<{ namedUri: string; originalUri: string }> {
  if (Platform.OS === 'web' || !sourceUri || sourceUri.startsWith('http')) {
    return { namedUri: sourceUri, originalUri: sourceUri };
  }

  try {
    const dir = await ensureHiddenDirExists();
    if (!dir) return { namedUri: sourceUri, originalUri: sourceUri };

    // 1. Restore previous file if it existed
    if (previousNamedUri && previousOriginalUri && previousNamedUri !== previousOriginalUri) {
      await restoreOriginalMediaFile(previousNamedUri, previousOriginalUri);
    }

    // 2. Ensure sourceUri is saved in local hidden folder first
    let localSourceUri = sourceUri;
    if (!sourceUri.includes('smartflow_media')) {
      localSourceUri = await saveMediaToHiddenFolder(sourceUri);
    }

    // 3. Create the named destination URI e.g. start_c123.jpg or end_c123.jpg
    const ext = localSourceUri.split('.').pop()?.split('?')[0] || 'jpg';
    const namedFilename = `${targetType}_${containerId || 'default'}.${ext}`;
    const destinationNamedUri = dir + namedFilename;

    if (localSourceUri !== destinationNamedUri) {
      const targetExists = await FileSystem.getInfoAsync(destinationNamedUri);
      if (targetExists.exists) {
        await FileSystem.deleteAsync(destinationNamedUri, { idempotent: true });
      }
      await FileSystem.copyAsync({
        from: localSourceUri,
        to: destinationNamedUri,
      });
    }

    console.log(`🏷️ Assigned ${targetType.toUpperCase()} media to: ${destinationNamedUri} (Original: ${localSourceUri})`);
    return { namedUri: destinationNamedUri, originalUri: localSourceUri };
  } catch (err) {
    console.warn(`Failed to assign ${targetType} media:`, err);
    return { namedUri: sourceUri, originalUri: sourceUri };
  }
}

/**
 * Restores a named media file (e.g. start_c123.jpg) back to its original filename.
 */
export async function restoreOriginalMediaFile(
  namedUri: string,
  originalUri: string
): Promise<string> {
  if (Platform.OS === 'web' || !namedUri || !originalUri || namedUri === originalUri || namedUri.startsWith('http')) {
    return originalUri;
  }

  try {
    const namedInfo = await FileSystem.getInfoAsync(namedUri);
    if (namedInfo.exists) {
      const origInfo = await FileSystem.getInfoAsync(originalUri);
      if (!origInfo.exists) {
        await FileSystem.moveAsync({
          from: namedUri,
          to: originalUri,
        });
        console.log(`🔄 Restored ${namedUri} back to original filename: ${originalUri}`);
      } else {
        await FileSystem.deleteAsync(namedUri, { idempotent: true });
      }
    }
    return originalUri;
  } catch (err) {
    console.warn('Failed to restore original media filename:', err);
    return originalUri;
  }
}

/**
 * Calculates the total size (in bytes) and file count of the hidden media folder.
 */
export async function getHiddenMediaStorageInfo(): Promise<{ sizeBytes: number; fileCount: number }> {
  // Windows Desktop .exe (Electron) support
  const electronAPI = getElectronAPI();
  if (Platform.OS === 'web' && electronAPI) {
    return await electronAPI.getStorageStats();
  }

  if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
    return { sizeBytes: 0, fileCount: 0 };
  }
  try {
    const dirInfo = await FileSystem.getInfoAsync(HIDDEN_MEDIA_DIR);
    if (!dirInfo.exists) {
      return { sizeBytes: 0, fileCount: 0 };
    }
    const files = await FileSystem.readDirectoryAsync(HIDDEN_MEDIA_DIR);
    let sizeBytes = 0;
    for (const filename of files) {
      const fileUri = HIDDEN_MEDIA_DIR + filename;
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists && !fileInfo.isDirectory) {
        sizeBytes += fileInfo.size;
      }
    }
    return { sizeBytes, fileCount: files.length };
  } catch (error) {
    console.warn('Error reading hidden media storage size:', error);
    return { sizeBytes: 0, fileCount: 0 };
  }
}

/**
 * Deletes all files in the hidden media folder.
 */
export async function clearHiddenMediaStorage(): Promise<boolean> {
  // Windows Desktop .exe (Electron) support
  const electronAPI = getElectronAPI();
  if (Platform.OS === 'web' && electronAPI) {
    return await electronAPI.clearStorage();
  }

  if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
    return true;
  }
  try {
    const dirInfo = await FileSystem.getInfoAsync(HIDDEN_MEDIA_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(HIDDEN_MEDIA_DIR, { idempotent: true });
    }
    await FileSystem.makeDirectoryAsync(HIDDEN_MEDIA_DIR, { intermediates: true });
    return true;
  } catch (error) {
    console.warn('Error clearing hidden media storage:', error);
    return false;
  }
}
