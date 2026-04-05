const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// CRITICAL: Only resolve from crn-app's own node_modules first,
// then fall back to root for workspace packages (crn-shared).
// This prevents Metro from picking up crn-api's React 19.1 from root.
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(__dirname, ".."),  // for crn-shared workspace resolution
];

// Block root node_modules react from being resolved
config.resolver.blockList = [
  /\.\.\/node_modules\/react\/.*/,
  /\.\.\/node_modules\/react-dom\/.*/,
];

// Watch crn-shared for changes
config.watchFolders = [
  path.resolve(__dirname, "../crn-shared"),
];

module.exports = config;
