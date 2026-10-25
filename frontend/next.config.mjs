/** @type {import('next').NextConfig} */
const nextConfig = {
  // `ignoreBuildErrors` was true here. It meant the build could never fail,
  // which is how a project ends up claiming "TypeScript: clean" while carrying
  // type errors. Fix the errors instead.
  typescript: {
    ignoreBuildErrors: false,
  },
}

export default nextConfig
