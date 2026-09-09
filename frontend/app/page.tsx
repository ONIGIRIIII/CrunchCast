import CourseBuilder from "./components/CourseBuilder";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl w-full px-4 py-12 flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold">UBC Course Workload Predictor</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Pick the courses you&apos;re considering for a term and get a difficulty readout based on
          historical UBC grade data. Difficulty is a proxy inferred from grade outcomes (2016W and
          earlier), not a direct measurement of workload.
        </p>
      </header>
      <CourseBuilder />
    </main>
  );
}
