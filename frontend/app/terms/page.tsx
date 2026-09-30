import type { Metadata } from "next";
import LegalPage, { LegalLink, LegalSection } from "../components/LegalPage";
import { CONTACT_EMAIL, GITHUB_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms for using CrunchCast: an independent, informational tool whose scores are estimates, not advice.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      intro={<p>These terms cover your use of CrunchCast. By using the site, you agree to them.</p>}
    >
      <LegalSection title="What CrunchCast is">
        <p>
          CrunchCast is an independent portfolio project by Harshpreet Singh. It isn&apos;t affiliated with,
          endorsed by, or run by the University of British Columbia.
        </p>
      </LegalSection>

      <LegalSection title="Scores are estimates, not advice">
        <p>
          Scores are estimates built from historical grade data. The predictor only uses terms up to 2016W, and
          the history browser shows terms up to 2025W. They describe how courses have graded in the past, not how
          much work a course takes or how good the teaching is, and they can be wrong or out of date.
        </p>
        <p>
          Use them as one input alongside official UBC information, academic advisors and your own judgment.
          Don&apos;t rely on them alone for decisions about your studies.
        </p>
      </LegalSection>

      <LegalSection title="Using the site and the API">
        <p>
          You can use CrunchCast for personal, non-commercial purposes. Please don&apos;t try to disrupt it,
          overload the API, get around its rate limits, or scrape it in bulk. Traffic that does may be blocked.
        </p>
      </LegalSection>

      <LegalSection title="Data and code">
        <p>
          The grade data comes from public UBC sources, via the open-source{" "}
          <LegalLink href="https://github.com/DonneyF/ubc-pair-grade-data">ubc-pair-grade-data</LegalLink> project,
          and stays subject to its original sources&apos; terms. The CrunchCast source code is on{" "}
          <LegalLink href={GITHUB_URL}>GitHub</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="No warranty">
        <p>
          The site is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind,
          including accuracy, availability, or fitness for a particular purpose.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the extent the law allows, CrunchCast and its author aren&apos;t liable for any loss or damage that
          comes from using the site or relying on its scores.
        </p>
      </LegalSection>

      <LegalSection title="Availability">
        <p>
          CrunchCast is free and may change, go down, or be discontinued at any time without notice. The API runs
          on a free hosting tier, so the first request after a quiet period can take up to a minute.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>If these terms change, the date at the top of the page will change with them.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions? Email <LegalLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</LegalLink>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
