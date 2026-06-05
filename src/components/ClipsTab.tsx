'use client'

import { useEffect, useState } from 'react'

type Clip = {
  id: string
  url: string
  platform: string
  caption: string | null
  added_by: string
  embed_html: string | null
  created_at: string
}

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: '🎵',
  instagram: '📸',
  twitter: '🐦',
  youtube: '▶️',
  other: '🔗',
}

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  twitter: 'Twitter/X',
  youtube: 'YouTube',
  other: 'Link',
}

export default function ClipsTab({ leagueId }: { leagueId: string }) {
  const [clips, setClips] = useState<Clip[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [addedBy, setAddedBy] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const name = localStorage.getItem('ballzone:commentName')
    if (name) setAddedBy(name)
  }, [])

  useEffect(() => {
    fetch(`/api/leagues/${leagueId}/clips`)
      .then(r => r.json())
      .then(d => { setClips(Array.isArray(d) ? d : []); setLoading(false) })
  }, [leagueId])

  async function addClip() {
    if (!url.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const name = addedBy.trim() || 'Anonymous'
      localStorage.setItem('ballzone:commentName', name)
      const res = await fetch(`/api/leagues/${leagueId}/clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, caption, added_by: name }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); setSubmitting(false); return }
      setClips(prev => [data, ...prev])
      setUrl('')
      setCaption('')
      setShowAdd(false)
    } catch (e) {
      setError('Something went wrong')
    }
    setSubmitting(false)
  }

  if (loading) return (
    <div className="text-white/30 text-sm text-center py-8">Loading clips...</div>
  )

  return (
    <div className="space-y-4">
      {/* Add clip button */}
      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-3 rounded-2xl border border-dashed border-white/20
                     text-white/40 text-sm active:bg-white/5 transition-colors"
        >
          + Add a clip
        </button>
      ) : (
        <div className="card p-4 space-y-3 border-orange-500/20">
          <p className="text-white/60 text-sm font-semibold">Share a clip</p>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="Paste TikTok, Instagram, YouTube or Twitter link"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5
                       text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50"
          />
          <input
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5
                       text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50"
          />
          <input
            value={addedBy}
            onChange={e => setAddedBy(e.target.value)}
            placeholder="Your name"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5
                       text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={addClip}
              disabled={!url.trim() || submitting}
              className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold
                         disabled:opacity-30 active:scale-95 transition-transform"
            >
              {submitting ? 'Adding...' : 'Add Clip'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setError('') }}
              className="px-4 py-2.5 rounded-xl bg-white/10 text-white/40 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Clips list */}
      {clips.length === 0 && !showAdd && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🎬</p>
          <p className="text-white/30 text-sm">No clips yet.</p>
          <p className="text-white/20 text-xs mt-1">Share a highlight from TikTok, Instagram or YouTube.</p>
        </div>
      )}

      {clips.map(clip => (
        <div key={clip.id} className="card overflow-hidden border-white/5">
          {/* Embed or link card */}
          {clip.embed_html ? (
            <div
              className="w-full overflow-hidden"
              dangerouslySetInnerHTML={{ __html: clip.embed_html }}
            />
          ) : (
            <a
              href={clip.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 active:bg-white/5"
            >
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                {PLATFORM_ICONS[clip.platform] ?? '🔗'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-orange-400 text-xs font-semibold mb-0.5">
                  {PLATFORM_LABELS[clip.platform] ?? 'Link'}
                </p>
                <p className="text-white/50 text-xs truncate">{clip.url}</p>
              </div>
              <span className="text-white/20 text-xs flex-shrink-0">↗</span>
            </a>
          )}

          {/* Caption + meta */}
          <div className="px-4 pb-4 pt-2">
            {clip.caption && (
              <p className="text-white/70 text-sm mb-2">{clip.caption}</p>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-white/30 text-xs">{clip.added_by}</span>
                <span className="text-white/10 text-xs">·</span>
                <span className="text-white/20 text-xs">
                  {new Date(clip.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <a
                href={clip.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/20 text-xs border border-white/10 rounded-lg px-2 py-1 active:bg-white/5"
              >
                View original ↗
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
