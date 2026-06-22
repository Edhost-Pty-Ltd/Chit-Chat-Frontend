# Design Document: Merge Create Account UI

## Overview

This design document specifies the technical approach for merging UI styling improvements from the `create-account` branch into the `Frontend-FeaturesMJ` branch while preserving all existing functionality. The merge is a selective visual integration that applies blue-tinted glassmorphism design system changes without removing or breaking Firebase authentication, WebRTC calling, validation utilities, custom hooks, or any other existing features.

### Design Goals

1. **Preserve Functionality**: Maintain 100% of existing features including Firebase integration, WebRTC, custom hooks, validation utilities, and all user-facing functionality
2. **Apply Visual Improvements**: Integrate blue-tinted glassmorphism design consistently across all screens
3. **Add New Features**: Integrate new settings screens and toast notification component from create-account branch
4. **Ensure Build Success**: Maintain TypeScript compilation and successful builds for all platforms
5. **Maintain Navigation**: Preserve existing navigation structure while adding new routes for settings screens

### Scope

**In Scope:**
- Visual styling updates to all existing screens (glassmorphism, blue tints, enhanced shadows)
- Integration of new settings screens (AccountSettings, ChangeNumber, LinkedDevices, NotificationSettings, Notifications, PrivacySettings)
- Integration of Toast notification component
- Configuration file merging (package.json, app.json)
- Navigation route additions for new screens
- TypeScript type definition updates for new components

**Out of Scope:**
- Functional changes to Firebase authentication logic
- Changes to WebRTC implementation
- Modifications to custom hooks (useAuth, useRegistration, useChats, useMessages, etc.)
- Changes to validation utilities
- Modifications to existing context providers unless adding new non-conflicting features
- Rewriting or refactoring of existing business logic

## Architecture

### Merge Strategy Architecture

The merge follows a **selective integration** architecture with three layers:

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend-FeaturesMJ (Base)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Firebase • Hooks • WebRTC • Validation • Contexts    │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ▲                                  │
│                           │ Preserve All                     │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                   ┌────────┴─────────┐
                   │  Merge Strategy  │
                   │   (Selective)    │
                   └────────┬─────────┘
                            │
                            │ Extract & Apply
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Create-Account (Source for Styling)            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Blue-tinted Styling • Settings Screens • Toast UI    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Layer 1: Functionality Preservation Layer

**Responsibility**: Ensure all existing functional code remains intact

**Components**:
- **File Existence Check**: Verify that all files from Frontend-FeaturesMJ that don't exist in create-account are kept
- **Code Block Preservation**: Within files that exist in both branches, preserve functional code blocks (hooks, Firebase calls, validation)
- **Import Preservation**: Maintain all functional imports (hooks, validation utilities, Firebase config)
- **Type Definition Preservation**: Keep all existing TypeScript types and interfaces

**Files to Preserve Completely** (if deleted in create-account):
- All files in `src/hooks/` (useAuth.ts, useRegistration.ts, useChats.ts, useMessages.ts, useChatActions.ts, useContacts.ts, useWebRTC.ts, useVoiceRecorder.ts, useVoicePlayer.ts)
- All files in `src/utils/validationUtils.ts`
- `src/config/firebase.ts`
- `src/config/storage.ts`
- `src/components/AvatarPreview.tsx`
- All spec files in `.kiro/specs/*/`

### Layer 2: Style Extraction and Application Layer

**Responsibility**: Extract styling changes from create-account and apply to Frontend-FeaturesMJ screens

**Style Extraction Process**:

```typescript
// Pattern for extracting styles
interface StyleExtraction {
  // From create-account version
  source: {
    cardBackground: string;
    borderColor: string;
    shadowConfig: ShadowConfig;
    inputBackground: string;
  };
  // Apply to Frontend-FeaturesMJ version
  target: {
    preserveFunctionality: boolean;
    applyStylesOnly: boolean;
  };
}
```

**Key Style Changes**:

