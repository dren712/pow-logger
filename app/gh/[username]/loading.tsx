import SiteNav from '@/app/components/SiteNav'

export default function Loading() {
  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav />
      <main className="pv-main mx-auto grid w-full max-w-5xl flex-1 content-start gap-6 px-5 py-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:py-10" aria-busy="true">
        <div className="pv-card flex flex-col gap-4 p-6 lg:self-start">
          <div className="flex items-start justify-between gap-4">
            <div className="pv-skeleton h-[88px] w-[88px] !rounded-2xl" />
            <div className="pv-skeleton h-[88px] w-[88px] !rounded-full" />
          </div>
          <div className="pv-skeleton h-6 w-3/4" />
          <div className="pv-skeleton h-4 w-1/2" />
          <div className="pv-skeleton mt-2 h-10 w-full !rounded-[10px]" />
          <div className="grid grid-cols-2 gap-2">
            <div className="pv-skeleton h-9 !rounded-[10px]" />
            <div className="pv-skeleton h-9 !rounded-[10px]" />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="pv-skeleton h-[98px] !rounded-2xl" />)}
          </div>
          <div className="pv-card flex flex-col items-center gap-2 px-6 py-12 text-center" role="status">
            <span className="pv-spinner pv-spinner-light" aria-hidden="true" />
            <p className="mt-2 text-[15px] font-medium text-white">Reading public GitHub data</p>
            <p className="pv-muted text-[13px]">Large accounts take a few seconds the first time.</p>
          </div>
          <div className="pv-skeleton h-40 !rounded-2xl" />
        </div>
      </main>
    </div>
  )
}
