module.exports = {
  preset: 'react-native',
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js)'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|lucide-react-native|react-native-svg|react-native-track-player)/)',
  ],
};
