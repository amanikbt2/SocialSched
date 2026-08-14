import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Image,
  Alert,
  Modal,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { AnimatedSheet } from '../common/AnimatedSheet';
import { useThemeStore } from '../../stores/useThemeStore';
import { useCampaignStore } from '../../stores/useCampaignStore';
import { useSocialAccountsStore } from '../../stores/useSocialAccountsStore';
import { Container, Post, SkipTimeRange, SocialPlatform } from '../../db/types';
import { FacebookMediaGrid } from '../common/FacebookMediaGrid';
import { pickLocalMedia } from '../../utils/mediaPicker';
import { saveMultipleMediaToHiddenFolder, assignNamedMediaFile, restoreOriginalMediaFile } from '../../utils/localMediaStorage';
import { generateLoopPosts } from '../../services/loopContainerEngine';
import { processSmartFirstComment } from '../../utils/tagProcessor';
import {
  smartNormalizeDate,
  smartNormalizeTime,
  validateScheduledDateTime,
} from '../../utils/dateTimeHelper';
import {
  getSmartSuggestions,
  appendTagToText,
  CATEGORY_TAG_PRESETS,
  extractHashtags,
  extractMentions,
} from '../../utils/tagSuggestionService';
import {
  Plus,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Image as ImageIcon,
  Sparkles,
  Clock,
  Calendar as CalendarIcon,
  Layers,
  Facebook,
  Instagram,
  Twitter,
  Video,
  CheckSquare,
  Square,
  Tag,
  AtSign,
  Upload,
  Infinity as InfinityIcon,
  AlertCircle,
  Repeat,
  MessageSquare,
  RotateCcw,
} from 'lucide-react-native';
import { platformColors } from '../../theme/colors';
import { TopReloadProgressBar } from '../common/TopReloadProgressBar';

interface AddContainerModalProps {
  visible: boolean;
  onClose: () => void;
  existingContainer?: Container | null;
  initialIsLoop?: boolean;
}

const SAMPLE_HASHTAGS = ['#viral', '#trending', '#marketing', '#tech', '#growth', '#photooftheday', '#sale'];
const SAMPLE_MENTIONS = ['@facebook', '@instagram', '@meta', '@techcrunch', '@forbes', '@creator'];
const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=60',
];

interface DraftPostItem {
  id: string;
  caption: string;
  images: string[];
  scheduledDate: string; // e.g. "2026-08-10"
  scheduledTime: string; // e.g. "14:30"
  expanded: boolean;
}

const getFirst5Words = (text: string) => {
  if (!text || text.trim() === '') return 'Empty caption post...';
  const words = text.trim().split(/\s+/);
  if (words.length <= 5) return words.join(' ');
  return words.slice(0, 5).join(' ') + '...';
};

