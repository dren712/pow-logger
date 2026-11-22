import SiteNav from '@/app/components/SiteNav'

export default function Loading() {
  return (
    <div className="pv flex flex-1 flex-col">
      <SiteNav cta={false} />
      <main className="pv-main mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-10 sm:py-14" aria-busy="true">
        <div>
          <p className="pv-eyebrow">Leaderboard</p>
          <h1 className="mt-3 text-[34px] font-bold leading-tight tracking-[-0.03em] text-white">Verified builders</h1>
          <p className="pv-muted mt-3 text-[15px]" role="status">Loading the current ranking.</p>
          <div className="pv-skeleton mt-6 h-[46px] w-full max-w-md !rounded-[10px]" />
        </div>
        <div className="pv-card overflow-hidden">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-[#1c222c] px-4 py-3.5 last:border-b-0 sm:px-5">
              <div className="pv-skeleton h-4 w-7" />
              <div className="pv-skeleton h-10 w-10 shrink-0 !rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="pv-skeleton h-4 w-2/5" />
                <div className="pv-skeleton h-3 w-3/5" />
              </div>
              <div className="pv-skeleton h-6 w-9" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
