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
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, GRADIENTS } from '../types/theme';
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

    // No image → initials with blue gradient background
    const initials = getInitials(username);

    return (
      <View style={[styles.initialsCircle, circleStyle]}>
        <LinearGradient 
          colors={GRADIENTS.primary}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
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
