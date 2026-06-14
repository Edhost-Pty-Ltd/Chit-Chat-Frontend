// ─── Avatar Preview Component ────────────────────────────────────────────────
// Displays a circular avatar with image, initials, or fallback "?" character.
// Used in the registration/profile flow for avatar selection preview.

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { COLORS, RADIUS } from '../types/theme';
import { getInitials, getAvatarColor } from '../utils/avatarUtils';

// ─── Props ───────────────────────────────────────────────────────────────────
interface AvatarPreviewProps {
  imageUri: string | null;
  username: string;
  size?: number;
  onPress?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function AvatarPreview({
  imageUri,
  username,
  size = 100,
  onPress,
}: AvatarPreviewProps) {
  const circleStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const renderContent = () => {
    if (imageUri) {
      // Image provided → circular image
      return (
        <Image
          source={{ uri: imageUri }}
          style={[styles.image, circleStyle]}
          resizeMode="cover"
        />
      );
    }

    // No image → initials or fallback
    const initials = getInitials(username);
    const backgroundColor = getAvatarColor(username);

    return (
      <View style={[styles.initialsCircle, circleStyle, { backgroundColor }]}>
        <Text style={[styles.initialsText, { fontSize: Math.round(size * 0.4) }]}>
          {initials}
        </Text>
      </View>
    );
  };

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.75} onPress={onPress}>
        {renderContent()}
      </TouchableOpacity>
    );
  }

  return renderContent();
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  image: {
    borderWidth: 2,
    borderColor: COLORS.glassBorder,
  },
  initialsCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.glassBorder,
  },
  initialsText: {
    color: COLORS.white,
    fontWeight: '700',
  },
});
