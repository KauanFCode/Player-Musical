const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration for Player 2.0
 */
const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