export const AddContainerModal: React.FC<AddContainerModalProps> = ({
  visible,
  onClose,
  existingContainer,
  initialIsLoop,
}) => {
  const colors = useThemeStore((state) => state.colors);
  const { addCampaign, updateCampaign, addPost, addPostsBatch, clearScheduledPostsForCampaign } = useCampaignStore();

  const [title, setTitle] = useState(existingContainer?.title || '');
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(
    existingContainer?.platforms || ['facebook', 'instagram']
  );
  const [smartScheduling, setSmartScheduling] = useState(
    existingContainer?.smartSchedulingEnabled ?? true
  );
  const [intervalMinutes, setIntervalMinutes] = useState<number>(
    existingContainer?.intervalMinutes || 60
  );
  const [customIntervalInput, setCustomIntervalInput] = useState<string>(
    String(existingContainer?.intervalMinutes || 60)
  );

  const getTodayISO = () => new Date().toISOString().split('T')[0];
  const getTomorrowISO = () => new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const getFutureTimeString = (offsetMinutes: number = 30) => {
    const d = new Date(Date.now() + offsetMinutes * 60000);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const [startDate, setStartDate] = useState(existingContainer?.startDate || getTodayISO());
  const [startTime, setStartTime] = useState(existingContainer?.startTime || getFutureTimeString(30));

  // End Date Limit settings
  const [hasEndDateLimit, setHasEndDateLimit] = useState<boolean>(
    existingContainer?.hasEndDateLimit || false
  );
  const [endDate, setEndDate] = useState<string>(
    existingContainer?.endDate || getTomorrowISO()
  );
  const [endTime, setEndTime] = useState<string>(
    existingContainer?.endTime || '23:59'
  );

  // Skip Time Ranges state & modal controls
  const [skipTimeRanges, setSkipTimeRanges] = useState<SkipTimeRange[]>(
    existingContainer?.skipTimeRanges || []
  );
  const [skipModalVisible, setSkipModalVisible] = useState<boolean>(false);

  // Form submission loading state to prevent double-click / multiple creations
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [newSkipLabel, setNewSkipLabel] = useState<string>('');
  const [newSkipIsRecurring, setNewSkipIsRecurring] = useState<boolean>(false);
  const [newSkipStartDate, setNewSkipStartDate] = useState<string>(getTodayISO());
  const [newSkipStartTime, setNewSkipStartTime] = useState<string>('23:00');
  const [newSkipEndDate, setNewSkipEndDate] = useState<string>(getTomorrowISO());
  const [newSkipEndTime, setNewSkipEndTime] = useState<string>('07:00');

  const handleAddSkipTimeRange = () => {
    if (newSkipIsRecurring) {
      const normStartT = smartNormalizeTime(newSkipStartTime) || '23:00';
      const normEndT = smartNormalizeTime(newSkipEndTime) || '07:00';

      const newRange: SkipTimeRange = {
        id: 'skip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        startTime: normStartT,
        endTime: normEndT,
        label: newSkipLabel.trim() || `Daily: ${normStartT} - ${normEndT}`,
        isRecurring: true,
      };

      setSkipTimeRanges([...skipTimeRanges, newRange]);
      setNewSkipLabel('');
      Alert.alert('Success', 'Smart Daily Skip range added successfully!');
    } else {
      const normStartD = smartNormalizeDate(newSkipStartDate) || getTodayISO();
      const normStartT = smartNormalizeTime(newSkipStartTime) || '23:00';
      const normEndD = smartNormalizeDate(newSkipEndDate) || getTomorrowISO();
      const normEndT = smartNormalizeTime(newSkipEndTime) || '07:00';

      const newRange: SkipTimeRange = {
        id: 'skip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        startDate: normStartD,
        startTime: normStartT,
        endDate: normEndD,
        endTime: normEndT,
        label: newSkipLabel.trim() || `Manual: ${normStartD} ${normStartT} to ${normEndD} ${normEndT}`,
        isRecurring: false,
      };

      setSkipTimeRanges([...skipTimeRanges, newRange]);
      setNewSkipLabel('');
      Alert.alert('Success', 'Manual Skip time range added successfully!');
    }
  };

  const handleRemoveSkipTimeRange = (id: string) => {
    setSkipTimeRanges(skipTimeRanges.filter((r) => r.id !== id));
  };

  // Collapsible Social Media state
  const [socialsExpanded, setSocialsExpanded] = useState<boolean>(false);

  // Social Accounts Store Integration
  const { accounts } = useSocialAccountsStore();
  const connectedFbAccounts = accounts.filter((a) => a.platform === 'facebook' && a.isConnected);
  const [selectedFbPageId, setSelectedFbPageId] = useState<string>(
    connectedFbAccounts[0]?.id || ''
  );

  // First Comment state variables
  const [enableFirstComment, setEnableFirstComment] = useState<boolean>(
    existingContainer?.enableFirstComment ?? false
  );
  const [firstComment, setFirstComment] = useState<string>(
    existingContainer?.firstComment || ''
  );

  // Loop Container state variables
  const [isLoopContainer, setIsLoopContainer] = useState<boolean>(
    existingContainer?.isLoopContainer || false
  );
  const [autoNextRound, setAutoNextRound] = useState<boolean>(
    existingContainer?.autoNextRound ?? true
  );
  const [mediaPerPost, setMediaPerPost] = useState<number>(
    existingContainer?.mediaPerPost || 1
  );
  const [loopTab, setLoopTab] = useState<'descriptions' | 'media'>('descriptions');
  const [loopDescriptions, setLoopDescriptions] = useState<string[]>(
    existingContainer?.loopDescriptions && existingContainer.loopDescriptions.length > 0
      ? existingContainer.loopDescriptions
      : [
          '🔥 Fresh daily content for our amazing community! #viral #trending',
          '✨ Level up your social media presence with consistent value. #growth #marketing',
          '🚀 Check out this awesome post! Tag a friend who needs to see this. @creator',
        ]
  );
  const [loopMediaPool, setLoopMediaPool] = useState<string[]>(
    existingContainer?.loopMediaPool || []
  );
  const [newDescInput, setNewDescInput] = useState<string>('');
  const [pastedUrl, setPastedUrl] = useState<string>('');

  // Start & End media state
  const [startMediaUri, setStartMediaUri] = useState<string | null>(existingContainer?.startMediaUri || null);
  const [startMediaOriginalUri, setStartMediaOriginalUri] = useState<string | null>(existingContainer?.startMediaOriginalUri || null);
  const [endMediaUri, setEndMediaUri] = useState<string | null>(existingContainer?.endMediaUri || null);
  const [endMediaOriginalUri, setEndMediaOriginalUri] = useState<string | null>(existingContainer?.endMediaOriginalUri || null);

  const handleAddDescription = () => {
    if (!newDescInput.trim()) return;
    const lines = newDescInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    setLoopDescriptions([...loopDescriptions, ...lines]);
    setNewDescInput('');
  };

  const handleRemoveDescription = (index: number) => {
    setLoopDescriptions(loopDescriptions.filter((_, idx) => idx !== index));
  };

  const handleBulkPickMedia = async () => {
    const picked = await pickLocalMedia();
    if (picked && picked.length > 0) {
      setLoopMediaPool([...loopMediaPool, ...picked]);
    }
  };

  const handleAppendPastedUrl = () => {
    if (!pastedUrl.trim()) return;
    setLoopMediaPool([...loopMediaPool, pastedUrl.trim()]);
    setPastedUrl('');
  };

  const handleRemoveMediaFromPool = (index: number) => {
    setLoopMediaPool(loopMediaPool.filter((_, idx) => idx !== index));
  };

  // Start / End Media handlers
  const handlePickStartMedia = async () => {
    const picked = await pickLocalMedia();
    if (!picked || picked.length === 0) return;
    const source = picked[0];
    const containerId = existingContainer?.id || 'container_' + Date.now();
    const { namedUri, originalUri } = await assignNamedMediaFile(
      source, 'start', containerId,
      startMediaUri, startMediaOriginalUri
    );
    setStartMediaUri(namedUri);
    setStartMediaOriginalUri(originalUri);
  };

  const handlePickEndMedia = async () => {
    const picked = await pickLocalMedia();
    if (!picked || picked.length === 0) return;
    const source = picked[0];
    const containerId = existingContainer?.id || 'container_' + Date.now();
    const { namedUri, originalUri } = await assignNamedMediaFile(
      source, 'end', containerId,
      endMediaUri, endMediaOriginalUri
    );
    setEndMediaUri(namedUri);
    setEndMediaOriginalUri(originalUri);
  };

  const handleClearStartMedia = async () => {
    if (startMediaUri && startMediaOriginalUri) {
      await restoreOriginalMediaFile(startMediaUri, startMediaOriginalUri);
    }
    setStartMediaUri(null);
    setStartMediaOriginalUri(null);
  };

  const handleClearEndMedia = async () => {
    if (endMediaUri && endMediaOriginalUri) {
      await restoreOriginalMediaFile(endMediaUri, endMediaOriginalUri);
    }
    setEndMediaUri(null);
    setEndMediaOriginalUri(null);
  };

  // Pull Down Refresh / Clean Form handler
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const handleResetForm = () => {
    setRefreshing(true);
    setTitle('');
    setLoopDescriptions([]);
    setLoopMediaPool([]);
    setPosts([]);
    setMediaPerPost(1);
    setStartDate(getTodayISO());
    setStartTime(getFutureTimeString(30));
    setHasEndDateLimit(false);
    setEndDate(getTomorrowISO());
    setEndTime('23:59');
    setSkipTimeRanges([]);
    setEnableFirstComment(false);
    setFirstComment('');
    setTimeout(() => {
      setRefreshing(false);
      Alert.alert('✨ Container Cleared', 'Container form has been refreshed & reset to empty defaults.');
    }, 350);
  };

  // Draft Posts inside container
  const [posts, setPosts] = useState<DraftPostItem[]>([
    {
      id: '1',
      caption: '',
      images: [],
      scheduledDate: getTodayISO(),
      scheduledTime: getFutureTimeString(30),
      expanded: true,
    },
  ]);

  useEffect(() => {
    if (visible) {
      setIsSubmitting(false);
      if (existingContainer) {
        setTitle(existingContainer.title || '');
        setSelectedPlatforms(existingContainer.platforms || []);
        setIsLoopContainer(existingContainer.isLoopContainer || false);
        setLoopDescriptions(existingContainer.loopDescriptions || []);
        setLoopMediaPool(existingContainer.loopMediaPool || []);
        setStartMediaUri(existingContainer.startMediaUri || null);
        setStartMediaOriginalUri(existingContainer.startMediaOriginalUri || null);
        setEndMediaUri(existingContainer.endMediaUri || null);
        setEndMediaOriginalUri(existingContainer.endMediaOriginalUri || null);
        setMediaPerPost(existingContainer.mediaPerPost || 1);
        setStartDate(existingContainer.startDate || getTodayISO());
        setStartTime(existingContainer.startTime || getFutureTimeString(30));
        setHasEndDateLimit(existingContainer.hasEndDateLimit || false);
        setEndDate(existingContainer.endDate || getTomorrowISO());
        setEndTime(existingContainer.endTime || '23:59');
        setSkipTimeRanges(existingContainer.skipTimeRanges || []);
        setEnableFirstComment(existingContainer.enableFirstComment || false);
        setFirstComment(existingContainer.firstComment || '');
      } else {
        // Reset to default new container
        setTitle('');
        setSelectedPlatforms(['facebook']);
        setIsLoopContainer(initialIsLoop ?? false);
        setLoopDescriptions([
          '🔥 Fresh daily content for our amazing community! #viral #trending',
          '✨ Level up your social media presence with consistent value. #growth #marketing',
          '🚀 Check out this awesome post! Tag a friend who needs to see this. @creator',
        ]);
        setLoopMediaPool([]);
        setStartMediaUri(null);
        setStartMediaOriginalUri(null);
        setEndMediaUri(null);
        setEndMediaOriginalUri(null);
        setMediaPerPost(1);
        setStartDate(getTodayISO());
        setStartTime(getFutureTimeString(30));
        setHasEndDateLimit(false);
        setEndDate(getTomorrowISO());
        setEndTime('23:59');
        setSkipTimeRanges([]);
        setEnableFirstComment(false);
        setFirstComment('');
        setPosts([
          {
            id: '1',
            caption: '',
            images: [],
            scheduledDate: getTodayISO(),
            scheduledTime: getFutureTimeString(30),
            expanded: true,
          },
        ]);
      }
    }
  }, [visible, existingContainer, initialIsLoop]);

  const togglePlatform = (p: SocialPlatform) => {
    if (selectedPlatforms.includes(p)) {
      if (selectedPlatforms.length > 1) {
        setSelectedPlatforms(selectedPlatforms.filter((item) => item !== p));
      }
    } else {
      setSelectedPlatforms([...selectedPlatforms, p]);
    }
  };

  const handleCustomIntervalChange = (text: string) => {
    setCustomIntervalInput(text);
    const parsed = parseInt(text, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setIntervalMinutes(parsed);
    }
  };

  const handleAddPost = () => {
    const newPost: DraftPostItem = {
      id: Date.now().toString(),
      caption: '',
      images: [],
      scheduledDate: getTodayISO(),
      scheduledTime: getFutureTimeString((posts.length + 1) * 30),
      expanded: true,
    };
    setPosts([newPost, ...posts.map((p) => ({ ...p, expanded: false }))]);
  };

  const handleUpdatePostCaption = (id: string, text: string) => {
    setPosts(posts.map((p) => (p.id === id ? { ...p, caption: text } : p)));
  };

  const handleAppendTag = (id: string, tag: string) => {
    setPosts(
      posts.map((p) => {
        if (p.id === id) {
          return { ...p, caption: appendTagToText(p.caption, tag) };
        }
        return p;
      })
    );
  };

  // Open Real Local File Media Picker
  const handleOpenLocalPicker = async (id: string) => {
    const pickedUris = await pickLocalMedia();
    if (pickedUris && pickedUris.length > 0) {
      setPosts(
        posts.map((p) => {
          if (p.id === id) {
            return { ...p, images: [...p.images, ...pickedUris] };
          }
          return p;
        })
      );
    }
  };

  // Remove a specific image from a post's gallery
  const handleRemoveImage = (postId: string, imageIndex: number) => {
    setPosts(
      posts.map((p) => {
        if (p.id === postId) {
          return {
            ...p,
            images: p.images.filter((_, idx) => idx !== imageIndex),
          };
        }
        return p;
      })
    );
  };

  const handleRemovePost = (id: string) => {
    setPosts(posts.filter((p) => p.id !== id));
  };

  const togglePostExpanded = (id: string) => {
    setPosts(posts.map((p) => (p.id === id ? { ...p, expanded: !p.expanded } : p)));
  };

  const handleSaveContainer = async () => {
    if (isSubmitting) return;
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a Container Title');
      return;
    }

    setIsSubmitting(true);
    try {
      const containerId = existingContainer?.id || 'container_' + Date.now();
      const normStartD = smartNormalizeDate(startDate) || getTodayISO();
      const normStartT = smartNormalizeTime(startTime) || getFutureTimeString(30);

      if (isLoopContainer) {
        if (loopDescriptions.length === 0) {
          Alert.alert('Error', 'Please add at least 1 description for your Loop Container!');
          setIsSubmitting(false);
          return;
        }
        if (loopMediaPool.length === 0) {
          Alert.alert('Error', 'Please add photos or videos to your Media Pool!');
          setIsSubmitting(false);
          return;
        }

        const persistentMediaPool = await saveMultipleMediaToHiddenFolder(loopMediaPool);

        const loopContainerData: Container = {
          id: containerId,
          title: title.trim(),
          description: `Loop Container (${persistentMediaPool.length} media pool, ${loopDescriptions.length} captions)`,
          category: 'Loop Container',
          color: '#8B5CF6',
          thumbnailUri: persistentMediaPool[0] || undefined,
          platforms: selectedPlatforms,
          smartSchedulingEnabled: true, // Always ON for loop containers
          intervalMinutes: intervalMinutes || 60,
          startDate: normStartD,
          startTime: normStartT,
          hasEndDateLimit: hasEndDateLimit,
          endDate: hasEndDateLimit ? smartNormalizeDate(endDate) : undefined,
          endTime: hasEndDateLimit ? smartNormalizeTime(endTime) : undefined,
          isPaused: false,
          createdAt: new Date().toISOString(),
          isLoopContainer: true,
          autoNextRound: autoNextRound,
          mediaPerPost: Math.max(1, mediaPerPost || 1),
          loopDescriptions: loopDescriptions,
          loopMediaPool: persistentMediaPool,
          usedMediaUris: existingContainer?.usedMediaUris || [],
          currentLoopRound: existingContainer?.currentLoopRound || 1,
          isLoopCompleted: false,
          skipTimeRanges: skipTimeRanges,
          enableFirstComment: enableFirstComment,
          firstComment: firstComment,
          startMediaUri: startMediaUri || null,
          startMediaOriginalUri: startMediaOriginalUri || null,
          endMediaUri: endMediaUri || null,
          endMediaOriginalUri: endMediaOriginalUri || null,
        };

        if (existingContainer) {
          await updateCampaign(loopContainerData);
          await clearScheduledPostsForCampaign(containerId);
        } else {
          await addCampaign(loopContainerData);
        }

        // Run "The Real Magic" - Random Loop Posts Generator
        const result = generateLoopPosts({
          container: loopContainerData,
          loopDescriptions,
          loopMediaPool: persistentMediaPool,
          usedMediaUris: existingContainer?.usedMediaUris || [],
          mediaPerPost: Math.max(1, mediaPerPost || 1),
          startDate: normStartD,
          startTime: normStartT,
          endDate: hasEndDateLimit ? smartNormalizeDate(endDate) : undefined,
          endTime: hasEndDateLimit ? smartNormalizeTime(endTime) : undefined,
          intervalMinutes: intervalMinutes || 60,
          platforms: selectedPlatforms,
        });

        // Persist updated used media tracking and loop completed status
        await updateCampaign(containerId, {
          usedMediaUris: result.updatedUsedMediaUris,
          isLoopCompleted: result.isLoopCompleted,
        });

        // ⚡ Batch insert ALL loop posts at once — no sequential waiting!
        // This immediately makes them visible in the queue so the engine
        // can start picking up ready posts without waiting for the full save.
        await addPostsBatch(result.newPosts);

        onClose();
        return;
      }

      // STANDARD CONTAINER SAVE FLOW
      const thumbnail =
        posts.find((p) => p.images.length > 0)?.images[0] || SAMPLE_IMAGES[0];

      const containerData: Container = {
        id: containerId,
        title: title.trim(),
        description: `Container with ${posts.length} scheduled posts`,
        category: 'Social Batch',
        color: '#4F46E5',
        thumbnailUri: thumbnail,
        platforms: selectedPlatforms,
        smartSchedulingEnabled: smartScheduling,
        intervalMinutes: intervalMinutes || 60,
        startDate: normStartD,
        startTime: normStartT,
        hasEndDateLimit: hasEndDateLimit,
        endDate: hasEndDateLimit ? smartNormalizeDate(endDate) : undefined,
        endTime: hasEndDateLimit ? smartNormalizeTime(endTime) : undefined,
        skipTimeRanges: skipTimeRanges,
        isPaused: false,
        createdAt: new Date().toISOString(),
        enableFirstComment: enableFirstComment,
        firstComment: firstComment,
      };

      if (existingContainer) {
        await updateCampaign(containerData);
      } else {
        await addCampaign(containerData);
      }

      // Safe date calculation for standard containers
      let baseTimestamp = Date.parse(`${normStartD}T${normStartT}:00`);
      if (isNaN(baseTimestamp) || baseTimestamp <= Date.now() + 10 * 60000) {
        baseTimestamp = Date.now() + 15 * 60000;
      }

      const cleanIntervalMinutes = Math.max(1, Number(intervalMinutes) || 60);

      for (let i = 0; i < posts.length; i++) {
        const draft = posts[i];
        let scheduledISO: string;

        if (smartScheduling) {
          const postTimestamp = baseTimestamp + (i * cleanIntervalMinutes * 60 * 1000);
          scheduledISO = new Date(postTimestamp).toISOString();
        } else {
          const draftD = smartNormalizeDate(draft.scheduledDate || normStartD);
          const draftT = smartNormalizeTime(draft.scheduledTime || normStartT);
          let parsedCustom = Date.parse(`${draftD}T${draftT}:00`);

          // CRITICAL FIX: If custom time chosen is in the past (<= now) or within 10 mins,
          // shift it into a valid future schedule so Meta Graph API schedules it on server (published: false)
          // instead of publishing it immediately!
          if (isNaN(parsedCustom) || parsedCustom <= Date.now() + 10 * 60000) {
            console.warn(`[AddContainerModal] Custom time for post ${i+1} (${draftD} ${draftT}) is in the past or < 10 mins! Shifting to future...`);
            parsedCustom = Date.now() + (i + 1) * 20 * 60000;
          }
          scheduledISO = new Date(parsedCustom).toISOString();
        }

        const extractedTags = draft.caption.match(/#\w+/g) || [];
        const extractedMentions = draft.caption.match(/@\w+/g) || [];

        let processedFirstComment: string | undefined = undefined;
        if (enableFirstComment && firstComment) {
          processedFirstComment = processSmartFirstComment(firstComment, {
            title: title.trim(),
            caption: draft.caption,
            hashtags: extractedTags,
            scheduledAt: scheduledISO,
          });
        }

        const newPost: Post = {
          id: 'post_' + Date.now() + '_' + i,
          campaignId: containerId,
          caption: draft.caption,
          firstComment: processedFirstComment,
          images: draft.images,
          videos: [],
          platforms: selectedPlatforms,
          scheduledAt: scheduledISO,
          status: 'scheduled',
          notes: '',
          failureReason: null,
          uploadProgress: 0,
          tags: extractedTags,
          hashtags: extractedTags,
          mentions: extractedMentions,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await addPost(newPost);
      }

      onClose();
    } catch (err: any) {
      console.error('Error saving container:', err);
      Alert.alert('Error', `Error saving container: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };



  const startValidation = validateScheduledDateTime(startDate, startTime);

  const invalidCustomPost = !smartScheduling
    ? posts.find((p) => !validateScheduledDateTime(p.scheduledDate, p.scheduledTime).valid)
    : null;

  const isFormTimeValid = startValidation.valid && !invalidCustomPost;

  // ── Full form validation for Save Button label & color ──────────────────
  const getFormValidation = (): { valid: boolean; error: string; errorType: 'title' | 'media' | 'descriptions' | 'time' | 'posts' | null } => {
    // 1. Title required
    if (!title.trim()) {
      return { valid: false, error: '⚠️ Title is required', errorType: 'title' };
    }

    // 2. Loop container checks
    if (isLoopContainer) {
      if (loopDescriptions.length === 0) {
        return { valid: false, error: '⚠️ Add at least 1 description', errorType: 'descriptions' };
      }
      if (loopMediaPool.length === 0) {
        return { valid: false, error: '⚠️ Media pool is empty — add photos/videos', errorType: 'media' };
      }
    }

    // 3. Standard container: need at least 1 post
    if (!isLoopContainer && posts.length === 0) {
      return { valid: false, error: '⚠️ Add at least 1 post', errorType: 'posts' };
    }

    // 4. Time validation
    if (!isFormTimeValid) {
      if (!startValidation.valid) {
        return { valid: false, error: startValidation.error || '⏰ Fix start time (min 10 mins)', errorType: 'time' };
      }
      if (invalidCustomPost) {
        return {
          valid: false,
          error: `⏰ Fix time for: "${getFirst5Words(invalidCustomPost.caption)}"`,
          errorType: 'time',
        };
      }
    }

    return { valid: true, error: '', errorType: null };
  };

  const formValidation = getFormValidation();
  const isFormReady = formValidation.valid;
  const isFormClickable = isFormReady || formValidation.errorType === 'time';

  const platformItems: { id: SocialPlatform; label: string; icon: any; color: string }[] = [
    { id: 'facebook', label: 'Facebook', icon: Facebook, color: platformColors.facebook },
    { id: 'instagram', label: 'Instagram', icon: Instagram, color: platformColors.instagram },
    { id: 'x', label: 'X (Twitter)', icon: Twitter, color: platformColors.x },
    { id: 'tiktok', label: 'TikTok', icon: Video, color: '#000000' },
  ];

  return (
    <AnimatedSheet
      visible={visible}
      onClose={onClose}
      fullScreen={true}
      title={
        existingContainer
          ? existingContainer.isLoopContainer
            ? 'Edit Loop Container'
            : 'Edit Standard Container'
          : initialIsLoop
          ? 'Add Loop Container'
          : 'Add Standard Container'
      }
      subtitle={initialIsLoop ? 'Smart scheduling with randomized media & descriptions' : 'Schedule explicit individual posts with fixed times'}
    >
      <TopReloadProgressBar loading={refreshing} />
      <ScrollView
        style={[styles.containerScroll, { opacity: refreshing ? 0.55 : 1 }]}
        contentContainerStyle={styles.scrollPaddingBottom}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleResetForm}
            colors={['#1877F2']}
            tintColor="#1877F2"
            title="Pull down to clear form & start fresh..."
            titleColor={colors.textSecondary}
          />
        }
      >
        {/* Pull-down Refresh / Clear Form Banner */}
        <View style={[styles.pullRefreshBanner, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 6 }}>
            <RotateCcw size={13} color={colors.primary} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>
              Pull down to refresh & clean form
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleResetForm}
            style={[styles.clearBtnPill, { backgroundColor: colors.primaryContainer }]}
          >
            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary }}>CLEAR FORM</Text>
          </TouchableOpacity>
        </View>

        {/* Step 1: Container Title & Multi-Tick Target Platforms */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          CONTAINER DETAILS
        </Text>

        {isLoopContainer && (
          <View>
            <View style={[styles.loopMediaCountRow, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
              <View style={styles.loopMediaCountLeft}>
                <Sparkles size={16} color={colors.primary} />
                <Text style={[styles.inputLabel, { color: colors.textPrimary, marginBottom: 0 }]}>
                  Number of Media per Post
                </Text>
              </View>
              <View style={styles.mediaCountControl}>
                <TouchableOpacity
                  onPress={() => setMediaPerPost(Math.max(1, mediaPerPost - 1))}
                  style={[styles.mediaCountBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Text style={[styles.mediaCountBtnText, { color: colors.textPrimary }]}>-</Text>
                </TouchableOpacity>
                <Text style={[styles.mediaCountVal, { color: colors.primary }]}>{mediaPerPost}</Text>
                <TouchableOpacity
                  onPress={() => setMediaPerPost(mediaPerPost + 1)}
                  style={[styles.mediaCountBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Text style={[styles.mediaCountBtnText, { color: colors.textPrimary }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Auto-Continue to Next Round Toggle */}
            <View
              style={{ backgroundColor: colors.surfaceVariant, borderColor: colors.border, marginTop: 10, padding: 12, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
                <Repeat size={18} color="#8B5CF6" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.inputLabel, { color: colors.textPrimary, marginBottom: 2, fontSize: 13 }]}>
                    Auto-Continue to Next Round
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 14 }}>
                    {autoNextRound
                      ? '🔄 Infinite mode: Automatically resets media pool & continues next rounds until Hard End Date Cutoff.'
                      : '🛑 Manual mode: Stops when media pool ends & displays "▶ Next Loop" button.'}
                  </Text>
                </View>
              </View>
              <Switch
                value={autoNextRound}
                onValueChange={setAutoNextRound}
                trackColor={{ false: colors.border, true: '#8B5CF6' }}
              />
            </View>
          </View>
        )}

        <View style={styles.inputGroup}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={[styles.inputLabel, { color: !title.trim() ? '#EF4444' : colors.textPrimary, marginBottom: 0 }]}>
              Container Name {!title.trim() ? '— Required!' : ''}
            </Text>
            {!title.trim() && (
              <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 4 }}>
                <AlertCircle size={12} color="#EF4444" />
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#EF4444' }}>REQUIRED</Text>
              </View>
            )}
          </View>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: !title.trim() ? '#FEF2F2' : colors.surfaceVariant,
                color: colors.textPrimary,
                borderColor: !title.trim() ? '#EF4444' : colors.border,
                borderWidth: !title.trim() ? 2 : 1,
              },
            ]}
            placeholder="e.g. Summer FB & IG Campaign"
            placeholderTextColor={!title.trim() ? '#EF444480' : colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Smart First Comment Option Card */}
        <View style={[styles.loopToggleCard, { backgroundColor: enableFirstComment ? colors.primaryContainer + '35' : colors.surfaceVariant, borderColor: enableFirstComment ? colors.primary : colors.border, marginTop: 12 }]}>
          <View style={styles.loopToggleLeft}>
            <MessageSquare size={18} color={enableFirstComment ? colors.primary : colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.loopToggleTitle, { color: colors.textPrimary }]}>
                Smart First Comment
              </Text>
              <Text style={[styles.loopToggleSubtitle, { color: enableFirstComment ? colors.primary : colors.textSecondary }]}>
                Auto-add first comment to every post in this container
              </Text>
            </View>
          </View>
          <Switch
            value={enableFirstComment}
            onValueChange={setEnableFirstComment}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        {enableFirstComment && (
          <View style={[styles.inputGroup, { marginTop: 10 }]}>
            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>First Comment Template</Text>
            <TextInput
              style={[
                styles.textAreaInput,
                {
                  backgroundColor: colors.surfaceVariant,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                  minHeight: 65,
                },
              ]}
              multiline
              placeholder="e.g. Thanks for watching! Check out our page for details. {hashtags}"
              placeholderTextColor={colors.textMuted}
              value={firstComment}
              onChangeText={setFirstComment}
            />

            {/* Quick Smart Tags insertion chips */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 6, rowGap: 6, marginTop: 8 }}>
              <Text style={{ fontSize: 11, color: colors.textSecondary, alignSelf: 'center', marginRight: 4 }}>Insert Tag:</Text>
              {[
                { tag: '{hashtags}', label: '+ {hashtags}' },
                { tag: '{title}', label: '+ {title}' },
                { tag: '{round}', label: '+ {round}' },
                { tag: '{date}', label: '+ {date}' },
                { tag: '{time}', label: '+ {time}' },
              ].map((chip) => (
                <TouchableOpacity
                  key={chip.tag}
                  activeOpacity={0.8}
                  onPress={() => {
                    const space = firstComment.endsWith(' ') || firstComment === '' ? '' : ' ';
                    setFirstComment(firstComment + space + chip.tag);
                  }}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>{chip.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Collapsible Multi-Tick Target Platforms Grid */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setSocialsExpanded(!socialsExpanded)}
          style={[
            styles.collapsibleHeaderRow,
            { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
          ]}
        >
          <View style={styles.collapsibleLeft}>
            <Layers size={16} color={colors.primary} />
            <Text style={[styles.inputLabel, { color: colors.textPrimary, marginBottom: 0 }]}>
              Target Social Media
            </Text>
          </View>

          <View style={styles.collapsibleRight}>
            <Text style={[styles.selectedSummaryText, { color: colors.primary }]}>
              {selectedPlatforms.length} Selected
            </Text>
            {socialsExpanded ? (
              <ChevronUp size={18} color={colors.textSecondary} />
            ) : (
              <ChevronDown size={18} color={colors.textSecondary} />
            )}
          </View>
        </TouchableOpacity>

        {socialsExpanded && (
          <View style={[styles.tickPlatformsGrid, { marginTop: 8 }]}>
            {platformItems.map((item) => {
              const isSelected = selectedPlatforms.includes(item.id);
              const IconComp = item.icon;
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.8}
                  onPress={() => togglePlatform(item.id)}
                  style={[
                    styles.tickPlatformCard,
                    {
                      backgroundColor: isSelected ? item.color + '15' : colors.surfaceVariant,
                      borderColor: isSelected ? item.color : colors.border,
                    },
                  ]}
                >
                  <View style={styles.tickLeft}>
                    {isSelected ? (
                      <CheckSquare size={18} color={item.color} />
                    ) : (
                      <Square size={18} color={colors.textMuted} />
                    )}
                    <IconComp size={16} color={isSelected ? item.color : colors.textSecondary} />
                    <Text style={[styles.tickLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Target Facebook Page Picker */}
        {selectedPlatforms.includes('facebook') && (
          <View style={[styles.fbPageSelectorBox, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
            <View style={styles.fbPageHeaderRow}>
              <Facebook size={16} color={platformColors.facebook} />
              <Text style={[styles.fbPageLabel, { color: colors.textPrimary }]}>
                Target Facebook Page
              </Text>
            </View>

            {connectedFbAccounts.length > 0 ? (
              <View style={styles.fbPagesRow}>
                {connectedFbAccounts.map((acc) => {
                  const isPageSelected = selectedFbPageId === acc.id || connectedFbAccounts.length === 1;
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      activeOpacity={0.8}
                      onPress={() => setSelectedFbPageId(acc.id)}
                      style={[
                        styles.fbPageChip,
                        {
                          backgroundColor: isPageSelected ? platformColors.facebook + '20' : colors.surface,
                          borderColor: isPageSelected ? platformColors.facebook : colors.border,
                        },
                      ]}
                    >
                      <Check size={14} color={isPageSelected ? platformColors.facebook : 'transparent'} />
                      <Text style={[styles.fbPageChipText, { color: colors.textPrimary }]}>
                        {acc.displayName} ({acc.username})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={[styles.noFbPageText, { color: colors.danger }]}>
                ⚠️ No Facebook Page connected. Open Settings (☰) to connect your page.
              </Text>
            )}
          </View>
        )}

        {/* Step 2: Smart Scheduling Rules */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary, marginTop: 24 }]}>
          SCHEDULING RULES
        </Text>

        {/* If Smart Scheduling is OFF: Minimized single line component */}
        {!smartScheduling ? (
          <View
            style={[
              styles.minimizedSmartLine,
              { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
            ]}
          >
            <View style={styles.smartLeft}>
              <Sparkles size={18} color={colors.textMuted} />
              <Text style={[styles.minimizedSmartText, { color: colors.textSecondary }]}>
                Smart Batch Scheduling (OFF)
              </Text>
            </View>
            <Switch
              value={smartScheduling}
              onValueChange={setSmartScheduling}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        ) : (
          /* If Smart Scheduling is ON: Full Card settings */
          <View
            style={[
              styles.smartCard,
              { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
            ]}
          >
            <View style={styles.smartRow}>
              <View style={styles.smartLeft}>
                <Sparkles size={20} color={colors.primary} />
                <View>
                  <Text style={[styles.smartTitle, { color: colors.textPrimary }]}>
                    Smart Batch Scheduling (ON)
                  </Text>
                </View>
              </View>
              <Switch
                value={smartScheduling}
                onValueChange={setSmartScheduling}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <View style={styles.smartSettingsBody}>
              {/* Spreading Interval Presets */}
              <Text style={[styles.inputLabel, { color: colors.textPrimary, marginTop: 12 }]}>
                Time Spreading Interval (Presets or Custom Minutes)
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.intervalScroll}>
                {[
                  { label: '12 mins', val: 12 },
                  { label: '30 mins', val: 30 },
                  { label: '45 mins', val: 45 },
                  { label: '1 hour', val: 60 },
                  { label: '2 hours', val: 120 },
                  { label: '1 day', val: 1440 },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.val}
                    activeOpacity={0.8}
                    onPress={() => {
                      setIntervalMinutes(item.val);
                      setCustomIntervalInput(String(item.val));
                    }}
                    style={[
                      styles.intervalChip,
                      {
                        backgroundColor:
                          intervalMinutes === item.val
                            ? colors.primaryContainer
                            : colors.surface,
                        borderColor:
                          intervalMinutes === item.val ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.intervalChipText,
                        {
                          color:
                            intervalMinutes === item.val ? colors.primary : colors.textPrimary,
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Flexible Custom Minutes Input */}
              <View style={styles.customMinutesRow}>
                <Clock size={16} color={colors.primary} />
                <Text style={[styles.customMinutesText, { color: colors.textPrimary }]}>
                  Flexible Minute Spreading:
                </Text>
                <TextInput
                  style={[
                    styles.minutesInput,
                    {
                      backgroundColor: colors.surface,
                      color: colors.textPrimary,
                      borderColor: colors.border,
                    },
                  ]}
                  keyboardType="numeric"
                  value={customIntervalInput}
                  onChangeText={handleCustomIntervalChange}
                  placeholder="12"
                />
                <Text style={[styles.minutesSuffix, { color: colors.textSecondary }]}>minutes</Text>
              </View>

              {/* Start Date & Start Time */}
              <View style={styles.dateTimeSection}>
                <Text style={[styles.inputLabel, { color: colors.textPrimary, marginTop: 14 }]}>
                  Container Start Date & Time
                </Text>
                <View style={styles.dateTimeRow}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={[
                      styles.dateBox,
                      {
                        backgroundColor: !startValidation.valid ? '#FEF2F2' : colors.surface,
                        borderColor: !startValidation.valid ? '#EF4444' : colors.border,
                        borderWidth: !startValidation.valid ? 2 : 1,
                      },
                    ]}
                  >
                    <CalendarIcon size={14} color={!startValidation.valid ? '#EF4444' : colors.primary} />
                    <TextInput
                      style={[styles.dateInputText, { color: !startValidation.valid ? '#EF4444' : colors.textPrimary }]}
                      value={startDate}
                      onChangeText={setStartDate}
                      onBlur={() => setStartDate(smartNormalizeDate(startDate))}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.textMuted}
                      // @ts-ignore
                      type="date"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={[
                      styles.timeBox,
                      {
                        backgroundColor: !startValidation.valid ? '#FEF2F2' : colors.surface,
                        borderColor: !startValidation.valid ? '#EF4444' : colors.border,
                        borderWidth: !startValidation.valid ? 2 : 1,
                      },
                    ]}
                  >
                    <Clock size={14} color={!startValidation.valid ? '#EF4444' : colors.primary} />
                    <TextInput
                      style={[styles.timeInputText, { color: !startValidation.valid ? '#EF4444' : colors.textPrimary }]}
                      value={startTime}
                      onChangeText={setStartTime}
                      onBlur={() => setStartTime(smartNormalizeTime(startTime))}
                      placeholder="09:00"
                      placeholderTextColor={colors.textMuted}
                      // @ts-ignore
                      type="time"
                    />
                  </TouchableOpacity>
                </View>

                {!startValidation.valid && (
                  <View style={styles.errorAlertBox}>
                    <AlertCircle size={13} color="#EF4444" />
                    <Text style={styles.errorAlertText}>{startValidation.error}</Text>
                  </View>
                )}
              </View>

              {/* End Date Cutoff & Infinity Switch */}
              <View style={styles.endDateSection}>
                <View style={styles.endDateHeaderRow}>
                  <View style={styles.endDateLeft}>
                    <Text style={[styles.inputLabel, { color: colors.textPrimary, marginBottom: 0 }]}>
                      Set Hard End Date Cutoff
                    </Text>
                  </View>
                  <Switch
                    value={hasEndDateLimit}
                    onValueChange={setHasEndDateLimit}
                    trackColor={{ false: colors.border, true: colors.primary }}
                  />
                </View>

                {hasEndDateLimit && (
                  <View style={[styles.dateTimeRow, { marginTop: 8 }]}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={[
                        styles.dateBox,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <CalendarIcon size={14} color={colors.danger} />
                      <TextInput
                        style={[styles.dateInputText, { color: colors.textPrimary }]}
                        value={endDate}
                        onChangeText={setEndDate}
                        onBlur={() => setEndDate(smartNormalizeDate(endDate))}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.textMuted}
                        // @ts-ignore
                        type="date"
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={[
                        styles.timeBox,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <Clock size={14} color={colors.danger} />
                      <TextInput
                        style={[styles.timeInputText, { color: colors.textPrimary }]}
                        value={endTime}
                        onChangeText={setEndTime}
                        onBlur={() => setEndTime(smartNormalizeTime(endTime))}
                        placeholder="23:59"
                        placeholderTextColor={colors.textMuted}
                        // @ts-ignore
                        type="time"
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Skip Time Ranges Trigger Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setSkipModalVisible(true)}
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: skipTimeRanges.length > 0 ? '#8B5CF615' : colors.surface,
                  borderColor: skipTimeRanges.length > 0 ? '#8B5CF6' : colors.border,
                  borderWidth: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Clock size={16} color={skipTimeRanges.length > 0 ? '#8B5CF6' : colors.primary} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginLeft: 8 }}>
                    Add Skip Time{skipTimeRanges.length > 0 ? ` (${skipTimeRanges.length})` : ''}
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 3: Posts / Loop Content Builder */}
        {isLoopContainer ? (
          <View style={styles.loopSectionContainer}>
            <Text style={[styles.sectionHeading, { color: colors.textSecondary, marginTop: 24 }]}>
              LOOP CONTENT POOL
            </Text>

            {/* Dual Tabs Header */}
            <View style={[styles.tabBarRow, { backgroundColor: colors.surfaceVariant }]}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setLoopTab('descriptions')}
                style={[
                  styles.tabItemBtn,
                  loopTab === 'descriptions' && [styles.tabItemBtnActive, { backgroundColor: colors.primary }],
                ]}
              >
                <Text
                  style={[
                    styles.tabItemText,
                    { color: loopTab === 'descriptions' ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  Descriptions ({loopDescriptions.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setLoopTab('media')}
                style={[
                  styles.tabItemBtn,
                  loopTab === 'media' && [styles.tabItemBtnActive, { backgroundColor: colors.primary }],
                ]}
              >
                <Text
                  style={[
                    styles.tabItemText,
                    { color: loopTab === 'media' ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  Media Pool ({loopMediaPool.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab 1: DESCRIPTIONS */}
            {loopTab === 'descriptions' && (
              <View style={styles.tabBodyBox}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>
                    Add Descriptions (Single or Multi-line at a go)
                  </Text>
                  <TextInput
                    style={[
                      styles.textAreaInput,
                      { backgroundColor: colors.surfaceVariant, color: colors.textPrimary, borderColor: colors.border },
                    ]}
                    placeholder="Type post caption or paste multiple lines at a go..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                    value={newDescInput}
                    onChangeText={setNewDescInput}
                  />
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleAddDescription}
                    style={[styles.addDescBtn, { backgroundColor: colors.primary }]}
                  >
                    <Plus size={14} color="#FFFFFF" />
                    <Text style={styles.addDescBtnText}>+ Add to Descriptions List</Text>
                  </TouchableOpacity>
                </View>

                {/* Saved Descriptions */}
                <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 16 }]}>
                  SAVED DESCRIPTIONS LIST ({loopDescriptions.length})
                </Text>

                {loopDescriptions.length === 0 ? (
                  <Text style={[styles.emptyHintText, { color: colors.textMuted }]}>
                    No descriptions added yet. Add at least 1 description for your loop posts.
                  </Text>
                ) : (
                  loopDescriptions.map((desc, idx) => (
                    <View
                      key={idx}
                      style={[styles.descListItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <View style={[styles.descNumBadge, { backgroundColor: colors.primaryContainer }]}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>#{idx + 1}</Text>
                      </View>
                      <Text style={[styles.descText, { color: colors.textPrimary }]}>{desc}</Text>
                      <TouchableOpacity onPress={() => handleRemoveDescription(idx)} style={{ padding: 4 }}>
                        <Trash2 size={16} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Tab 2: MEDIA POOL */}
            {loopTab === 'media' && (
              <View style={styles.tabBodyBox}>
                {/* Start & End Media Section */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 10 }]}>
                    START & END MEDIA (Fixed Bookend Slides)
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 12, lineHeight: 16 }}>
                    Optional: First and last image for every generated post (e.g. cover photo + follow CTA). Files are renamed locally so no duplicates are created.
                  </Text>

                  {/* Start Media */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handlePickStartMedia}
                      style={[
                        styles.urlAddBtn,
                        { backgroundColor: colors.primaryContainer, paddingHorizontal: 14, paddingVertical: 10, flex: 1 },
                      ]}
                    >
                      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>
                        {startMediaUri ? '\uD83D\uDD04 Change Start Media' : '\uD83D\uDCCC Pick Start Media (Intro/Cover)'}
                      </Text>
                    </TouchableOpacity>
                    {!!startMediaUri && (
                      <TouchableOpacity onPress={handleClearStartMedia} style={{ padding: 6, marginLeft: 8 }}>
                        <X size={16} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                  {startMediaUri ? (
                    <View style={{ position: 'relative', width: 80, height: 80, marginBottom: 12 }}>
                      <Image source={{ uri: startMediaUri }} style={{ width: 80, height: 80, borderRadius: 8 }} resizeMode="cover" />
                      <View style={[
                        styles.indexBadge,
                        { backgroundColor: colors.primary, position: 'absolute', bottom: 4, left: 4, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
                      ]}>
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>START</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 12 }}>{'No start media set - first pool image will be slide #1'}</Text>
                  )}

                  {/* End Media */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handlePickEndMedia}
                      style={[
                        styles.urlAddBtn,
                        { backgroundColor: colors.primaryContainer, paddingHorizontal: 14, paddingVertical: 10, flex: 1 },
                      ]}
                    >
                      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>
                        {endMediaUri ? '\uD83D\uDD04 Change End Media' : '\uD83C\uDFC1 Pick End Media (Outro/CTA)'}
                      </Text>
                    </TouchableOpacity>
                    {!!endMediaUri && (
                      <TouchableOpacity onPress={handleClearEndMedia} style={{ padding: 6, marginLeft: 8 }}>
                        <X size={16} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                  {endMediaUri ? (
                    <View style={{ position: 'relative', width: 80, height: 80, marginBottom: 4 }}>
                      <Image source={{ uri: endMediaUri }} style={{ width: 80, height: 80, borderRadius: 8 }} resizeMode="cover" />
                      <View style={[
                        styles.indexBadge,
                        { backgroundColor: '#EF4444', position: 'absolute', bottom: 4, left: 4, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
                      ]}>
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>END</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>{'No end media set - last pool image will be the final slide'}</Text>
                  )}
                </View>

                {/* Bulk Pick Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleBulkPickMedia}
                  style={[styles.bulkPickBtn, { backgroundColor: colors.primary }]}
                >
                  <Upload size={16} color="#FFFFFF" />
                  <Text style={styles.bulkPickBtnText}>Bulk Pick Photos/Videos (Unlimited 100+)</Text>
                </TouchableOpacity>

                {/* Paste URL row */}
                <View style={styles.pasteUrlRow}>
                  <TextInput
                    style={[
                      styles.textInput,
                      { flex: 1, backgroundColor: colors.surfaceVariant, color: colors.textPrimary, borderColor: colors.border },
                    ]}
                    placeholder="Paste photo/video URL..."
                    placeholderTextColor={colors.textMuted}
                    value={pastedUrl}
                    onChangeText={setPastedUrl}
                  />
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleAppendPastedUrl}
                    style={[styles.urlAddBtn, { backgroundColor: colors.primaryContainer }]}
                  >
                    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>+ Add URL</Text>
                  </TouchableOpacity>
                </View>

                {/* Media Pool Grid */}
                <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 16 }]}>
                  MEDIA POOL ITEMS ({loopMediaPool.length})
                </Text>

                {loopMediaPool.length === 0 ? (
                  <Text style={[styles.emptyHintText, { color: colors.textMuted }]}>
                    No media items in pool yet. Tap "Bulk Pick Photos/Videos" to select photos from phone storage.
                  </Text>
                ) : (
                  <View style={styles.mediaPoolGrid}>
                    {loopMediaPool.map((uri, idx) => (
                      <View key={idx} style={styles.mediaGridCell}>
                        <Image source={{ uri }} style={styles.mediaGridThumb} resizeMode="cover" />
                        <TouchableOpacity
                          onPress={() => handleRemoveMediaFromPool(idx)}
                          style={styles.removeMediaBadge}
                        >
                          <Trash2 size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        ) : (
          <>
            <View style={styles.postsHeaderRow}>
              <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                CONTAINER POSTS ({posts.length})
              </Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleAddPost}
                style={[styles.addPostBtn, { backgroundColor: colors.primaryContainer }]}
              >
                <Plus size={14} color={colors.primary} />
                <Text style={[styles.addPostBtnText, { color: colors.primary }]}>+ Add Post</Text>
              </TouchableOpacity>
            </View>

            {posts.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.postItemCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                {/* Minimized Header Row: First 5 Words + ... */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => togglePostExpanded(item.id)}
                  style={styles.minimizedRow}
                >
                  <View style={styles.minimizedLeft}>
                    <View style={[styles.indexBadge, { backgroundColor: colors.primaryContainer }]}>
                      <Text style={[styles.indexText, { color: colors.primary }]}>#{index + 1}</Text>
                    </View>
                    <Text style={[styles.minimizedText, { color: colors.textPrimary }]}>
                      {getFirst5Words(item.caption)}
                    </Text>
                  </View>

                  <View style={styles.minimizedRight}>
                    {item.images.length > 0 && (
                      <View style={[styles.mediaBadge, { backgroundColor: colors.surfaceVariant }]}>
                        <ImageIcon size={12} color={colors.textSecondary} />
                        <Text style={[styles.mediaCountText, { color: colors.textSecondary }]}>
                          {item.images.length}
                        </Text>
                      </View>
                    )}
                    {item.expanded ? (
                      <ChevronUp size={18} color={colors.textSecondary} />
                    ) : (
                      <ChevronDown size={18} color={colors.textSecondary} />
                    )}
                  </View>
                </TouchableOpacity>

                {/* Expanded Post Editor */}
                {item.expanded && (
                  <View style={styles.expandedEditor}>
                    <TextInput
                      style={[
                        styles.captionInput,
                        {
                          backgroundColor: colors.surfaceVariant,
                          color: colors.textPrimary,
                          borderColor: colors.border,
                        },
                      ]}
                      placeholder="Write post caption description..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                      value={item.caption}
                      onChangeText={(text) => handleUpdatePostCaption(item.id, text)}
                    />

                    {/* Smart Dynamic Hashtags & Mentions Suggestion Bar */}
                    {(() => {
                      const { hashtags, mentions } = getSmartSuggestions(item.caption, 'general');
                      return (
                        <View style={{ marginBottom: 10 }}>
                          <Text style={[styles.suggestLabel, { color: colors.textSecondary }]}>
                            SMART HASHTAGS & @MENTIONS SUGGESTIONS
                          </Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll}>
                            {hashtags.map((tag) => (
                              <TouchableOpacity
                                key={tag}
                                activeOpacity={0.8}
                                onPress={() => handleAppendTag(item.id, tag)}
                                style={[styles.tagPill, { backgroundColor: colors.primaryContainer }]}
                              >
                                <Tag size={10} color={colors.primary} />
                                <Text style={[styles.tagPillText, { color: colors.primary }]}>{tag}</Text>
                              </TouchableOpacity>
                            ))}

                            {mentions.map((men) => (
                              <TouchableOpacity
                                key={men}
                                activeOpacity={0.8}
                                onPress={() => handleAppendTag(item.id, men)}
                                style={[styles.tagPill, { backgroundColor: '#3B82F618', borderColor: '#3B82F640', borderWidth: 1 }]}
                              >
                                <AtSign size={10} color="#3B82F6" />
                                <Text style={[styles.tagPillText, { color: '#3B82F6', fontWeight: '800' }]}>{men}</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      );
                    })()}

                    {/* Attached Media Header & Local Gallery Uploader */}
                    <View style={styles.mediaHeaderRow}>
                      <Text style={[styles.suggestLabel, { color: colors.textSecondary }]}>
                        ATTACHED GALLERY ({item.images.length} photos/videos)
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleOpenLocalPicker(item.id)}
                        style={[styles.attachBtn, { backgroundColor: colors.primaryContainer }]}
                      >
                        <Upload size={12} color={colors.primary} />
                        <Text style={[styles.attachBtnText, { color: colors.primary }]}>
                          + Add Photos
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Gallery Thumbnails List with Trash Delete Buttons on each photo */}
                    {item.images.length > 0 ? (
                      <View>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.galleryThumbnailsScroll}
                        >
                          {item.images.map((imgUri, imgIdx) => (
                            <View key={imgIdx} style={styles.thumbWrapper}>
                              <Image source={{ uri: imgUri }} style={styles.thumbImage} resizeMode="cover" />
                              <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => handleRemoveImage(item.id, imgIdx)}
                                style={styles.trashIconBtn}
                              >
                                <Trash2 size={11} color="#FFFFFF" />
                              </TouchableOpacity>
                            </View>
                          ))}

                          {/* "+ Add More" Gallery Card */}
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => handleOpenLocalPicker(item.id)}
                            style={[
                              styles.addMoreThumbCard,
                              {
                                backgroundColor: colors.primaryContainer,
                                borderColor: colors.primary,
                              },
                            ]}
                          >
                            <Plus size={18} color={colors.primary} />
                            <Text style={[styles.addMoreThumbText, { color: colors.primary }]}>
                              + Add More
                            </Text>
                          </TouchableOpacity>
                        </ScrollView>

                        {/* Real Multi-Gallery Grid Preview */}
                        <View style={{ marginTop: 10 }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, marginBottom: 4, letterSpacing: 0.5 }}>
                            POST MULTI-GALLERY PREVIEW:
                          </Text>
                          <FacebookMediaGrid images={item.images} />
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleOpenLocalPicker(item.id)}
                        style={[styles.emptyMediaBox, { borderColor: colors.border }]}
                      >
                        <Upload size={24} color={colors.primary} />
                        <Text style={[styles.emptyMediaText, { color: colors.textPrimary }]}>
                          Tap to open Device Media Picker (Pick photos/videos)
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Custom Per-Post Date & Time Pickers (Only when Smart Scheduling is OFF) */}
                    {!smartScheduling && (() => {
                      const postVal = validateScheduledDateTime(item.scheduledDate, item.scheduledTime);
                      return (
                        <View style={styles.customDateTimeBlock}>
                          <Text style={[styles.inputLabel, { color: colors.textPrimary, marginTop: 10 }]}>
                            Individual Post Date & Time
                          </Text>
                          <View style={styles.dateTimeRow}>
                            <View
                              style={[
                                styles.dateBox,
                                {
                                  backgroundColor: !postVal.valid ? '#FEF2F2' : colors.surfaceVariant,
                                  borderColor: !postVal.valid ? '#EF4444' : colors.border,
                                  borderWidth: !postVal.valid ? 2 : 1,
                                },
                              ]}
                            >
                              <CalendarIcon size={14} color={!postVal.valid ? '#EF4444' : colors.primary} />
                              <TextInput
                                style={[styles.dateInputText, { color: !postVal.valid ? '#EF4444' : colors.textPrimary }]}
                                value={item.scheduledDate}
                                onChangeText={(val) =>
                                  setPosts(posts.map((p) => (p.id === item.id ? { ...p, scheduledDate: val } : p)))
                                }
                                onBlur={() =>
                                  setPosts(
                                    posts.map((p) =>
                                      p.id === item.id
                                        ? { ...p, scheduledDate: smartNormalizeDate(p.scheduledDate) }
                                        : p
                                    )
                                  )
                                }
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={colors.textMuted}
                                //@ts-ignore
                                type="date"
                              />
                            </View>

                            <View
                              style={[
                                styles.timeBox,
                                {
                                  backgroundColor: !postVal.valid ? '#FEF2F2' : colors.surfaceVariant,
                                  borderColor: !postVal.valid ? '#EF4444' : colors.border,
                                  borderWidth: !postVal.valid ? 2 : 1,
                                },
                              ]}
                            >
                              <Clock size={14} color={!postVal.valid ? '#EF4444' : colors.primary} />
                              <TextInput
                                style={[styles.timeInputText, { color: !postVal.valid ? '#EF4444' : colors.textPrimary }]}
                                value={item.scheduledTime}
                                onChangeText={(val) =>
                                  setPosts(posts.map((p) => (p.id === item.id ? { ...p, scheduledTime: val } : p)))
                                }
                                onBlur={() =>
                                  setPosts(
                                    posts.map((p) =>
                                      p.id === item.id
                                        ? { ...p, scheduledTime: smartNormalizeTime(p.scheduledTime) }
                                        : p
                                    )
                                  )
                                }
                                placeholder="14:30"
                                placeholderTextColor={colors.textMuted}
                                //@ts-ignore
                                type="time"
                              />
                            </View>
                          </View>

                          {!postVal.valid && (
                            <View style={styles.errorAlertBox}>
                              <AlertCircle size={13} color="#EF4444" />
                              <Text style={styles.errorAlertText}>{postVal.error}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}

                    {/* Post Bottom Actions: Done & Delete Post */}
                    <View style={styles.postBottomActionsRow}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => togglePostExpanded(item.id)}
                        style={[styles.donePostBtn, { backgroundColor: colors.primaryContainer }]}
                      >
                        <Check size={14} color={colors.primary} />
                        <Text style={[styles.donePostText, { color: colors.primary }]}>Done</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleRemovePost(item.id)}
                        style={styles.deletePostRow}
                      >
                        <Trash2 size={14} color={colors.danger} />
                        <Text style={[styles.deletePostText, { color: colors.danger }]}>Delete Post</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        {/* Save Container Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={isSubmitting || !isFormClickable}
          onPress={() => {
            if (isSubmitting) return;
            if (formValidation.errorType === 'time') {
              Alert.alert(
                '⏰ Scheduled Time Warning',
                'The scheduled start time is in the past or under 10 minutes in the future. Ready posts will be published LIVE immediately. Proceed anyway?',
                [
                  { text: 'Cancel / Change Time', style: 'cancel' },
                  {
                    text: 'Create Anyway',
                    onPress: () => {
                      handleSaveContainer();
                    },
                  },
                ]
              );
              return;
            }
            if (!isFormReady) {
              Alert.alert('Cannot Save Container', formValidation.error);
              return;
            }
            handleSaveContainer();
          }}
          style={[
            styles.saveBtn,
            {
              backgroundColor: isSubmitting
                ? colors.primaryContainer
                : isFormReady
                ? colors.primary
                : formValidation.errorType === 'title'
                ? '#DC2626'
                : formValidation.errorType === 'media'
                ? '#EA580C'
                : formValidation.errorType === 'descriptions'
                ? '#7C3AED'
                : formValidation.errorType === 'posts'
                ? '#0284C7'
                : '#EF4444',
              opacity: isSubmitting ? 0.65 : 1,
              borderWidth: isFormClickable ? 0 : 2,
              borderColor: 'rgba(255,255,255,0.35)',
            },
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
          ) : isFormReady ? (
            <Check size={18} color="#FFFFFF" />
          ) : (
            <AlertCircle size={18} color="#FFFFFF" />
          )}
          <Text style={styles.saveBtnText} numberOfLines={1}>
            {isSubmitting
              ? existingContainer
                ? 'Saving Container...'
                : 'Creating Container...'
              : isFormReady
              ? existingContainer
                ? '✓  Save Container'
                : '✓  Create & Save Container'
              : formValidation.error}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Skip Time Ranges Management Modal Popup */}
      <Modal
        visible={skipModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSkipModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.background, height: '78%', maxHeight: 600, minHeight: 440, width: '92%', maxWidth: 440, padding: 18, borderRadius: 20, display: 'flex', flexDirection: 'column' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Clock size={20} color="#8B5CF6" />
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginLeft: 8 }}>
                  Skip Times {skipTimeRanges.length > 0 ? `(${skipTimeRanges.length})` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSkipModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={true}>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 16, lineHeight: 16 }}>
                Add time ranges to skip posting (e.g. night sleep hours or quiet windows). Post scheduling will automatically jump over these windows!
              </Text>

              {/* Form to Add New Skip Time Range */}
              <View style={{ backgroundColor: colors.surfaceVariant, padding: 12, borderRadius: 14, marginBottom: 16, borderColor: colors.border, borderWidth: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 }}>
                  + Add New Skip Time Range
                </Text>

                <TextInput
                  style={[styles.textInput, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border, height: 38, marginBottom: 10, fontSize: 13 }]}
                  placeholder="Label (e.g. Night Sleep Window)"
                  placeholderTextColor={colors.textMuted}
                  value={newSkipLabel}
                  onChangeText={setNewSkipLabel}
                />

                {/* Skip Mode Tab Segment Control */}
                <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 10, padding: 3, marginBottom: 12, borderColor: colors.border, borderWidth: 1 }}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setNewSkipIsRecurring(false)}
                    style={{
                      flex: 1,
                      paddingVertical: 7,
                      alignItems: 'center',
                      borderRadius: 8,
                      backgroundColor: !newSkipIsRecurring ? colors.primaryContainer : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: !newSkipIsRecurring ? colors.primary : colors.textSecondary }}>
                      Manual Skip Time
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setNewSkipIsRecurring(true)}
                    style={{
                      flex: 1,
                      paddingVertical: 7,
                      alignItems: 'center',
                      borderRadius: 8,
                      backgroundColor: newSkipIsRecurring ? colors.primaryContainer : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: newSkipIsRecurring ? colors.primary : colors.textSecondary }}>
                      Smart Skip Time
                    </Text>
                  </TouchableOpacity>
                </View>

                {!newSkipIsRecurring ? (
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>
                      Start Date & Time
                    </Text>
                    <View style={[styles.dateTimeRow, { marginBottom: 10 }]}>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        style={[styles.dateBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <CalendarIcon size={13} color={colors.primary} />
                        <TextInput
                          style={[styles.dateInputText, { color: colors.textPrimary }]}
                          value={newSkipStartDate}
                          onChangeText={setNewSkipStartDate}
                          onBlur={() => setNewSkipStartDate(smartNormalizeDate(newSkipStartDate))}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={colors.textMuted}
                          // @ts-ignore
                          type="date"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        style={[styles.timeBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <Clock size={13} color={colors.primary} />
                        <TextInput
                          style={[styles.timeInputText, { color: colors.textPrimary }]}
                          value={newSkipStartTime}
                          onChangeText={setNewSkipStartTime}
                          onBlur={() => setNewSkipStartTime(smartNormalizeTime(newSkipStartTime))}
                          placeholder="23:00"
                          placeholderTextColor={colors.textMuted}
                          // @ts-ignore
                          type="time"
                        />
                      </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>
                      End Date & Time
                    </Text>
                    <View style={[styles.dateTimeRow, { marginBottom: 12 }]}>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        style={[styles.dateBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <CalendarIcon size={13} color={colors.danger} />
                        <TextInput
                          style={[styles.dateInputText, { color: colors.textPrimary }]}
                          value={newSkipEndDate}
                          onChangeText={setNewSkipEndDate}
                          onBlur={() => setNewSkipEndDate(smartNormalizeDate(newSkipEndDate))}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={colors.textMuted}
                          // @ts-ignore
                          type="date"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        style={[styles.timeBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <Clock size={13} color={colors.danger} />
                        <TextInput
                          style={[styles.timeInputText, { color: colors.textPrimary }]}
                          value={newSkipEndTime}
                          onChangeText={setNewSkipEndTime}
                          onBlur={() => setNewSkipEndTime(smartNormalizeTime(newSkipEndTime))}
                          placeholder="07:00"
                          placeholderTextColor={colors.textMuted}
                          // @ts-ignore
                          type="time"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
                      Daily Recurring Window (Every Day)
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 6 }}>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        style={[styles.timeBox, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderRadius: 10 }]}
                      >
                        <Clock size={13} color={colors.primary} style={{ marginRight: 6 }} />
                        <TextInput
                          style={[styles.timeInputText, { color: colors.textPrimary, flex: 1, fontSize: 13, padding: 0 }]}
                          value={newSkipStartTime}
                          onChangeText={setNewSkipStartTime}
                          onBlur={() => setNewSkipStartTime(smartNormalizeTime(newSkipStartTime))}
                          placeholder="Start Time (e.g. 22:00)"
                          placeholderTextColor={colors.textMuted}
                          // @ts-ignore
                          type="time"
                        />
                      </TouchableOpacity>

                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>to</Text>

                      <TouchableOpacity
                        activeOpacity={0.9}
                        style={[styles.timeBox, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderRadius: 10 }]}
                      >
                        <Clock size={13} color={colors.danger} style={{ marginRight: 6 }} />
                        <TextInput
                          style={[styles.timeInputText, { color: colors.textPrimary, flex: 1, fontSize: 13, padding: 0 }]}
                          value={newSkipEndTime}
                          onChangeText={setNewSkipEndTime}
                          onBlur={() => setNewSkipEndTime(smartNormalizeTime(newSkipEndTime))}
                          placeholder="End Time (e.g. 06:00)"
                          placeholderTextColor={colors.textMuted}
                          // @ts-ignore
                          type="time"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleAddSkipTimeRange}
                  style={{ backgroundColor: '#8B5CF6', paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>
                    + Save Skip Range
                  </Text>
                </TouchableOpacity>
              </View>

              {/* List of Added Skip Ranges */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 }}>
                Active Skip Windows ({skipTimeRanges.length})
              </Text>

              {skipTimeRanges.length === 0 ? (
                <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginVertical: 12 }}>
                  No skip time ranges added yet.
                </Text>
              ) : (
                skipTimeRanges.map((range, idx) => (
                  <View
                    key={range.id || idx}
                    style={{
                      backgroundColor: colors.surfaceVariant,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: 10,
                      padding: 10,
                      marginBottom: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                        {range.label || `Skip Window #${idx + 1}`}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                        {range.startDate} {range.startTime}  ➔  {range.endDate} {range.endTime}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveSkipTimeRange(range.id)}
                      style={{ padding: 6 }}
                    >
                      <Trash2 size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSkipModalVisible(false)}
              style={{ backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 12 }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AnimatedSheet>
  );
};

const styles = StyleSheet.create({
  containerScroll: {
    flex: 1,
    maxHeight: '100%',
  },
  scrollPaddingBottom: {
    paddingBottom: 120,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  tickPlatformsGrid: {
    gap: 8,
  },
  tickPlatformCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  collapsibleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  collapsibleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsibleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedSummaryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tickLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tickLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  minimizedSmartLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  minimizedSmartText: {
    fontSize: 13,
    fontWeight: '700',
  },
  smartCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  smartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  smartTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  smartSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  smartSettingsBody: {
    marginTop: 10,
  },
  intervalScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  intervalChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 6,
  },
  intervalChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  customMinutesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  customMinutesText: {
    fontSize: 12,
    fontWeight: '600',
  },
  minutesInput: {
    width: 60,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
  minutesSuffix: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateTimeSection: {
    marginTop: 4,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateBox: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  dateInputText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    borderWidth: 0,
    backgroundColor: 'transparent',
    // @ts-ignore
    outlineStyle: 'none',
    outlineWidth: 0,
  },
  timeBox: {
    width: 110,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  timeInputText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    borderWidth: 0,
    backgroundColor: 'transparent',
    // @ts-ignore
    outlineStyle: 'none',
    outlineWidth: 0,
  },
  endDateSection: {
    marginTop: 14,
  },
  endDateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  endDateLeft: {
    flex: 1,
  },
  infinityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  infinityBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  postsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 10,
  },
  addPostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  addPostBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  postItemCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  minimizedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  minimizedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  indexBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  indexText: {
    fontSize: 11,
    fontWeight: '800',
  },
  minimizedText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  minimizedRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  mediaCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  expandedEditor: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  captionInput: {
    minHeight: 70,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  suggestLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  tagScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 6,
    gap: 4,
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  mediaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 5,
  },
  attachBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  emptyMediaBox: {
    height: 90,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 6,
  },
  emptyMediaText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  galleryThumbnailsScroll: {
    flexDirection: 'row',
    marginBottom: 8,
    marginTop: 4,
  },
  thumbWrapper: {
    width: 68,
    height: 68,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 8,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  trashIconBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  addMoreThumbCard: {
    width: 68,
    height: 68,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    gap: 2,
  },
  addMoreThumbText: {
    fontSize: 10,
    fontWeight: '800',
  },
  customDateTimeBlock: {
    marginTop: 4,
  },
  errorAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorAlertText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
    flex: 1,
  },
  postBottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  donePostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  donePostText: {
    fontSize: 12,
    fontWeight: '800',
  },
  deletePostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deletePostText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fbPageSelectorBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  fbPageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  fbPageLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  fbPagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fbPageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  fbPageChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  noFbPageText: {
    fontSize: 11,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 20,
    gap: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  loopToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  loopToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  loopToggleTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  loopToggleSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  loopMediaCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  loopMediaCountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaCountControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaCountBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaCountBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
  mediaCountVal: {
    fontSize: 15,
    fontWeight: '800',
    minWidth: 20,
    textAlign: 'center',
  },
  loopSectionContainer: {
    marginTop: 8,
  },
  tabBarRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  tabItemBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabItemBtnActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '800',
  },
  tabBodyBox: {
    paddingVertical: 4,
  },
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  addDescBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 12,
    marginTop: 10,
    gap: 6,
  },
  addDescBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  descListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  descNumBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  descText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  emptyHintText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginVertical: 10,
  },
  bulkPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 14,
    gap: 8,
    marginBottom: 12,
  },
  bulkPickBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  pasteUrlRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  urlAddBtn: {
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPoolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  mediaGridCell: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  mediaGridThumb: {
    width: '100%',
    height: '100%',
  },
  removeMediaBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  pullRefreshBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  clearBtnPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
});