1. **Card Backgrounds**: `rgba(255,255,255,0.28)` → `transparent` or `rgba(180,225,245,0.22)` with blue borders
2. **Input Fields**: White backgrounds → `rgba(30,156,240,0.06)` with blue borders
3. **Borders**: Generic white → `rgba(30,156,240,0.18)` or `rgba(255,255,255,0.45)`
4. **Avatar Backgrounds**: White → Blue gradient for placeholders
5. **Icon Tiles**: Enhanced blue tint with stronger shadows
6. **Shadows**: Generic → Blue-tinted (`#0e6ea8`, `#1E9CF0`) with enhanced opacity and radius

### Layer 3: Component Integration Layer

**Responsibility**: Integrate new components and screens from create-account

**New Components to Integrate**:
- Toast notification component
- Any new UI components specific to settings screens

**New Screens to Integrate**:
- AccountSettingsScreen
- ChangeNumberScreen
- LinkedDevicesScreen
- NotificationSettingsScreen
- NotificationsScreen
- PrivacySettingsScreen

**Integration Process for New Screens**:
1. Copy screen file from create-account
2. Connect to existing Firebase implementation if needed
3. Add navigation routes
4. Update TypeScript types in navigation
5. Test navigation flow

## Components and Interfaces

### Merge Orchestrator

**Purpose**: Coordinates the entire merge process

```typescript
interface MergeOrchestrator {
  // Phase 1: Pre-merge verification
  verifyBaseBranch(): Promise<BranchState>;
  createBackup(): Promise<BackupReference>;
  
  // Phase 2: File-level merge
  identifyFilesToUpdate(): ScreenUpdateList;
  identifyFilesToPreserve(): FilePreservationList;
  identifyNewFiles(): NewFileList;
  
  // Phase 3: Screen updates
  updateScreen(screen: ScreenConfig): Promise<UpdateResult>;
  
  // Phase 4: Configuration merge
  mergePackageJson(): Promise<MergeResult>;
  mergeAppJson(): Promise<MergeResult>;
  
  // Phase 5: Verification
  verifyTypeScriptCompilation(): Promise<CompilationResult>;
  verifyBuild(): Promise<BuildResult>;
  verifyNavigation(): Promise<NavigationResult>;
  
  // Phase 6: Testing
  executeTestPlan(): Promise<TestResults>;
}
```

### Screen Update Processor

**Purpose**: Handles individual screen styling updates

```typescript
interface ScreenUpdateConfig {
  screenName: string;
  basePath: string; // Frontend-FeaturesMJ version
  stylePath: string; // create-account version
  preservationRules: PreservationRule[];
}

interface PreservationRule {
  type: 'import' | 'hook' | 'function' | 'handler';
  pattern: RegExp;
  action: 'keep' | 'merge';
}

interface ScreenUpdateProcessor {
  // Extract styles from create-account version
  extractStyles(stylePath: string): StyleDefinitions;
  
  // Read current Frontend-FeaturesMJ version
  readBaseScreen(basePath: string): ScreenCode;
  
  // Apply styles while preserving functionality
  applyStyles(
    base: ScreenCode,
    styles: StyleDefinitions,
    rules: PreservationRule[]
  ): UpdatedScreen;
  
  // Verify the updated screen
  verify(updated: UpdatedScreen): VerificationResult;
}

interface StyleDefinitions {
  cardStyles: StyleSheet;
  inputStyles: StyleSheet;
  buttonStyles: StyleSheet;
  layoutStyles: StyleSheet;
  colorOverrides: ColorMap;
  shadowOverrides: ShadowMap;
}
```

### File Conflict Resolver

**Purpose**: Determines what to keep when both branches modify the same file

```typescript
interface ConflictResolutionStrategy {
  // Decision tree for conflicts
  resolveConflict(conflict: FileConflict): ResolutionDecision;
}

interface FileConflict {
  filePath: string;
  baseVersion: string; // Frontend-FeaturesMJ
  incomingVersion: string; // create-account
  conflictType: 'deleted' | 'modified' | 'both-modified';
}

interface ResolutionDecision {
  action: 'keep-base' | 'take-incoming' | 'merge-manual' | 'merge-auto';
  reason: string;
  preservedElements?: string[]; // List of functional elements preserved
}

// Resolution Rules:
// 1. If file exists in base but not in incoming: KEEP BASE
// 2. If file is hook/validation/firebase config: KEEP BASE entirely
// 3. If file is screen/component: MERGE (apply styles, preserve logic)
// 4. If file is new settings screen: TAKE INCOMING (with Firebase connections)
// 5. If file is config (package.json, app.json): MERGE MANUAL (review dependencies)
```

