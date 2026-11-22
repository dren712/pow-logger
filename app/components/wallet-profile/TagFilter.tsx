'use client'

interface TagFilterProps {
  title: string
  emptyText: string
  tags: { name: string; count: number }[]
  selected: string
  onSelect: (name: string) => void
}

export default function TagFilter({ title, emptyText, tags, selected, onSelect }: TagFilterProps) {
  return (
    <section className="pv-card p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="pv-h2">{title}</h2>
        {tags.length > 0 && <span className="pv-faint text-[12px]">Select one to filter proofs</span>}
      </div>
      {tags.length === 0 ? (
        <p className="pv-muted mt-3 text-[13px]">{emptyText}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((t) => (
            <button
              key={t.name}
              type="button"
              className="wp-tag"
              aria-pressed={selected === t.name}
              onClick={() => onSelect(selected === t.name ? 'ALL' : t.name)}
            >
              {t.name} <span className="wp-count">{t.count}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
