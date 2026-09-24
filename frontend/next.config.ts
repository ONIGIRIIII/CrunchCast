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
};

export default nextConfig;
