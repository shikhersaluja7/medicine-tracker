// tailwind.config.js — NativeWind/Tailwind configuration.
// The `content` array tells Tailwind which files to scan for class names.
// Any file NOT listed here won't have its Tailwind classes included in the build.
/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan all TypeScript/TSX files in app/ and src/ for Tailwind class names
  // e.g. className="bg-blue-500 text-white p-4" in any .tsx file
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Add custom colors here later, e.g.:
      // colors: { brand: '#3B82F6' }
    },
  },
  plugins: [],
};
