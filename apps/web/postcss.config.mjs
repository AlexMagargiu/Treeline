// Tailwind v4 ships its PostCSS plugin as a separate package. The v3 `tailwindcss`
// entry is not a PostCSS plugin any more and fails at build.
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
