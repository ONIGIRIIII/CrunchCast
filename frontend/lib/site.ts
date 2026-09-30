// Site-wide constants shared by metadata, the sitemap/robots routes, the
// social preview image, the legal pages and the landing footer - one place
// to change the domain or contact details.

/** Canonical origin. NEXT_PUBLIC_SITE_URL overrides it (e.g. a custom
 * domain); otherwise it's the production Vercel domain. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://crunch-cast.vercel.app").replace(/\/$/, "");

export const SITE_NAME = "CrunchCast";

export const SITE_TITLE = "CrunchCast · How UBC courses actually grade";

export const SITE_DESCRIPTION =
  "See how a UBC course has graded in the past before you register. Difficulty scores built from decades of real grade data (averages, fail rates, grade spread), with the numbers behind every score.";

export const CONTACT_EMAIL = "singhharshpreet675@gmail.com";

export const GITHUB_URL = "https://github.com/ONIGIRIIII/CrunchCast";

export const LINKEDIN_URL = "https://www.linkedin.com/in/harshpreet-singh-2331762a4/";

/** Shown as "Last updated" on the privacy policy and terms. Bump it
 * whenever either page's content changes. */
export const LEGAL_LAST_UPDATED = "September 29, 2026";
