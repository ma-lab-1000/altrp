const withPWA = require('next-pwa')({
  dest: 'public/pwa',
  customWorkerDir: 'worker',
  buildExcludes: [/app-build-manifest\.json$/]

})
/** @type {import('next').NextConfig} */

const STATIC_EXPORT = process.env.STATIC_EXPORT === 'true'


const nextConfig = {
  transpilePackages: [],
  images: {
    unoptimized: process.env.NODE_ENV === 'production',
    domains: [],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  //  
  experimental: {
    // optimizeCss: true, 
    optimizePackageImports: ['lucide-react'],
    optimizeCss: false,
    externalDir: true,
    // inlineCss: true,
    // Exclude Cloudflare Pages Functions from tracing/bundle


  },
  //  
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Configure webpack to resolve modules from packages and root
  webpack: (config, { isServer }) => {
    const path = require('path');
    const rootDir = path.resolve(__dirname, '../..');
    const packagesDir = path.resolve(rootDir, 'packages');
    
    // Add resolve aliases for path mappings
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
      '@/settings': path.resolve(rootDir, 'settings.ts'),
      '@/packages': packagesDir,
      '@/components': path.resolve(packagesDir, 'components'),
      '@/lib': path.resolve(packagesDir, 'lib'),
      '@/hooks': path.resolve(packagesDir, 'hooks'),
      '@/repositories': path.resolve(packagesDir, 'repositories'),
    };
    
    // Add packages and root to module resolution (node_modules should be first)
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'), // apps/site/node_modules first
      ...(config.resolve.modules || []),
      packagesDir,
      rootDir,
    ];
    
    return config;
  },

}


if (STATIC_EXPORT) {
  nextConfig.output = 'export'
  nextConfig.trailingSlash = false
  nextConfig.skipTrailingSlashRedirect = true
  nextConfig.distDir = 'dist'
  nextConfig.reactStrictMode = true
}
module.exports = STATIC_EXPORT ? withPWA(nextConfig) : nextConfig
