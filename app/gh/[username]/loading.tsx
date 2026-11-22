import SiteNav from '@/app/components/SiteNav'

export default function Loading() {
  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav />
      <main className="pv-main mx-auto grid w-full max-w-5xl flex-1 gap-6 px-5 py-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:py-10" aria-busy="true">
        <div className="pv-card flex flex-col gap-4 p-6">
          <div className="pv-skeleton h-[88px] w-[88px] !rounded-2xl" />
          <div className="pv-skeleton h-6 w-3/4" />
          <div className="pv-skeleton h-4 w-1/2" />
          <div className="pv-skeleton h-10 w-full" />
        </div>
        <div className="flex flex-col gap-6">
          <p className="pv-muted text-[14px]" role="status">
            Reading public GitHub data. Large accounts take a few seconds the first time.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="pv-skeleton h-[86px] !rounded-2xl" />)}
          </div>
          <div className="pv-skeleton h-72 !rounded-2xl" />
          <div className="pv-skeleton h-40 !rounded-2xl" />
        </div>
      </main>
    </div>
  )
}
