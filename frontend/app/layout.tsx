import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeInit from "./components/ThemeInit";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UBC Course Workload Predictor",
  description: "Historical-grade-data-based course difficulty predictions for UBC students.",
};

// Same as Next's default, made explicit. No maximumScale/userScalable -
// pinch-zoom stays available.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <ThemeInit />
      </body>
    </html>
  );
}