### Style Consistency Validator

**Purpose**: Ensures consistent styling across all updated screens

```typescript
interface StyleConsistencyValidator {
  // Validation rules
  validateColorUsage(screens: Screen[]): ConsistencyReport;
  validateBorderRadius(screens: Screen[]): ConsistencyReport;
  validateShadows(screens: Screen[]): ConsistencyReport;
  validateSpacing(screens: Screen[]): ConsistencyReport;
  validateTypography(screens: Screen[]): ConsistencyReport;
  
  // Report inconsistencies
  generateReport(): StyleConsistencyReport;
}

interface ConsistencyReport {
  property: string;
  expectedValues: string[];
  deviations: Deviation[];
}

interface Deviation {
  screenName: string;
  line: number;
  actual: string;
  expected: string;
  suggestion: string;
}
```

### Navigation Integrator

**Purpose**: Adds new routes while preserving existing navigation

```typescript
interface NavigationIntegrator {
  // Read current navigation config
  readNavigationConfig(): NavigationConfig;
  
  // Add new routes for settings screens
  addRoutes(newRoutes: RouteDefinition[]): UpdatedNavigationConfig;
  
  // Update TypeScript types
  updateNavigationTypes(routes: RouteDefinition[]): TypeDefinitions;
  
  // Verify navigation
  verifyNavigation(): NavigationVerificationResult;
}

interface RouteDefinition {
  name: string;
  component: string;
  paramTypes?: Record<string, string>;
  parent?: string; // For nested navigation
}
```

### Configuration Merger

**Purpose**: Merges package.json and app.json safely

```typescript
interface ConfigurationMerger {
  // Package.json merging
  mergeDependencies(
    base: Dependencies,
    incoming: Dependencies
  ): MergedDependencies;
  
  // App.json merging
  mergeAppConfig(
    base: AppConfig,
    incoming: AppConfig
  ): MergedAppConfig;
  
  // Conflict resolution
  resolveVersionConflict(
    package: string,
    baseVersion: string,
    incomingVersion: string
  ): string;
}

interface MergedDependencies {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  conflicts: VersionConflict[];
  added: string[];
  removed: string[];
}
```

## Data Models

### Screen Metadata

```typescript
interface ScreenMetadata {
  name: string;
  path: string;
  category: 'auth' | 'chat' | 'call' | 'settings' | 'profile' | 'other';
  hasFirebaseIntegration: boolean;
  usesHooks: string[]; // List of hook names used
  usesValidation: boolean;
  requiresWebRTC: boolean;
  updateStatus: 'pending' | 'in-progress' | 'completed' | 'verified';
  appliedStyles: AppliedStyle[];
}

interface AppliedStyle {
  styleType: 'card' | 'input' | 'button' | 'shadow' | 'color' | 'layout';
  before: string;
  after: string;
  location: string; // Line number or style name
}
```

### Merge State

```typescript
interface MergeState {
  phase: 'pre-merge' | 'file-analysis' | 'screen-updates' | 'config-merge' | 'verification' | 'testing' | 'complete';
  backup: BackupReference;
  screensToUpdate: ScreenMetadata[];
  filesTo Preserve: string[];
  newFiles: string[];
  completedUpdates: string[];
  errors: MergeError[];
  warnings: MergeWarning[];
}

interface BackupReference {
  branch: string;
  commit: string;
  timestamp: string;
}

interface MergeError {
  type: 'compilation' | 'build' | 'navigation' | 'functionality';
  file: string;
  message: string;
  severity: 'critical' | 'high' | 'medium';
}

interface MergeWarning {
  type: 'style-inconsistency' | 'deprecated-usage' | 'type-mismatch';
  file: string;
  message: string;
  suggestion: string;
}
```

