// ─── AppNavigator Unit Tests: Profile Gating ─────────────────────────────────
// Tests: profile existence check gates navigation to Chats vs CreateAccount
// Requirements: 5.2, 5.3, 5.4, 5.5

import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

// Enable act() environment for React 19 test renderer
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// ─── Mock react-native ────────────────────────────────────────────────────────

jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('View', props, props.children),
    Text: (props: any) => React.createElement('Text', props, props.children),
    ActivityIndicator: (props: any) => React.createElement('ActivityIndicator', props),
    TouchableOpacity: (props: any) =>
      React.createElement('TouchableOpacity', props, props.children),
    StyleSheet: {
      create: (styles: any) => styles,
    },
  };
});

// ─── Mock theme modules ───────────────────────────────────────────────────────

jest.mock('../../types/theme', () => ({
  COLORS: {
    blue: '#007AFF',
    text: '#FFFFFF',
    sub: '#AAAAAA',
    white: '#FFFFFF',
  },
}));

jest.mock('../../context/ThemeContext', () => {
  const React = require('react');
  return {
    AppBg: () => React.createElement('AppBg'),
  };
});

// ─── Mock AuthContext ─────────────────────────────────────────────────────────

let mockAuthValue = { isSignedIn: false, loading: false };

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuthValue,
}));

// ─── Mock @react-native-firebase/auth ─────────────────────────────────────────

const mockCurrentUser = { uid: 'test-uid-123' };

jest.mock('@react-native-firebase/auth', () => {
  const authFn = () => ({
    currentUser: mockCurrentUser,
  });
  return { __esModule: true, default: authFn };
});

// ─── Mock firebase/firestore ──────────────────────────────────────────────────

const mockGetDoc = jest.fn();
const mockDoc = jest.fn().mockReturnValue({ id: 'test-uid-123', path: 'users/test-uid-123' });

jest.mock('firebase/firestore', () => ({
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
}));

// ─── Mock firebase config ─────────────────────────────────────────────────────

jest.mock('../../config/firebase', () => ({
  db: { type: 'mock-firestore-db' },
}));

// ─── Mock @react-navigation/native-stack ──────────────────────────────────────
// Instead of rendering a real navigator, mock the stack to capture what screens
// get registered and which is the initial route.

const mockScreens: Array<{ name: string; component: any }> = [];
let mockInitialRouteName: string | undefined;

jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children, initialRouteName }: any) => {
        mockInitialRouteName = initialRouteName;
        mockScreens.length = 0;
        // Flatten children (may be arrays from fragments)
        const flatten = (nodes: any): any[] => {
          if (!nodes) return [];
          if (Array.isArray(nodes)) return nodes.flatMap(flatten);
          if (nodes.props && nodes.props.children) {
            return flatten(nodes.props.children);
          }
          return [nodes];
        };
        const screens = flatten(children);
        screens.forEach((child: any) => {
          if (child && child.props && child.props.name) {
            mockScreens.push({ name: child.props.name, component: child.props.component });
          }
        });
        return React.createElement('Navigator', { initialRouteName }, null);
      },
      Screen: ({ name, component }: any) => {
        return React.createElement('Screen', { name, component });
      },
    }),
  };
});

// ─── Mock all screen components ───────────────────────────────────────────────

jest.mock('../../screens/SplashScreen', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('SplashScreen') };
});
jest.mock('../../screens/SignInScreen', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('SignInScreen') };
});
jest.mock('../../screens/ChatsScreen', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('ChatsScreen') };
});
jest.mock('../../screens/ChatScreen', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('ChatScreen') };
});
jest.mock('../../screens/CallsScreen', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('CallsScreen') };
});
jest.mock('../../screens/StatusScreen', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('StatusScreen') };
});
jest.mock('../../screens/ContactsScreen', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('ContactsScreen') };
});
jest.mock('../../screens/CalendarScreen', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('CalendarScreen') };
});
jest.mock('../../screens/NotesScreen', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('NotesScreen') };
});
jest.mock('../../screens/CloudBackupScreen', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('CloudBackupScreen') };
});
jest.mock('../../screens/SettingsScreen', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('SettingsScreen') };
});
jest.mock('../../screens/AppearanceScreen', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('AppearanceScreen') };
});
jest.mock('../../screens/ProfileScreen', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('ProfileScreen') };
});
jest.mock('../../screens/CreateAccountScreen', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('CreateAccountScreen') };
});
jest.mock('../../screens/VideoCallScreen', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('VideoCallScreen') };
});
jest.mock('../../screens/AudioCallScreen', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('AudioCallScreen') };
});

// ─── Import after mocks ──────────────────────────────────────────────────────

import AppNavigator from '../AppNavigator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Flush microtask queue so async useEffect callbacks complete
 */
