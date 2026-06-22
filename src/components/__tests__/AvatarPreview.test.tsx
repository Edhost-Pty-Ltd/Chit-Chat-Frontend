import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { AvatarPreview } from '../AvatarPreview';

// Enable act() environment for React 19 test renderer
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mock react-native with simple functional components
jest.mock('react-native', () => {
  const React = require('react');
  return {
    View: (props: any) => React.createElement('View', props, props.children),
    Text: (props: any) => React.createElement('Text', props, props.children),
    Image: (props: any) => React.createElement('Image', props),
    TouchableOpacity: (props: any) =>
      React.createElement('TouchableOpacity', props, props.children),
    StyleSheet: {
      create: (styles: any) => styles,
    },
  };
});

// Mock theme constants
jest.mock('../../types/theme', () => ({
  COLORS: {
    glassBorder: 'rgba(255,255,255,0.45)',
    white: '#ffffff',
  },
  RADIUS: {
    full: 999,
  },
}));

/**
 * Unit tests for AvatarPreview component
 * Validates: Requirements 1.3, 1.9, 4.1
 */
describe('AvatarPreview', () => {
  it('renders initials when no imageUri is provided', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <AvatarPreview imageUri={null} username="John Doe" />
      );
    });
    const root = tree!.root;

    // getInitials("John Doe") → "JD"
    const textElements = root.findAllByType('Text' as any);
    const initialsText = textElements.find((el) =>
      el.children.includes('JD')
    );
    expect(initialsText).toBeTruthy();
  });

  it('renders image when imageUri is provided', () => {
    const testUri = 'https://example.com/avatar.jpg';
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <AvatarPreview imageUri={testUri} username="John Doe" />
      );
    });
    const root = tree!.root;

    // Should render an Image element with the correct source
    const imageElements = root.findAllByType('Image' as any);
    expect(imageElements.length).toBe(1);
    expect(imageElements[0].props.source).toEqual({ uri: testUri });
  });

  it('shows "?" when username is empty', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <AvatarPreview imageUri={null} username="" />
      );
    });
    const root = tree!.root;

    // getInitials("") → "?"
    const textElements = root.findAllByType('Text' as any);
    const fallbackText = textElements.find((el) =>
      el.children.includes('?')
    );
    expect(fallbackText).toBeTruthy();
  });

  it('shows "?" when username is whitespace only', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <AvatarPreview imageUri={null} username="   " />
      );
    });
    const root = tree!.root;

    // getInitials("   ") → "?"
    const textElements = root.findAllByType('Text' as any);
    const fallbackText = textElements.find((el) =>
      el.children.includes('?')
    );
    expect(fallbackText).toBeTruthy();
  });

  it('onPress callback fires when pressed', () => {
    const onPressMock = jest.fn();
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <AvatarPreview imageUri={null} username="Alice" onPress={onPressMock} />
      );
    });
    const root = tree!.root;

    // Should wrap content in TouchableOpacity when onPress is provided
    const touchable = root.findByType('TouchableOpacity' as any);
    expect(touchable).toBeTruthy();

    // Simulate press
    act(() => {
      touchable.props.onPress();
    });
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('does not wrap in TouchableOpacity when onPress is not provided', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <AvatarPreview imageUri={null} username="Bob" />
      );
    });
    const root = tree!.root;

    const touchables = root.findAllByType('TouchableOpacity' as any);
    expect(touchables.length).toBe(0);
  });

  it('renders single-word initials correctly', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <AvatarPreview imageUri={null} username="alice" />
      );
    });
    const root = tree!.root;

    // getInitials("alice") → "AL"
    const textElements = root.findAllByType('Text' as any);
    const initialsText = textElements.find((el) =>
      el.children.includes('AL')
    );
    expect(initialsText).toBeTruthy();
  });
});
