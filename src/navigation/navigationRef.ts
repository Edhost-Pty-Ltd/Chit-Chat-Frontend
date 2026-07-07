import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '../types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Navigate from anywhere (outside React components).
 * Waits until the navigator is ready before dispatching.
 */
export function navigateTo(name: keyof RootStackParamList, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as any, params);
  } else {
    // If navigator isn't ready yet, wait a tick and retry once
    setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate(name as any, params);
      }
    }, 500);
  }
}