### Style Application Record

```typescript
interface StyleApplicationRecord {
  screenName: string;
  timestamp: string;
  stylesApplied: {
    cardBackgrounds: number; // Count of updates
    inputFields: number;
    buttons: number;
    borders: number;
    shadows: number;
    colors: number;
  };
  preservedElements: {
    imports: string[];
    hooks: string[];
    functions: string[];
    handlers: string[];
  };
  verificationStatus: 'passed' | 'failed' | 'pending';
}
```

## Error Handling

### Merge Error Categories

**1. File Conflict Errors**
- **Cause**: Both branches modify the same file in incompatible ways
- **Resolution**: Apply conflict resolution strategy based on file type
- **Fallback**: Manual review and merge

**2. TypeScript Compilation Errors**
- **Cause**: Type mismatches, missing imports, incorrect type definitions
- **Detection**: Run `tsc --noEmit` after each screen update
- **Resolution**: Fix imports, update type definitions, add missing types
- **Fallback**: Rollback to previous working state

**3. Build Errors**
- **Cause**: Missing native modules, configuration issues, dependency conflicts
- **Detection**: Run `expo prebuild` and platform-specific builds
- **Resolution**: Install missing dependencies, fix configuration
- **Fallback**: Rollback and re-evaluate merge strategy

**4. Navigation Errors**
- **Cause**: Missing routes, incorrect parameter types, broken navigation stack
- **Detection**: Runtime testing of navigation flows
- **Resolution**: Add missing routes, fix type definitions
- **Fallback**: Remove problematic routes temporarily

**5. Functionality Regression Errors**
- **Cause**: Accidentally removing or breaking existing features
- **Detection**: Functional testing (auth flow, messaging, calls)
- **Resolution**: Restore preserved code blocks, re-apply merge carefully
- **Fallback**: Rollback to backup

### Error Handling Strategy

```typescript
interface ErrorHandler {
  // Error detection
  detectErrors(phase: MergePhase): MergeError[];
  
  // Error resolution
  resolveError(error: MergeError): ResolutionResult;
  
  // Rollback on critical errors
  rollback(backup: BackupReference): Promise<void>;
  
  // Error reporting
  generateErrorReport(errors: MergeError[]): ErrorReport;
}

interface ResolutionResult {
  success: boolean;
  action: string;
  message: string;
  requiresManualIntervention: boolean;
}
```

### Validation Checkpoints

**After Each Screen Update**:
1. TypeScript compilation check
2. Import resolution check
3. Hook usage verification
4. Navigation parameter check

**After Configuration Merge**:
1. Dependency conflict check
2. Native module configuration check
3. Build configuration validation

**After All Updates**:
1. Full TypeScript compilation
2. Development build success
3. Navigation flow testing
4. Functional testing suite

## Testing Strategy

### Testing Approach for UI Merge

This is a **UI styling merge operation**, not a feature with algorithmic logic or data transformations. Therefore, **property-based testing (PBT) is NOT applicable** for this type of work.

**Why PBT is not appropriate**:
- This is a styling merge, not code with input/output behavior
- No universal properties exist across randomly generated styling values
- Visual appearance cannot be validated through property tests
- The merge is about applying specific design tokens, not testing transformations

**Appropriate Testing Strategies**:

#### 1. Manual Visual Testing
- **Purpose**: Verify that blue-tinted glassmorphism is applied correctly
- **Scope**: All updated screens
- **Method**: Visual inspection on device/emulator

