import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-three/drei is a kitchen-sink package - CourseGraph.tsx only uses
  // Billboard/OrbitControls/Text (via its dynamic, ssr:false import in
  // LandingPage.tsx), but Vercel's file tracing still walks drei's other
  // peer deps (mediapipe hand-tracking, hls.js video, rapier physics,
  // stats-gl, gainmap loading) since they're statically reachable from
  // drei's own barrel export, ballooning every function's bundle past
  // Vercel's 500MB limit. None of these are used anywhere in this app.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@mediapipe/**",
      "node_modules/hls.js/**",
      "node_modules/@dimforge/**",
      "node_modules/stats-gl/**",
      "node_modules/stats.js/**",
      "node_modules/@monogrid/gainmap-js/**",
      "node_modules/meshline/**",
      "node_modules/camera-controls/**",
    ],
  },

  // Security headers on every route. Vercel already serves HTTPS only and
  // redirects plain HTTP; HSTS makes browsers remember that and never try
  // HTTP for this host again (2 years). The rest are standard hardening:
  // no MIME sniffing, no framing by other sites (clickjacking), a referrer
  // that doesn't leak full URLs cross-origin, and no camera/mic/location.
  // No Content-Security-Policy yet - three.js/drei and Next's inline
  // bootstrap scripts would need a carefully tuned policy to not break.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
