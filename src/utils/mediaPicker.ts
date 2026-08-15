import * as ImagePicker from 'expo-image-picker';
import { Platform, Alert } from 'react-native';
import { saveMultipleMediaToHiddenFolder } from './localMediaStorage';

export async function pickLocalMedia(): Promise<string[]> {
  try {
    const doc = (globalThis as any).document;
    if (Platform.OS === 'web' && doc) {
      return new Promise<string[]>((resolve) => {
        const input = doc.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,video/*';
        input.multiple = true;

        input.onchange = (e: any) => {
          const files: File[] = Array.from(e.target.files || []);
          const uris: string[] = files.map((file) => {
            if ((file as any).path) {
              return (file as any).path;
            }
            return URL.createObjectURL(file);
          });
          resolve(uris);
        };

        input.oncancel = () => resolve([]);
        input.click();
      });
    }

    // Native Expo Image Picker
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Permission to access media library is required!');
      return [];
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const pickedUris = result.assets.map((asset) => asset.uri);
      // Persist picked media to hidden folder so pictures never disappear on refresh!
      return await saveMultipleMediaToHiddenFolder(pickedUris);
    }
    return [];
  } catch (error) {
    console.warn('Error picking local media:', error);
    return [];
  }
}
