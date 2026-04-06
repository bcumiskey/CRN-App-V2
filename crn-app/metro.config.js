const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// crn-app is NOT in the npm workspace (to avoid React version conflicts).
// Only resolve from crn-app's own node_modules.
// Do NOT let Metro look up to the monorepo root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
];

// crn-shared is linked via file: reference, watch it for dev changes
config.watchFolders = [
  path.resolve(__dirname, "../crn-shared"),
];

// Explicitly block the root node_modules from resolution
config.resolver.blockList = [
  new RegExp(path.resolve(__dirname, "../node_modules/react/.*").replace(/\\/g, "\\\\")),
  new RegExp(path.resolve(__dirname, "../node_modules/react-dom/.*").replace(/\\/g, "\\\\")),
];

module.exports = config;
