// babel.config.js — Babel transpiler config for the Expo project.
// NativeWind requires its preset to be listed AFTER expo's preset
// so it can post-process the className props into React Native styles.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
