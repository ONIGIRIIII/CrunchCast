import type { Metadata } from "next";
import Dashboard from "../components/Dashboard";

// Only meaningful with a term in progress (it redirects home without one),
// so it stays out of search results - see also app/robots.ts.
export const metadata: Metadata = {
  title: "Your term",
  description: "Difficulty scores and the history behind them for the courses in your term.",
  robots: { index: false, follow: true },
};

export default function DashboardPage() {
  return <Dashboard />;
}
