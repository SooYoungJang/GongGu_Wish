import Link from "next/link";

export function LegalPage({
  children,
  effectiveDate,
  summary,
  title,
}: {
  children: React.ReactNode;
  effectiveDate: string;
  summary: string;
  title: string;
}) {
  return (
    <article className="mx-auto w-full max-w-4xl px-6 py-14 sm:py-20">
      <div className="rounded-3xl border border-neutral-200 bg-white px-6 py-10 shadow-sm sm:px-12">
        <Link
          className="text-sm font-semibold text-primary-700 hover:text-primary-800"
          href="/"
        >
          ← 공구위시 홈
        </Link>
        <header className="mt-6 border-b border-neutral-200 pb-8">
          <h1 className="text-3xl font-black tracking-tight text-neutral-950 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 text-base leading-7 text-neutral-600">{summary}</p>
          <p className="mt-4 text-sm font-semibold text-neutral-500">
            시행일: {effectiveDate}
          </p>
        </header>
        <div className="space-y-10 pt-9 text-[15px] leading-7 text-neutral-700">
          {children}
        </div>
      </div>
    </article>
  );
}

export function LegalSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-extrabold text-neutral-950">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
