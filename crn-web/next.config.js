const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["crn-shared"],
  // Two lockfiles exist (monorepo root + this package); pin file tracing to
  // the monorepo root so Next stops guessing and warning at build time.
  outputFileTracingRoot: path.join(__dirname, ".."),
};

module.exports = nextConfig;