function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('AppNavigator — profile gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScreens.length = 0;
    mockInitialRouteName = undefined;
    mockAuthValue = { isSignedIn: false, loading: false };
    mockGetDoc.mockReset();
  });

  // ── Requirement 5.4: Loading state shows indicator ──
  describe('loading state (Req 5.4)', () => {
    it('shows ActivityIndicator while auth context is loading', () => {
      mockAuthValue = { isSignedIn: false, loading: true };

      let tree: ReactTestRenderer;
      act(() => {
        tree = create(<AppNavigator />);
      });

      const root = tree!.root;
      const indicators = root.findAllByType('ActivityIndicator' as any);
      expect(indicators.length).toBeGreaterThan(0);
    });

    it('shows ActivityIndicator while profile check is in progress', async () => {
      // getDoc never resolves to simulate loading
      mockGetDoc.mockReturnValue(new Promise(() => {}));
      mockAuthValue = { isSignedIn: true, loading: false };

      let tree: ReactTestRenderer;
      await act(async () => {
        tree = create(<AppNavigator />);
      });

      const root = tree!.root;
      const indicators = root.findAllByType('ActivityIndicator' as any);
      expect(indicators.length).toBeGreaterThan(0);
    });
  });

  // ── Requirement 5.2: authenticated + profile exists → Chats ──
  describe('authenticated + profile exists (Req 5.2)', () => {
    it('renders navigator with Chats as initial route when profile exists', async () => {
      mockAuthValue = { isSignedIn: true, loading: false };
      mockGetDoc.mockResolvedValue({ exists: () => true });

      let tree: ReactTestRenderer;
      await act(async () => {
        tree = create(<AppNavigator />);
        await flushPromises();
      });

      expect(mockInitialRouteName).toBe('Chats');
      const screenNames = mockScreens.map(s => s.name);
      expect(screenNames).toContain('Chats');
    });

    it('calls getDoc with correct user document path', async () => {
      mockAuthValue = { isSignedIn: true, loading: false };
      mockGetDoc.mockResolvedValue({ exists: () => true });

      await act(async () => {
        create(<AppNavigator />);
        await flushPromises();
      });

      expect(mockDoc).toHaveBeenCalledWith(
        { type: 'mock-firestore-db' },
        'users',
        'test-uid-123'
      );
      expect(mockGetDoc).toHaveBeenCalled();
    });
  });

  // ── Requirement 5.3: authenticated + no profile → CreateAccount ──
  describe('authenticated + no profile (Req 5.3)', () => {
    it('renders navigator with CreateAccount as initial route when no profile', async () => {
      mockAuthValue = { isSignedIn: true, loading: false };
      mockGetDoc.mockResolvedValue({ exists: () => false });

      let tree: ReactTestRenderer;
      await act(async () => {
        tree = create(<AppNavigator />);
        await flushPromises();
      });

      expect(mockInitialRouteName).toBe('CreateAccount');
      const screenNames = mockScreens.map(s => s.name);
      expect(screenNames).toContain('CreateAccount');
      // Should not contain full authenticated stack screens like Settings
      expect(screenNames).not.toContain('Settings');
    });
  });

  // ── Requirement 5.5: profile check error → error with retry ──
  describe('profile check error (Req 5.5)', () => {
    it('renders error text and retry button when getDoc rejects', async () => {
      mockAuthValue = { isSignedIn: true, loading: false };
      mockGetDoc.mockRejectedValue(new Error('Firestore unavailable'));

      let tree: ReactTestRenderer;
      await act(async () => {
        tree = create(<AppNavigator />);
        await flushPromises();
      });

      const root = tree!.root;
      // Should show error text
      const texts = root.findAllByType('Text' as any);
      const errorText = texts.find((t) =>
        t.children.some((c: any) => typeof c === 'string' && c.includes('Something went wrong'))
      );
      expect(errorText).toBeTruthy();

      // Should show retry button
      const touchables = root.findAllByType('TouchableOpacity' as any);
      expect(touchables.length).toBeGreaterThan(0);
      const retryText = texts.find((t) =>
        t.children.some((c: any) => typeof c === 'string' && c.includes('Retry'))
      );
      expect(retryText).toBeTruthy();
    });

    it('retry button calls getDoc again', async () => {
      mockAuthValue = { isSignedIn: true, loading: false };
      mockGetDoc.mockRejectedValue(new Error('Network error'));

      let tree: ReactTestRenderer;
      await act(async () => {
        tree = create(<AppNavigator />);
        await flushPromises();
      });

      // Clear and make getDoc succeed on retry
      mockGetDoc.mockClear();
      mockGetDoc.mockResolvedValue({ exists: () => true });

      const root = tree!.root;
      const touchable = root.findByType('TouchableOpacity' as any);

      await act(async () => {
        touchable.props.onPress();
        await flushPromises();
      });

      // Should have called getDoc again
      expect(mockGetDoc).toHaveBeenCalled();
    });
  });

  // ── Unauthenticated shows Splash ──
  describe('unauthenticated', () => {
    it('renders navigator with Splash as initial route when not signed in', () => {
      mockAuthValue = { isSignedIn: false, loading: false };

      let tree: ReactTestRenderer;
      act(() => {
        tree = create(<AppNavigator />);
      });

      expect(mockInitialRouteName).toBe('Splash');
      const screenNames = mockScreens.map(s => s.name);
      expect(screenNames).toContain('Splash');
      expect(screenNames).toContain('SignIn');
    });
  });
});
