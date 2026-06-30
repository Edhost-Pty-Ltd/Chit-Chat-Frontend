// ─── Platform Test Component ─────────────────────────────────────────────────
// Simple component to verify platform-specific code is working

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

export function PlatformTest() {
  const platformInfo = {
    os: Platform.OS,
    isWeb: Platform.OS === 'web',
    version: Platform.Version,
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Platform Detection Test</Text>
      <Text style={styles.info}>OS: {platformInfo.os}</Text>
      <Text style={styles.info}>Is Web: {platformInfo.isWeb ? 'Yes' : 'No'}</Text>
      <Text style={styles.info}>
        Version: {typeof platformInfo.version === 'string' ? platformInfo.version : 'N/A'}
      </Text>
      
      {Platform.OS === 'web' && (
        <Text style={[styles.info, styles.success]}>
          ✓ Web platform detected - .web.ts files will be used
        </Text>
      )}
      
      {Platform.OS !== 'web' && (
        <Text style={[styles.info, styles.success]}>
          ✓ Native platform detected - .ts files will be used
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    margin: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  info: {
    fontSize: 14,
    marginVertical: 4,
    color: '#666',
  },
  success: {
    color: '#22c55e',
    fontWeight: '600',
    marginTop: 8,
  },
});
