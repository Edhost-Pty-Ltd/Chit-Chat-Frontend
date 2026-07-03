# Fix Metro Bundler Crash (Exit Code -1073740791)

## Problem
The Android release build is failing during the JavaScript bundling phase with error code `-1073740791` (Windows STATUS_STACK_BUFFER_OVERRUN). This is a Metro bundler crash, not a Gradle memory issue.

## ✅ Solutions (Try in Order)

### Solution 1: Increase Node.js Memory Limit

Metro bundler runs in Node.js and may need more memory for release builds.

**Create/Edit `.npmrc` file in project root:**

```bash
# In project root
echo node-options=--max-old-space-size=8192 > .npmrc
```

Or manually create `.npmrc` with this content:
```
node-options=--max-old-space-size=8192
```

### Solution 2: Set Node Options via Environment Variable

**Windows PowerShell:**
```powershell
$env:NODE_OPTIONS="--max-old-space-size=8192"
cd android
.\gradlew assembleRelease
```

**Windows CMD:**
```cmd
set NODE_OPTIONS=--max-old-space-size=8192
cd android
gradlew assembleRelease
```

### Solution 3: Use expo-cli for Bundling

Instead of using Gradle's bundler, use Expo's CLI:

```bash
# Clear Metro cache first
npx expo start --clear

# Build release bundle separately
npx expo export --platform android

# Then build the APK
cd android
.\gradlew assembleRelease --no-daemon
```

### Solution 4: Disable Hermes (Temporary Test)

Edit `android/gradle.properties`:
```properties
hermesEnabled=false
```

Then rebuild:
```bash
cd android
.\gradlew clean
.\gradlew assembleRelease
```

**Note:** Re-enable Hermes after testing, as it provides better performance.

### Solution 5: Clear All Caches

```bash
# Clear Metro bundler cache
npx expo start --clear

# Clear Gradle cache
cd android
.\gradlew clean
.\gradlew cleanBuildCache

# Clear node modules
cd ..
rm -rf node_modules
npm install

# Clear watchman (if installed)
watchman watch-del-all
```

### Solution 6: Reduce Parallelization

Edit `android/gradle.properties`:
```properties
# Reduce worker threads for Metro
org.gradle.workers.max=1

# Disable parallel execution during bundling
org.gradle.parallel=false
```

### Solution 7: Use Development Build Instead

If release build keeps failing, use a development build for testing:

```bash
# Development build (works with Metro dev server)
cd android
.\gradlew assembleDebug
```

Or use Expo:
```bash
npx expo run:android --variant debug
```

## Quick Fix (Recommended)

Try this command sequence:

```powershell
# Step 1: Set Node memory limit
$env:NODE_OPTIONS="--max-old-space-size=8192"

# Step 2: Clear everything
npx expo start --clear
cd android
.\gradlew clean

# Step 3: Build with no daemon (fresh process)
.\gradlew assembleRelease --no-daemon

# If that fails, try debug build
.\gradlew assembleDebug
```

## Understanding the Error

**Error Code `-1073740791` (0xC0000409)**:
- Windows STATUS_STACK_BUFFER_OVERRUN
- Indicates a crash in the Metro bundler process
- Usually caused by:
  - Insufficient Node.js heap memory
  - Large JavaScript bundle size
  - Memory fragmentation
  - Circular dependencies

**When it happens**:
- During `createBundleReleaseJsAndAssets` task
- Metro is transforming and bundling JavaScript files
- Release builds are larger than debug builds (includes optimizations)

## Preventing Future Issues

### 1. Keep Dependencies Updated
```bash
npx expo install --fix
npm update
```

### 2. Monitor Bundle Size
```bash
# Analyze bundle size
npx react-native-bundle-visualizer
```

### 3. Use Code Splitting
For large apps, consider lazy loading screens:
```typescript
const LazyScreen = React.lazy(() => import('./LargeScreen'));
```

### 4. Remove Unused Dependencies
```bash
npm prune
npx expo install --check
```

## Alternative: Build with EAS

If local builds keep failing, use Expo's cloud build service:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build in the cloud (no local memory issues)
eas build --platform android --profile production
```

## Troubleshooting Steps

### Check Node.js Version
```bash
node --version
# Should be 18.x or 20.x
```

### Check Available Memory
Open Task Manager (Ctrl+Shift+Esc) and ensure:
- At least 4GB free RAM
- Close memory-intensive applications

### Check for Circular Dependencies
```bash
npm install -g madge
madge --circular --extensions ts,tsx ./src
```

### Verbose Build Output
```bash
cd android
.\gradlew assembleRelease --info --stacktrace
```

Look for the exact error before the crash.

## Current Build Configuration

Your `android/gradle.properties` has:
- `org.gradle.jvmargs=-Xmx4096m` ✅ Good Gradle memory
- `reactNativeArchitectures=armeabi-v7a,arm64-v8a` ✅ Reasonable
- `hermesEnabled=true` ✅ Good for performance
- `org.gradle.workers.max=2` ✅ Conservative

The issue is likely in the **Node.js** process running Metro, not Gradle itself.

## Success Indicators

After applying fixes, you should see:
```
> Task :app:createBundleReleaseJsAndAssets
info Writing bundle output to:, android/app/build/generated/assets/react/release/index.android.bundle
info Done writing bundle output
info Copying 74 asset files
info Done copying assets
BUILD SUCCESSFUL
```

## If Nothing Works

1. **Try debug build** for now:
   ```bash
   cd android
   .\gradlew assembleDebug
   ```

2. **Use EAS Build** (cloud):
   ```bash
   eas build --platform android
   ```

3. **Build on different machine** with more RAM

4. **Reduce app complexity**:
   - Comment out large features temporarily
   - Build incrementally
   - Identify which code causes the crash
