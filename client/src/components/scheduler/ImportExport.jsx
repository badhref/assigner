import { useState, useRef } from 'react'

const btnCls = `px-4 py-2 bg-brand-yellow hover:bg-brand-yellow-dk disabled:opacity-40 disabled:cursor-not-allowed text-black text-[13px] font-bold rounded-lg transition-all`

export default function ImportExport({ selectedYear }) {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [clearFirst, setClearFirst] = useState(false)
  const [fileLabel, setFileLabel] = useState('Choose JSON file…')
  const fileRef = useRef()

  async function doExport() {
    setExporting(true)
    try {
      const res = await fetch(`/api/schedule/export?year=${selectedYear}`)
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `assigner-schedule-${selectedYear}.json`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { alert('Export failed: ' + e.message) }
    setExporting(false)
  }

  async function doImport() {
    const file = fileRef.current?.files[0]
    if (!file) { alert('Please choose a JSON file first.'); return }
    setImporting(true); setImportResult(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const res = await fetch('/api/schedule/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: json.entries || json, clearFirst }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setImportResult({ ok: true, inserted: data.imported, skipped: data.skipped })
      setFileLabel('Choose JSON file…')
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) { setImportResult({ ok: false, message: e.message }) }
    setImporting(false)
  }

  const sectionCls = 'mb-8'
  const titleCls = 'text-[14px] font-bold text-slate-800 dark:text-slate-100 mb-1.5'
  const descCls  = 'text-[12.5px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3'

  return (
    <div className="px-6 py-6">
      <div className={sectionCls}>
        <div className={titleCls}>Export Schedule</div>
        <div className={descCls}>Download all schedule entries for <strong>{selectedYear}</strong> as a JSON file.</div>
        <button className={btnCls} onClick={doExport} disabled={exporting}>
          {exporting ? 'Exporting…' : `Export ${selectedYear} Schedule`}
        </button>
      </div>

      <div>
        <div className={titleCls}>Import Schedule</div>
        <div className={descCls}>Upload a previously exported JSON file. Members are matched by name and region.</div>

        <label className="inline-block px-3.5 py-2 bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-lg text-[12.5px] text-slate-500 dark:text-slate-400 cursor-pointer hover:border-brand-yellow transition-colors mb-3">
          📎 {fileLabel}
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
            onChange={e => setFileLabel(e.target.files[0] ? e.target.files[0].name : 'Choose JSON file…')} />
        </label>

        <label className="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400 cursor-pointer mb-3">
          <input type="checkbox" checked={clearFirst} onChange={e => setClearFirst(e.target.checked)} />
          Clear existing entries before loading
        </label>

        <button className={btnCls} onClick={doImport} disabled={importing}>
          {importing ? 'Importing…' : 'Import Schedule'}
        </button>

        {importResult && (
          <div className={`mt-3 px-3.5 py-2.5 rounded-lg text-[12.5px] border ${
            importResult.ok
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
              : 'bg-red-50 dark:bg-red-500/10 text-red-500 border-red-200 dark:border-red-500/20'
          }`}>
            {importResult.ok
              ? `✓ Import complete — ${importResult.inserted} entries added, ${importResult.skipped} skipped.`
              : `✗ Import failed: ${importResult.message}`}
          </div>
        )}
      </div>
    </div>
  )
}
