'use client'

import { useEffect, useState, useRef } from 'react'

type Clip = {
  id: string
  url: string
  platform: string
  caption: string | null
  added_by: string
  embed_html: string | null
  created_at: string
}

type Comment = { id: string; author_name: string; body: string; created_at: string }

const EMOJIS = ['🔥', '💪', '😤', '👑', '🎯', '💀', '🍿', '🫡']

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: '🎵', instagram: '📸', twitter: '🐦', youtube: '▶️', other: '🔗',
}

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok', instagram: 'Instagram', twitter: 'Twitter/X', youtube: 'YouTube', other: 'Link',
}

function ClipCard({ clip, leagueId, userName }: { clip: Clip; leagueId: string; userName: string }) {
  const [reactions, setReactions] = useState<Record<string, number>>({})
  const [myReactions, setMyReactions] = useState<Record<string, boolean>>({})
  const [comments, setComments] = useState<Comment[]>([])
  const [showComments, setShowComments] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`${leagueId}/clips/${clip.id}/react`).then(r => r.json()).then(setReactions)
    fetch(`${leagueId}/clips/${clip.id}/comments`).then(r => r.json()).then(setComments)
    const stored = localStorage.getItem(`clipReactions:${clip.id}`)
    if (stored) setMyReactions(JSON.parse(stored))
  }, [clip.id, leagueId])

  async function react(emoji: string) {
    if (myReactions[emoji]) return
    const name = userName || 'Anonymous'
    const updated = { ...myReactions, [emoji]: true }
    setMyReactions(updated)
    localStorage.setItem(`clipReactions:${clip.id}`, JSON.stringify(updated))
    setReactions(r => ({ ...r, [emoji]: (r[emoji] ?? 0) + 1 }))
    await fetch(`${leagueId}/clips/${clip.id}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji, author_name: name }),
    })
  }

  async function submitComment() {
    if (!commentBody.trim()) return
    setSubmitting(true)
    const name = userName || 'Anonymous'
    const res = await fetch(`${leagueId}/clips/${clip.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author_name: name, body: commentBody.trim() }),
    })
    if (res.ok) {
      const c = await res.json()
      setComments(prev => [...prev, c])
      setCommentBody('')
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
    setSubmitting(false)
  }

  async function shareClip() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: clip.caption ?? 'Check this clip on Ballzone',
          text: `🏀 ${clip.caption ?? 'Sick clip'}`,
          url: window.location.href,
        })
      } else {
        await navigator.clipboard.writeText(clip.url)
        alert('Link copied!')
      }
    } catch (e) {}
  }

  return (
    <div className="card overflow-hidden border-white/5">
      {/* Embed or link card */}
      {clip.embed_html ? (
        <div className="w-full overflow-hidden"
          dangerouslySetInnerHTML={{ __html: clip.embed_html }} />
      ) : (
        <a href={clip.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 active:bg-white/5">
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
      <div className="px-4 pt-3 pb-2">
        {clip.caption && <p className="text-white/70 text-sm mb-2">{clip.caption}</p>}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-white/30 text-xs">{clip.added_by}</span>
            <span className="text-white/10 text-xs">·</span>
            <span className="text-white/20 text-xs">
              {new Date(clip.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          </div>
          <a href={clip.url} target="_blank" rel="noopener noreferrer"
            className="text-white/20 text-xs border border-white/10 rounded-lg px-2 py-1 active:bg-white/5">
            View original ↗
          </a>
        </div>

        {/* Reactions */}
        <div className="flex gap-1.5 flex-wrap mb-3">
          {EMOJIS.map(emoji => (
            <button key={emoji} onClick={() => react(emoji)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all
                ${myReactions[emoji]
                  ? 'bg-orange-500/20 border border-orange-500/40 text-white'
                  : 'bg-white/5 border border-white/10 text-white/50 active:scale-95'}`}>
              {emoji} {reactions[emoji] ? <span className="tabular-nums">{reactions[emoji]}</span> : null}
            </button>
          ))}
        </div>

        {/* Action bar */}
        <div className="flex gap-2 border-t border-white/5 pt-2">
          <button onClick={() => setShowComments(!showComments)}
            className="flex-1 py-1.5 rounded-xl bg-white/5 text-white/40 text-xs active:bg-white/10">
            💬 {comments.length ? `${comments.length} comments` : 'Comment'}
          </button>
          <button onClick={shareClip}
            className="flex-1 py-1.5 rounded-xl bg-white/5 text-white/40 text-xs active:bg-white/10">
            📤 Share
          </button>
        </div>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
          {comments.length === 0 && (
            <p className="text-white/20 text-xs text-center py-2">No comments yet</p>
          )}
          {comments.map(c => (
            <div key={c.id} className="bg-white/5 rounded-xl p-2.5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-orange-400 text-xs font-semibold">{c.author_name}</span>
                <span className="text-white/20 text-xs">
                  {new Date(c.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-white/70 text-sm">{c.body}</p>
            </div>
          ))}
          <div ref={bottomRef} />
          <div className="flex gap-2 pt-1">
            <input value={commentBody} onChange={e => setCommentBody(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitComment()}
              placeholder="Say something..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2
                         text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50" />
            <button onClick={submitComment} disabled={!commentBody.trim() || submitting}
              className="px-3 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold
                         disabled:opacity-30 active:scale-95 transition-transform">
              {submitting ? '...' : '↑'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


function ClipThumb({ clip, onClick }: { clip: Clip; onClick: () => void }) {
  const hasEmbed = !!clip.embed_html
  const icon = PLATFORM_ICONS[clip.platform] ?? '🔗'
  return (
    <button onClick={onClick}
      className="relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10 active:scale-95 transition-transform">
      {hasEmbed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f1a]">
          <span className="text-3xl">{icon}</span>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f1a]">
          <span className="text-3xl">{icon}</span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <p className="text-white text-xs font-semibold truncate">{clip.caption ?? clip.platform}</p>
        <p className="text-white/40 text-[10px]">{clip.added_by}</p>
      </div>
      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-xs">
        {icon}
      </div>
    </button>
  )
}

export default function ClipsTab({ leagueId, apiBase }: { leagueId?: string; apiBase?: string }) {
  const [clips, setClips] = useState<Clip[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [showAdd, setShowAdd] = useState(false)
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [userName, setUserName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const name = localStorage.getItem('ballzone:commentName')
    if (name) setUserName(name)
  }, [])

  useEffect(() => {
    fetch(`${apiBase ?? `/api/leagues/${leagueId}`}/clips`)
      .then(r => r.json())
      .then(d => { setClips(Array.isArray(d) ? d : []); setLoading(false) })
  }, [leagueId])

  async function addClip() {
    if (!url.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const name = userName.trim() || 'Anonymous'
      localStorage.setItem('ballzone:commentName', name)
      const res = await fetch(`${apiBase ?? `/api/leagues/${leagueId}`}/clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, caption, added_by: name }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); setSubmitting(false); return }
      setClips(prev => [data, ...prev])
      setUrl(''); setCaption(''); setShowAdd(false)
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
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)}
          className="w-full py-3 rounded-2xl border border-dashed border-white/20
                     text-white/40 text-sm active:bg-white/5 transition-colors">
          + Add a clip
        </button>
      ) : (
        <div className="card p-4 space-y-3 border-orange-500/20">
          <p className="text-white/60 text-sm font-semibold">Share a clip</p>
          <input value={url} onChange={e => setUrl(e.target.value)}
            placeholder="Paste TikTok, Instagram, YouTube or Twitter link"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5
                       text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50" />
          <input value={caption} onChange={e => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5
                       text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50" />
          <input value={userName} onChange={e => setUserName(e.target.value)}
            placeholder="Your name"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5
                       text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/50" />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button onClick={addClip} disabled={!url.trim() || submitting}
              className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold
                         disabled:opacity-30 active:scale-95 transition-transform">
              {submitting ? 'Adding...' : 'Add Clip'}
            </button>
            <button onClick={() => { setShowAdd(false); setError('') }}
              className="px-4 py-2.5 rounded-xl bg-white/10 text-white/40 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {clips.length === 0 && !showAdd && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🎬</p>
          <p className="text-white/30 text-sm">No clips yet.</p>
          <p className="text-white/20 text-xs mt-1">Share a highlight from TikTok, Instagram or YouTube.</p>
        </div>
      )}

      {clips.length > 0 && (
        <div className="flex justify-end mb-1">
          <div className="flex rounded-xl overflow-hidden border border-white/10">
            <button onClick={() => setView('grid')}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors
                ${view === 'grid' ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/40'}`}>
              ⊞ Grid
            </button>
            <button onClick={() => setView('list')}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors
                ${view === 'list' ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/40'}`}>
              ☰ List
            </button>
          </div>
        </div>
      )}

      {view === 'grid' ? (
        <div className="grid grid-cols-3 gap-2">
          {clips.map(clip => (
            <ClipThumb key={clip.id} clip={clip} onClick={() => setView('list')} />
          ))}
        </div>
      ) : (
        clips.map(clip => (
          <ClipCard key={clip.id} clip={clip} leagueId={apiBase ?? leagueId ?? ''} userName={userName} />
        ))
      )}
    </div>
  )
}
