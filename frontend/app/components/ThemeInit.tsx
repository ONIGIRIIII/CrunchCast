"use client";

import { useEffect } from "react";
import { loadTheme } from "@/lib/theme";

/** Applies the saved theme on every route, including ones with no theme
 * toggle of their own - without this, navigating to such a page would flash
 * back to dark since nothing on it calls loadTheme(). Renders nothing. */
export default function ThemeInit() {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", loadTheme());
  }, []);

  return null;
}
