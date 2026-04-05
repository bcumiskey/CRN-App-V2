const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Ensure React resolves to crn-app's own copy (not root node_modules)
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
];

// Watch the crn-shared workspace package for changes
config.watchFolders = [
  path.resolve(__dirname, "../crn-shared"),
];

module.exports = config;
