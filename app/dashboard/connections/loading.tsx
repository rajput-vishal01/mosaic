export default function ConnectionsLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 lg:px-8">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-4 w-24 rounded bg-slate-200" />
        <div className="mt-6 h-8 w-56 rounded bg-slate-200" />
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="h-64 rounded-xl border border-slate-200 bg-white" />
          <div className="h-64 rounded-xl border border-slate-200 bg-white" />
        </div>
      </div>
    </main>
  );
}
