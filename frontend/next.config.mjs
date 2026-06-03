/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: { serverComponentsExternalPackages: ["pdfkit"] },

  async headers() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const isDev = process.env.NODE_ENV !== "production";

    // Next.js dev mode (React Refresh / hot reload) evaluates code via eval(),
    // so 'unsafe-eval' is required in development only — never in production.
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";

    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",    // Tailwind inline styles
      "img-src 'self' data: blob:",
      "font-src 'self'",
      `connect-src 'self' ${backendUrl} wss:`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",           value: "DENY" },
          { key: "X-Content-Type-Options",    value: "nosniff" },
          { key: "X-DNS-Prefetch-Control",    value: "on" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy",   value: csp },
          // HSTS is set in nginx — only applies over HTTPS
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals]),
        ({ request }, callback) => {
          if (request === "pdfkit") return callback(null, "commonjs pdfkit");
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
