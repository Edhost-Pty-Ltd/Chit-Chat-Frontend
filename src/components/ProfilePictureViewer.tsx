// ─── Profile Picture Viewer ──────────────────────────────────────────────────
// WhatsApp-style expand: the photo zooms up while a dark backdrop fades in.
// Rendered inside a transparent Modal so it reliably overlays any screen.
import React, { useEffect, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Dimensions,
  Animated, Modal, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, AppIcon, useTypography } from '../context/ThemeContext';

const { width } = Dimensions.get('window');
const IMAGE_SIZE = width;

interface ProfilePictureViewerProps {
  visible: boolean;
  imageUri: string | null;
  displayName: string;
  onClose: () => void;
}

export function ProfilePictureViewer({
  visible, imageUri, displayName, onClose,
}: ProfilePictureViewerProps) {
  const insets = useSafeAreaInsets();
  const { fontFamily } = useTypography();

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, progress]);

  if (!imageUri) return null;

  const backdropStyle = { opacity: progress };
  const contentStyle = {
    opacity: progress,
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.4, 1],
        }),
      },
    ],
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Dark backdrop — tap anywhere to collapse */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Zooming image */}
        <View style={styles.imageContainer} pointerEvents="box-none">
          <Animated.Image
            source={{ uri: imageUri }}
            style={[styles.image, contentStyle]}
            resizeMode="contain"
          />
        </View>

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppIcon glass tileSize={36} name="close" size={20} fixedColor color="#fff" />
          </TouchableOpacity>
          <AppText fixedColor style={[styles.headerTitle, { fontFamily }]} numberOfLines={1}>
            {displayName}
          </AppText>
          <View style={{ width: 36 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
  },
});