**Test Cases**:
- Cards display transparent backgrounds with blue borders
- Input fields have blue-tinted backgrounds with proper borders
- Shadows use blue color (#0e6ea8, #1E9CF0) with proper opacity
- Avatar placeholders use blue gradients instead of white
- Icon tiles have enhanced blue tint and shadows
- All screens have consistent color values and styling

#### 2. Functional Regression Testing
- **Purpose**: Ensure no existing functionality is broken
- **Scope**: Authentication, messaging, calls, contacts, navigation
- **Method**: Manual testing of critical user flows

**Critical Flows to Test**:

**Authentication Flow**:
- Sign in with phone number → OTP → Success
- Create account → Phone verification → OTP → Biometric → Profile creation → Success
- Sign out → Return to splash

**Messaging Flow**:
- Open chat list → See existing chats
- Open conversation → Send text message → Receive message
- Record voice note → Send → Play back
- Receive voice note → Play

**Call Flow** (if WebRTC configured):
- Initiate voice call → Connect → End call
- Initiate video call → Connect → Camera works → End call
- Receive incoming call → Accept → Connect

**Contacts Flow**:
- Open contacts screen → See contact list
- Select contact → Open chat with contact

**Settings Flow**:
- Open settings → Navigate to new settings screens
- Test each new screen (Account, Privacy, Notifications, etc.)
- Navigate back successfully

**Navigation Flow**:
- Navigate to all screens from home
- Back button works correctly on all screens
- Deep linking works (if configured)

#### 3. Build Verification Testing
- **Purpose**: Ensure the app builds successfully
- **Scope**: TypeScript compilation, Expo build, platform-specific builds

**Build Tests**:
- `npx tsc --noEmit` → Zero errors
- `npm run start` → Dev server starts without errors
- `npm run android` → Android build succeeds
- `npm run ios` → iOS build succeeds (if applicable)

#### 4. TypeScript Type Safety Testing
- **Purpose**: Ensure type safety is maintained
- **Scope**: All updated files, navigation types

**Type Tests**:
- All imports resolve correctly
- Navigation parameter types are correct
- Hook return types match usage
- Component props have correct types
- No `any` types introduced unnecessarily

#### 5. Style Consistency Testing
- **Purpose**: Verify consistent styling across screens
- **Scope**: All updated screens

**Consistency Checks**:
- Blue color values consistent (`#1E9CF0`, `rgba(30,156,240,...)`)
- Border radius values consistent (RADIUS.sm, md, lg, xl)
- Shadow configurations consistent (SHADOW.card, button, glow)
- Spacing values consistent
- Typography consistent (font sizes, weights, colors)

### Test Execution Plan

**Phase 1: Per-Screen Testing** (After each screen update)
1. TypeScript compilation check
2. Visual inspection of updated screen
3. Test interactive elements on that screen
4. Verify navigation to/from that screen

**Phase 2: Integration Testing** (After all screens updated)
1. Full TypeScript compilation
2. Build verification (dev build)
3. Complete functional flow testing
4. Style consistency validation

**Phase 3: Regression Testing** (Before marking merge complete)
1. Authentication flow (sign in, create account, sign out)
2. Messaging flow (send/receive messages, voice notes)
3. Call flow (if applicable)
4. Contacts flow
5. Settings flow (including new screens)
6. Navigation flow (all screens accessible)

**Phase 4: Platform Testing** (Final verification)
1. Android device/emulator testing
2. iOS device/simulator testing (if applicable)
3. Web browser testing (if applicable)

### Test Result Documentation

For each testing phase, document:
- Screens tested
- Features verified
- Issues found
- Issues resolved
- Remaining issues (if any)
- Screenshots of visual changes

### Acceptance Criteria for Testing

**Merge is considered successful when**:
1. All screens display blue-tinted glassmorphism styling
2. Zero TypeScript compilation errors
3. Build succeeds on all target platforms
4. All functional flows work without errors
5. Navigation works correctly to all screens
6. No visual inconsistencies across screens
7. All new settings screens are accessible and functional

## Implementation Phases

### Phase 1: Pre-Merge Preparation

**Tasks**:
1. Create backup branch or tag from Frontend-FeaturesMJ
2. Document current state of all screens
3. Identify all files in both branches
4. Create screen update checklist
5. Set up TypeScript compilation watcher

**Verification**:
- Backup successfully created
- Screen checklist complete
- File inventory complete

### Phase 2: File Analysis and Categorization

**Tasks**:
1. Categorize files into: preserve-entirely, update-styling, take-new, merge-config
2. Identify screens requiring UI updates
3. Identify new screens to integrate
4. Analyze configuration file differences

**Verification**:
- All files categorized
- No ambiguous files remain
- Configuration differences documented

### Phase 3: Screen Updates (Systematic)

**For each screen in checklist**:
1. Extract styling from create-account version
2. Apply styling to Frontend-FeaturesMJ version
3. Preserve all imports, hooks, functions, handlers
4. Run TypeScript compilation
5. Test screen functionality
6. Document changes applied

**Screen Update Order** (by category):
1. Authentication screens (SignIn, CreateAccount)
2. Main screens (Chats, Chat, Calls, Status)
3. Secondary screens (Contacts, Profile)
4. Utility screens (Calendar, Notes, CloudBackup)
5. Settings screens (Settings, Appearance)

**Verification per screen**:
- Styling applied correctly
- No compilation errors
- Functionality preserved
- Navigation works

### Phase 4: New Screen Integration

**For each new settings screen**:
1. Copy screen file from create-account
2. Connect to Firebase if needed (authentication, Firestore)
3. Add navigation route in AppNavigator
4. Update RootStackParamList type definition
5. Test screen accessibility
6. Test navigation to/from screen

**New Screens to Integrate**:
- AccountSettingsScreen
- ChangeNumberScreen
- LinkedDevicesScreen
- NotificationSettingsScreen
- NotificationsScreen
- PrivacySettingsScreen

**Verification**:
- Screen accessible from Settings
- Firebase integration works (if applicable)
- Navigation types correct
- Back navigation works

### Phase 5: Component Integration

**Tasks**:
1. Integrate Toast notification component
2. Update any shared components with new styling
3. Verify component usage across screens

**Verification**:
- Toast component works
- Components display correctly
- No prop type errors

### Phase 6: Configuration Merge

**Tasks**:
1. Merge package.json dependencies
   - Keep all Firebase dependencies
   - Keep all WebRTC dependencies
   - Add new UI-related dependencies if needed
2. Merge app.json configuration
   - Preserve Firebase configuration
   - Adopt UI-related config changes
3. Resolve version conflicts
4. Run `npm install` or `yarn install`

**Verification**:
- No dependency conflicts
- All required packages installed
- Native modules configured correctly

### Phase 7: Navigation Updates

**Tasks**:
1. Add routes for new settings screens
2. Update RootStackParamList type
3. Test navigation to all screens
4. Verify deep linking (if configured)

**Verification**:
- All screens accessible
- Navigation types correct
- Back navigation works
- Deep linking works

### Phase 8: Comprehensive Verification

**Tasks**:
1. Full TypeScript compilation
2. Development build verification
3. Platform-specific build verification
4. Style consistency validation
5. Functional regression testing

**Verification**:
- Zero TypeScript errors
- Builds succeed
- All styles consistent
- All features work

### Phase 9: Testing and Validation

**Tasks**:
1. Execute test plan (manual functional testing)
2. Document test results
3. Fix any issues found
4. Re-test until all issues resolved

**Verification**:
- All test cases pass
- No critical issues remain
- Test results documented

### Phase 10: Final Review and Completion

**Tasks**:
1. Review all changes applied
2. Verify merge completion checklist
3. Document merge summary
4. Create final verification report

**Verification**:
- All requirements met
- Merge completion checklist passed
- Documentation complete

## Rollback Strategy

### Rollback Scenarios

**Scenario 1: Critical Compilation Errors**
- **Trigger**: TypeScript compilation fails after multiple fix attempts
- **Action**: Rollback to backup, re-evaluate merge strategy
- **Prevention**: Run compilation after each screen update

**Scenario 2: Build Failures**
- **Trigger**: Platform builds fail with unresolvable errors
- **Action**: Rollback configuration changes, investigate dependency issues
- **Prevention**: Carefully review dependency changes before installing

**Scenario 3: Functionality Broken**
- **Trigger**: Core features (auth, messaging, calls) stop working
- **Action**: Rollback specific screen or file causing the issue
- **Prevention**: Test functionality after each screen update

**Scenario 4: Extensive Issues Found**
- **Trigger**: Multiple critical issues across different areas
- **Action**: Full rollback to backup, restart merge with revised strategy
- **Prevention**: Follow systematic approach, test incrementally

### Rollback Process

```bash
# Full rollback to backup
git checkout <backup-branch-or-commit>

# Partial rollback of specific file
git checkout <backup-branch-or-commit> -- <file-path>

# Partial rollback of specific screens
git checkout <backup-branch-or-commit> -- src/screens/CreateAccountScreen.tsx
git checkout <backup-branch-or-commit> -- src/screens/SignInScreen.tsx
```

### Post-Rollback Actions

1. Document what went wrong
2. Analyze root cause
3. Revise merge strategy
4. Retry with improved approach
5. Add additional verification checkpoints

## Style Guide for Merge

### Color Constants

Use these exact values from theme.ts for consistency:

**Primary Blue**:
- `COLORS.blue` = `#1E9CF0`
- `COLORS.blueDark` = `#0a72c4`
- `COLORS.blueGlow` = `rgba(30,156,240,0.30)`

**Glass Surfaces**:
- `COLORS.glass` = `rgba(255,255,255,0.18)`
- `COLORS.glassMid` = `rgba(255,255,255,0.24)`
- `COLORS.glassHigh` = `rgba(255,255,255,0.30)`
- `COLORS.glassBorder` = `rgba(255,255,255,0.45)`
- `COLORS.glassBorderSub` = `rgba(30,156,240,0.20)`

**Input Backgrounds**:
- `rgba(30,156,240,0.06)` for input fields
- `rgba(180,225,245,0.18)` for glass inputs

**Card Backgrounds**:
- `rgba(180,225,245,0.22)` for standard cards
- `rgba(180,225,245,0.28)` for elevated cards

### Shadow Constants

Use these exact values from theme.ts:

**Card Shadow**:
```typescript
{
  shadowColor: '#0e6ea8',
  shadowOffset: { width: 2, height: 4 },
  shadowOpacity: 0.18,
  shadowRadius: 10,
  elevation: 4,
}
```

**Button Shadow**:
```typescript
{
  shadowColor: '#1E9CF0',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.40,
  shadowRadius: 12,
  elevation: 10,
}
```

**Glow Shadow**:
```typescript
{
  shadowColor: '#1E9CF0',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.45,
  shadowRadius: 20,
  elevation: 14,
}
```

### Border Radius Constants

Use RADIUS from theme.ts:
- `RADIUS.sm = 10`
- `RADIUS.md = 14`
- `RADIUS.lg = 18`
- `RADIUS.xl = 24`
- `RADIUS.full = 999`

### Common Style Patterns

**Glass Card**:
```typescript
{
  backgroundColor: 'rgba(180,225,245,0.22)',
  borderRadius: RADIUS.xl,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.45)',
  ...SHADOW.card,
}
```

**Glass Input**:
```typescript
{
  backgroundColor: 'rgba(30,156,240,0.06)',
  borderRadius: RADIUS.md,
  borderWidth: 1,
  borderColor: 'rgba(30,156,240,0.18)',
  paddingHorizontal: 12,
  paddingVertical: 13,
}
```

**Icon Tile (Blue Tinted)**:
```typescript
{
  width: 34,
  height: 34,
  borderRadius: 10,
  backgroundColor: 'rgba(30,156,240,0.12)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.50)',
  borderTopColor: 'rgba(255,255,255,0.75)',
  shadowColor: '#1E9CF0',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.25,
  shadowRadius: 6,
  elevation: 4,
  alignItems: 'center',
  justifyContent: 'center',
}
```

**OTP Box (Filled)**:
```typescript
{
  borderColor: COLORS.blue,
  backgroundColor: 'rgba(30,156,240,0.12)',
  shadowColor: COLORS.blue,
  shadowOpacity: 0.30,
}
```

## Conclusion

This design provides a comprehensive technical approach for merging UI styling improvements from the create-account branch into Frontend-FeaturesMJ while preserving all existing functionality. The systematic, phased approach with verification checkpoints at each stage ensures a successful merge with minimal risk of breaking changes. The testing strategy focuses on appropriate validation methods for a UI merge operation: visual testing, functional regression testing, build verification, and style consistency validation rather than property-based testing which is not applicable to this type of work.
