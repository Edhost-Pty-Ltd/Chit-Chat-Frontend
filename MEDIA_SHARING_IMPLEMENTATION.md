# Media Sharing Implementation Guide

## Overview

This guide covers implementing media sharing for:
- 📸 **Images** - Photos from camera or gallery
- 🎥 **Videos** - Video clips
- 🎵 **Audio** - Music files, recordings
- 📄 **Documents** - PDFs, text files, etc.

---

## Architecture

### File Upload Flow

```
User selects media
    ↓
Pick file using expo-image-picker / expo-document-picker
    ↓
Upload to Firebase Storage (using fixed uploadFile)
    ↓
Get download URL
    ↓
Send message with mediaUrl and type
    ↓
Recipient sees media in chat
```

### Message Types

```typescript
type MessageType = 
  | 'text'      // Plain text
  | 'image'     // Photo/picture
  | 'video'     // Video clip
  | 'voice'     // Voice note (already implemented)
  | 'audio'     // Audio file (music, etc.)
  | 'file'      // Document (PDF, etc.)
```

---

## Step 1: Update Message Types

### File: `src/types/index.ts`

Add media message types:

```typescript
export interface Message {
  messageId: string;
  senderId: string;
  text: string | null;
  type: 'text' | 'image' | 'video' | 'voice' | 'audio' | 'file';
  
  // Media URLs
  imageUrl?: string | null;
  videoUrl?: string | null;
  voiceUrl?: string | null;
  audioUrl?: string | null;
  fileUrl?: string | null;
  
  // Media metadata
  fileName?: string;        // Original filename
  fileSize?: number;        // File size in bytes
  mimeType?: string;        // MIME type
  duration?: number;        // For audio/video in ms
  thumbnailUrl?: string;    // Video thumbnail
  
  timestamp: Date;
  readBy: string[];
  editedAt?: Date | null;
}
```

---

## Step 2: Update Storage Helper

### File: `src/config/storage.ts`

Add function to detect MIME type:

```typescript
// Detect MIME type from file extension
export function getMimeType(uri: string): string {
  const extension = uri.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    
    // Videos
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    
    // Audio
    'm4a': 'audio/mp4',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    'zip': 'application/zip',
  };
  
  return mimeTypes[extension || ''] || 'application/octet-stream';
}

// Get file extension from URI
export function getFileExtension(uri: string): string {
  return uri.split('.').pop()?.toLowerCase() || 'bin';
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

Update `uploadFile` to handle different content types:

```typescript
// In uploadFile function, change this line:
xhr.setRequestHeader('Content-Type', 'image/jpeg');

// To this:
const mimeType = getMimeType(localUri);
xhr.setRequestHeader('Content-Type', mimeType);
```

---

## Step 3: Add Media Message Senders

### File: `src/hooks/useChatActions.ts`

Add functions to send different media types:

```typescript
// ── Send image message ────────────────────────────────────────────────────────
export async function sendImageMessage(
  chatId: string,
  senderId: string,
  imageUri: string,
): Promise<{ success: boolean; messageId: string }> {
  try {
    // Upload image to Storage
    const { uploadFile, generateFileName, getMimeType } = await import('../config/storage');
    const fileName = generateFileName(getFileExtension(imageUri));
    
    const imageUrl = await uploadFile(imageUri, 'chatMedia', {
      chatId,
      fileName,
    });
    
    // Get chat members
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) return { success: false, messageId: '' };
    
    const members: string[] = chatSnap.data().members ?? [];
    const otherMembers = members.filter((id) => id !== senderId);
    
    // Create message
    const batch = writeBatch(db);
    const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
    
    batch.set(msgRef, {
      messageId: msgRef.id,
      senderId,
      text: null,
      type: 'image',
      imageUrl,
      timestamp: serverTimestamp(),
      readBy: [senderId],
    });
    
    // Update chat
    const unreadUpdates = Object.fromEntries(
      otherMembers.map((id) => [`unreadCounts.${id}`, increment(1)])
    );
    
    batch.update(chatRef, {
      'lastMessage.text': '📷 Photo',
      'lastMessage.senderId': senderId,
      'lastMessage.timestamp': serverTimestamp(),
      ...unreadUpdates,
    });
    
    await batch.commit();
    return { success: true, messageId: msgRef.id };
  } catch (err) {
    console.error('sendImageMessage error:', err);
    return { success: false, messageId: '' };
  }
}

