import { Link } from 'react-router-dom';

const BlogIndexPage = () => (
  <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_36%),linear-gradient(180deg,_#f8fafc_0%,_#eff6ff_100%)] text-slate-900">
    <section className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <div className="max-w-3xl space-y-5">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
          Blog
        </p>
        <h1 className="font-serif text-4xl leading-tight text-slate-950 sm:text-5xl">
          المدونة
        </h1>
        <p className="text-lg leading-8 text-slate-600">
          هذه الصفحة قيد الإنشاء.
        </p>
      </div>
    </section>
  </main>
);

export default BlogIndexPage;
