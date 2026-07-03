# Update App Icon Guide

## ✅ What's Been Done

1. **Removed Test Panel**
   - Removed `NotificationTestPanel` import from `ChatsScreen.tsx`
   - Removed `<NotificationTestPanel />` component from the screen

2. **Updated app.json**
   - Changed main icon reference from `chitchat-logo.png` to `icon.png`
   - Changed Android adaptive icon foreground from `chitchat-logo.png` to `icon.png`

## 📱 Regenerate Icon Assets

Since you've replaced `icon.png` with your custom logo, you need to regenerate the platform-specific icon files. Follow these steps:

### For Expo Development Builds

**Option 1: Using npx expo-generate-assets (Recommended)**
```bash
# Install the package if you haven't already
npm install -g @expo/image-utils

# Generate iOS and Android assets from your icon.png
npx expo-prebuild --clean
```

**Option 2: Rebuild the app**
```bash
# For Android
npx expo run:android

# For iOS
npx expo run:ios
```

### Requirements for icon.png

Your custom icon should meet these specifications:
- **Size**: 1024x1024 pixels (minimum)
- **Format**: PNG with transparent background (recommended)
- **Shape**: Square
- **Safe area**: Keep important content within the center 80% to avoid clipping on rounded corners

### Android Adaptive Icon

Android uses an adaptive icon system with:
- **Foreground**: Your main icon (`icon.png`)
- **Background**: Solid color or image (`android-icon-background.png`)
- **Monochrome**: Single-color version for themed icons (`android-icon-monochrome.png`)

If you want to update the background and monochrome versions:
1. Update `android-icon-background.png` (108x108px or larger)
2. Update `android-icon-monochrome.png` (single-color version of your logo)

### iOS Icon

iOS automatically generates all required icon sizes from the main `icon.png` file. The main icon will be:
- Rounded by the system
- Displayed at various sizes (20x20 to 1024x1024)

### Clearing Cache

After updating the icon, clear the build cache:

```bash
# Clear Metro bundler cache
npx expo start -c

# For Android - clear build cache
cd android
.\gradlew clean
cd ..

# For iOS - clean build
cd ios
rm -rf build
pod cache clean --all
cd ..
```

## 🔍 Verify Icon Changes

### Development Build
```bash
# Start the dev server with cache cleared
npx expo start -c

# Then rebuild for your platform
npx expo run:android
# or
npx expo run:ios
```

### Production Build
```bash
# For EAS Build
eas build --platform android
eas build --platform ios
```

## Common Issues

### Icon not updating on device

**Problem**: Old icon still shows after replacing `icon.png`

**Solutions**:
1. Clear Metro bundler cache: `npx expo start -c`
2. Rebuild the app completely: `npx expo run:android --clean`
3. Uninstall the app from device and reinstall
4. On Android, clear app data and cache in Settings

### Android adaptive icon looks wrong

**Problem**: Icon appears clipped or doesn't fit properly

**Solutions**:
1. Ensure your icon has adequate padding (safe zone in center 80%)
2. Update `backgroundColor` in app.json to complement your icon
3. Provide a custom `backgroundImage` instead of solid color
4. Adjust the `foregroundImage` to have transparent background

### Icon resolution too low

**Problem**: Icon appears blurry on high-resolution devices

**Solution**:
- Use at least 1024x1024px for the source icon.png
- Provide higher resolution (2048x2048px) for best quality
- Ensure image is not upscaled from a smaller original

## Current Configuration

**app.json settings**:
```json
{
  "icon": "./assets/icon.png",
  "android": {
    "adaptiveIcon": {
      "backgroundColor": "#E6F4FE",
      "foregroundImage": "./assets/icon.png",
      "backgroundImage": "./assets/android-icon-background.png",
      "monochromeImage": "./assets/android-icon-monochrome.png"
    }
  },
  "plugins": [
    ["expo-notifications", {
      "icon": "./assets/icon.png"
    }]
  ]
}
```

## Files Involved

- ✅ `assets/icon.png` - Main app icon (you've already replaced this)
- ✅ `app.json` - Updated to reference `icon.png`
- `assets/android-icon-background.png` - Android adaptive icon background
- `assets/android-icon-monochrome.png` - Android adaptive icon monochrome
- `assets/favicon.png` - Web favicon

## Next Steps

1. **Verify icon.png**: Make sure your custom icon is at least 1024x1024px
2. **Clear cache**: Run `npx expo start -c`
3. **Rebuild**: Run `npx expo run:android` or `npx expo run:ios`
4. **Check device**: Uninstall old app and install fresh build
5. **(Optional)** Update Android adaptive icon assets if needed

## Testing

After rebuilding:
- **Home Screen**: Check the app icon on device home screen
- **App Switcher**: Verify icon appears in recent apps
- **Notifications**: Check notification icon (uses icon.png)
- **Splash Screen**: Verify splash screen uses correct icon
- **Settings**: Check icon in device app settings

## Additional Resources

- [Expo Icons Documentation](https://docs.expo.dev/versions/v56.0.0/guides/app-icons/)
- [Android Adaptive Icons](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)
- [iOS App Icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)