// ── Send video message ────────────────────────────────────────────────────────
export async function sendVideoMessage(
  chatId: string,
  senderId: string,
  videoUri: string,
  durationMs?: number,
): Promise<{ success: boolean; messageId: string }> {
  try {
    const { uploadFile, generateFileName } = await import('../config/storage');
    const fileName = generateFileName(getFileExtension(videoUri));
    
    const videoUrl = await uploadFile(videoUri, 'chatMedia', {
      chatId,
      fileName,
    });
    
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) return { success: false, messageId: '' };
    
    const members: string[] = chatSnap.data().members ?? [];
    const otherMembers = members.filter((id) => id !== senderId);
    
    const batch = writeBatch(db);
    const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
    
    batch.set(msgRef, {
      messageId: msgRef.id,
      senderId,
      text: null,
      type: 'video',
      videoUrl,
      duration: durationMs,
      timestamp: serverTimestamp(),
      readBy: [senderId],
    });
    
    const unreadUpdates = Object.fromEntries(
      otherMembers.map((id) => [`unreadCounts.${id}`, increment(1)])
    );
    
    batch.update(chatRef, {
      'lastMessage.text': '🎥 Video',
      'lastMessage.senderId': senderId,
      'lastMessage.timestamp': serverTimestamp(),
      ...unreadUpdates,
    });
    
    await batch.commit();
    return { success: true, messageId: msgRef.id };
  } catch (err) {
    console.error('sendVideoMessage error:', err);
    return { success: false, messageId: '' };
  }
}

// ── Send document/file message ────────────────────────────────────────────────
export async function sendFileMessage(
  chatId: string,
  senderId: string,
  fileUri: string,
  fileName: string,
  fileSize: number,
): Promise<{ success: boolean; messageId: string }> {
  try {
    const { uploadFile, generateFileName, getMimeType } = await import('../config/storage');
    const storageFileName = generateFileName(getFileExtension(fileUri));
    
    const fileUrl = await uploadFile(fileUri, 'chatMedia', {
      chatId,
      fileName: storageFileName,
    });
    
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) return { success: false, messageId: '' };
    
    const members: string[] = chatSnap.data().members ?? [];
    const otherMembers = members.filter((id) => id !== senderId);
    
    const batch = writeBatch(db);
    const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
    
    batch.set(msgRef, {
      messageId: msgRef.id,
      senderId,
      text: null,
      type: 'file',
      fileUrl,
      fileName,
      fileSize,
      mimeType: getMimeType(fileUri),
      timestamp: serverTimestamp(),
      readBy: [senderId],
    });
    
    const unreadUpdates = Object.fromEntries(
      otherMembers.map((id) => [`unreadCounts.${id}`, increment(1)])
    );
    
    batch.update(chatRef, {
      'lastMessage.text': `📎 ${fileName}`,
      'lastMessage.senderId': senderId,
      'lastMessage.timestamp': serverTimestamp(),
      ...unreadUpdates,
    });
    
    await batch.commit();
    return { success: true, messageId: msgRef.id };
  } catch (err) {
    console.error('sendFileMessage error:', err);
    return { success: false, messageId: '' };
  }
}
```

---

## Step 4: Add Media Picker UI to ChatScreen

### File: `src/screens/ChatScreen.tsx`

Add attachment button and picker modal:

```typescript
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { sendImageMessage, sendVideoMessage, sendFileMessage } from '../hooks/useChatActions';

// Add state for media picker
const [showMediaPicker, setShowMediaPicker] = useState(false);
const [uploading, setUploading] = useState(false);
const [uploadProgress, setUploadProgress] = useState(0);

// Media picker options
const mediaOptions = [
  { icon: 'camera', label: 'Camera', color: '#10b981', action: 'camera' },
  { icon: 'images', label: 'Gallery', color: '#3b82f6', action: 'gallery' },
  { icon: 'videocam', label: 'Video', color: '#8b5cf6', action: 'video' },
  { icon: 'document', label: 'Document', color: '#f59e0b', action: 'document' },
];

// Handle camera
const handleCamera = async () => {
  setShowMediaPicker(false);
  
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Camera permission is required');
    return;
  }
  
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });
  
  if (!result.canceled && result.assets[0]) {
    await handleImageUpload(result.assets[0].uri);
  }
};

// Handle gallery
const handleGallery = async () => {
  setShowMediaPicker(false);
  
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });
  
  if (!result.canceled && result.assets[0]) {
    await handleImageUpload(result.assets[0].uri);
  }
};

// Handle video
const handleVideo = async () => {
  setShowMediaPicker(false);
  
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
  });
  
  if (!result.canceled && result.assets[0]) {
    await handleVideoUpload(result.assets[0].uri, result.assets[0].duration);
  }
};

// Handle document
const handleDocument = async () => {
  setShowMediaPicker(false);
  
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  
  if (result.type === 'success') {
    await handleFileUpload(result.uri, result.name, result.size || 0);
  }
};

