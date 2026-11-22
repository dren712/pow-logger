import SiteNav from './components/SiteNav'

export default function Loading() {
  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav />
      <main className="pv-main mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-10 sm:py-14" aria-busy="true">
        <p className="sr-only" role="status">Loading</p>
        <div className="flex flex-col gap-3">
          <div className="pv-skeleton h-3 w-24" />
          <div className="pv-skeleton h-9 w-full max-w-md" />
          <div className="pv-skeleton h-4 w-full max-w-xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="pv-skeleton h-28 !rounded-2xl" />)}
        </div>
        <div className="pv-skeleton h-64 !rounded-2xl" />
      </main>
    </div>
  )
}
