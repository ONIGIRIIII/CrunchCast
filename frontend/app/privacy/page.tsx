import type { Metadata } from "next";
import LegalPage, { LegalLink, LegalList, LegalSection } from "../components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/site";

// Written to match what the app actually does - if any of this changes
// (new storage, a new analytics or hosting provider, accounts), update this
// page and LEGAL_LAST_UPDATED in lib/site.ts.

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What CrunchCast stores, what it sends, and what it doesn't: no accounts, no cookies, and nothing about you kept on a server.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro={
        <p>
          CrunchCast is an independent portfolio project, not a UBC service. This page explains what happens to
          information when you use it. The short version: there are no accounts, no cookies, and nothing about
          you is stored on a server.
        </p>
      }
    >
      <LegalSection title="What you send when you use the app">
        <p>
          When you add courses and ask for scores, the course codes you picked (for example, CPSC 110) are sent to
          the CrunchCast API so it can calculate them. If you&apos;ve taken the personalization quiz, the weights
          it produced are sent too. Looking up a course&apos;s history sends that course code. None of this is
          linked to you, and the API doesn&apos;t save it.
        </p>
      </LegalSection>

      <LegalSection title="What stays in your browser">
        <p>A few things are kept in your browser&apos;s local storage, on your device only:</p>
        <LegalList
          items={[
            "Terms you save, and the term you're currently working on",
            "Your personalization quiz weights",
            "Your light or dark mode choice",
          ]}
        />
        <p>
          They aren&apos;t sent anywhere except as described above. You can delete them at any time by clearing
          this site&apos;s data in your browser settings. In a private or incognito window, they&apos;re gone
          when you close it.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>CrunchCast doesn&apos;t set any cookies, which is why there&apos;s no cookie banner.</p>
      </LegalSection>

      <LegalSection title="Analytics">
        <p>
          We use <LegalLink href="https://vercel.com/docs/analytics/privacy-policy">Vercel Web Analytics</LegalLink>{" "}
          to count visits. It records anonymous, aggregated information such as the page viewed, the site that
          linked you here, and your browser, operating system, device type and country. It doesn&apos;t use
          cookies, doesn&apos;t collect your name or email, and can&apos;t follow you across other websites.
          Visitors are told apart with a short-lived anonymous identifier that resets every day.
        </p>
      </LegalSection>

      <LegalSection title="Hosting">
        <p>
          The website is hosted on Vercel and the API on Render. Like most hosts, they keep standard server logs
          (such as IP address, time of request, and the page or address requested) to run and secure their
          services. Those logs are covered by{" "}
          <LegalLink href="https://vercel.com/legal/privacy-policy">Vercel&apos;s privacy policy</LegalLink> and{" "}
          <LegalLink href="https://render.com/privacy">Render&apos;s privacy policy</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="The grade data">
        <p>
          The grade statistics come from publicly available UBC grade reports and dashboards, collected by the
          open-source <LegalLink href="https://github.com/DonneyF/ubc-pair-grade-data">ubc-pair-grade-data</LegalLink>{" "}
          project. They&apos;re aggregate numbers for whole course sections, not individual students. Instructor
          names appear because they&apos;re part of that public data.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>If this policy changes, the date at the top of the page will change with it.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about privacy? Email <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