// Upload handlers
const handleImageUpload = async (uri: string) => {
  if (!userId) return;
  
  setUploading(true);
  try {
    const { success } = await sendImageMessage(chatId, userId, uri);
    if (!success) {
      Alert.alert('Upload failed', 'Could not send image');
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to send image');
  } finally {
    setUploading(false);
  }
};

const handleVideoUpload = async (uri: string, duration?: number) => {
  if (!userId) return;
  
  setUploading(true);
  try {
    const { success } = await sendVideoMessage(chatId, userId, uri, duration);
    if (!success) {
      Alert.alert('Upload failed', 'Could not send video');
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to send video');
  } finally {
    setUploading(false);
  }
};

const handleFileUpload = async (uri: string, name: string, size: number) => {
  if (!userId) return;
  
  setUploading(true);
  try {
    const { success } = await sendFileMessage(chatId, userId, uri, name, size);
    if (!success) {
      Alert.alert('Upload failed', 'Could not send file');
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to send file');
  } finally {
    setUploading(false);
  }
};

// Media picker modal
<Modal visible={showMediaPicker} transparent animationType="slide">
  <Pressable style={styles.modalOverlay} onPress={() => setShowMediaPicker(false)} />
  <View style={styles.mediaPickerSheet}>
    <View style={styles.mediaPickerHeader}>
      <Text style={styles.mediaPickerTitle}>Send Media</Text>
      <TouchableOpacity onPress={() => setShowMediaPicker(false)}>
        <Ionicons name="close" size={24} color={COLORS.text} />
      </TouchableOpacity>
    </View>
    
    <View style={styles.mediaOptionsGrid}>
      {mediaOptions.map((option) => (
        <TouchableOpacity
          key={option.action}
          style={styles.mediaOption}
          onPress={() => {
            if (option.action === 'camera') handleCamera();
            else if (option.action === 'gallery') handleGallery();
            else if (option.action === 'video') handleVideo();
            else if (option.action === 'document') handleDocument();
          }}
        >
          <View style={[styles.mediaIconWrap, { backgroundColor: option.color }]}>
            <Ionicons name={option.icon} size={28} color="#fff" />
          </View>
          <Text style={styles.mediaLabel}>{option.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
</Modal>

// Attachment button (add next to text input)
<TouchableOpacity 
  style={styles.attachButton}
  onPress={() => setShowMediaPicker(true)}
>
  <Ionicons name="add-circle" size={32} color={COLORS.blue} />
</TouchableOpacity>
```

---

## Step 5: Render Media Messages

Add message renderers for each type:

```typescript
// Image message
const renderImageMessage = (msg: Message) => (
  <TouchableOpacity onPress={() => openImageViewer(msg.imageUrl!)}>
    <Image 
      source={{ uri: msg.imageUrl! }}
      style={styles.messageImage}
      resizeMode="cover"
    />
  </TouchableOpacity>
);

// Video message
const renderVideoMessage = (msg: Message) => (
  <TouchableOpacity onPress={() => playVideo(msg.videoUrl!)}>
    <View style={styles.videoContainer}>
      <Image 
        source={{ uri: msg.thumbnailUrl || msg.videoUrl! }}
        style={styles.messageImage}
        resizeMode="cover"
      />
      <View style={styles.playButton}>
        <Ionicons name="play" size={32} color="#fff" />
      </View>
      {msg.duration && (
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>
            {formatDuration(msg.duration)}
          </Text>
        </View>
      )}
    </View>
  </TouchableOpacity>
);

// File/document message
const renderFileMessage = (msg: Message) => (
  <TouchableOpacity 
    style={styles.fileMessage}
    onPress={() => downloadFile(msg.fileUrl!, msg.fileName!)}
  >
    <View style={styles.fileIcon}>
      <Ionicons name="document" size={24} color={COLORS.blue} />
    </View>
    <View style={styles.fileInfo}>
      <Text style={styles.fileName} numberOfLines={1}>
        {msg.fileName}
      </Text>
      {msg.fileSize && (
        <Text style={styles.fileSize}>
          {formatFileSize(msg.fileSize)}
        </Text>
      )}
    </View>
    <Ionicons name="download" size={20} color={COLORS.blue} />
  </TouchableOpacity>
);

// In renderMessage, add switch for type
const renderMessageContent = (msg: Message) => {
  switch (msg.type) {
    case 'text':
      return <Text style={styles.messageText}>{msg.text}</Text>;
    case 'image':
      return renderImageMessage(msg);
    case 'video':
      return renderVideoMessage(msg);
    case 'voice':
      return renderVoiceMessage(msg);
    case 'file':
      return renderFileMessage(msg);
    default:
      return <Text style={styles.messageText}>{msg.text || '[Unsupported message]'}</Text>;
  }
};
```

---

## Step 6: Update Storage Rules

Make sure your Firebase Storage rules allow chat media uploads:

```javascript
match /chats/{chatId}/media/{allPaths=**} {
  allow read, write: if request.auth != null;
}
```

---

## Testing Checklist

- [ ] Send image from gallery
- [ ] Take photo with camera and send
- [ ] Send video from gallery
- [ ] Send PDF document
- [ ] Verify upload progress shows
- [ ] Verify media displays correctly
- [ ] Verify media downloads work
- [ ] Test on slow network
- [ ] Check file size limits

---

## Next Steps

1. Implement the types update
2. Add media sender functions
3. Add UI for media picker
4. Add media message renderers
5. Test each media type
6. Add image viewer/video player
7. Add download functionality

Would you like me to start implementing these changes step by step?
