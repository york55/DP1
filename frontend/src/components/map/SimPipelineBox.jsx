import { useState, useRef, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import AccountTreeIcon from '@mui/icons-material/AccountTree'

// Set to false to hide in production
export const SHOW_SIM_PIPELINE = true

// Card geometry (px)
const CARD_W  = 58
const CARD_GAP = 5
const CARD_STEP = CARD_W + CARD_GAP
const SCROLL_PAD = 12   // px of left padding inside the scroll container

const PHASE_COLOR = {
  BLOCK_START: '#1565C0',
  GREEDY_INIT: '#6A1B9A',
  OPTIMIZING:  '#E65100',
  COMPLETE:    '#2E7D32',
}
const PHASE_LABEL = {
  BLOCK_START: 'Inicio',
  GREEDY_INIT: 'Greedy',
  OPTIMIZING:  'Optimizando',
  COMPLETE:    'Completo',
}

function toUTCDate(isoStr) {
  if (!isoStr) return null
  return new Date(isoStr.endsWith('Z') ? isoStr : isoStr + 'Z')
}

function fmtShort(isoStr) {
  const d = toUTCDate(isoStr)
  if (!d) return '—'
  const day = d.getUTCDate()
  const mon = d.toLocaleString('es-PE', { month: 'short', timeZone: 'UTC' })
  const h   = String(d.getUTCHours()).padStart(2, '0')
  return `${day} ${mon} ${h}h`
}

function fmtLookahead(ms) {
  if (ms <= 0) return null
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? (m > 0 ? `+${h}h ${m}m` : `+${h}h`) : `+${m}m`
}

function fmtSimTime(date) {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  const day = d.getUTCDate()
  const mon = d.toLocaleString('es-PE', { month: 'short', timeZone: 'UTC' })
  const h   = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${day} ${mon} ${h}:${min}`
}

// ── Dot grid: fills left-to-right as batches get assigned ──────────────────
const MAX_DOTS = 12

function DotGrid({ assigned, total, status }) {
  if (total === 0) return <Box sx={{ height: 24 }} />
  const n      = Math.min(total, MAX_DOTS)
  const bpd    = total / n
  const filled = Math.min(n, Math.round(assigned / bpd))
  const active = status === 'active'
  const done   = status === 'done'

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '2px', height: 24, alignContent: 'flex-start', pt: '2px' }}>
      {Array.from({ length: n }).map((_, i) => (
        <Box key={i} sx={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
          backgroundColor: i < filled
            ? (done ? '#43A047' : active ? '#FB8C00' : '#43A047')
            : 'transparent',
          border: i < filled ? 'none' : `1px solid ${done ? '#c8e6c9' : '#ddd'}`,
          ...(i < filled && active && {
            animation: 'sp-pulse 1.1s ease-in-out infinite',
          }),
        }} />
      ))}
    </Box>
  )
}

// ── Single block card ───────────────────────────────────────────────────────
function BlockCard({ block, isSimNow }) {
  const { status, blockIndex, assignedBatches, totalBatches, windowStart } = block
  const borderColor = status === 'active' ? '#FB8C00'
    : status === 'done' ? '#43A047' : '#ddd'
  const bg = status === 'active' ? 'rgba(251,140,0,0.06)'
    : status === 'done' ? 'rgba(67,160,71,0.05)' : '#fafafa'

  return (
    <Box sx={{
      flexShrink: 0, width: CARD_W,
      border: `1.5px solid ${borderColor}`,
      borderRadius: '6px',
      backgroundColor: bg,
      p: '4px',
      position: 'relative',
      transition: 'border-color 0.25s',
    }}>
      {/* Sim-now cursor dot above the card */}
      {isSimNow && (
        <Box sx={{
          position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%)',
          width: 8, height: 8, borderRadius: '50%',
          backgroundColor: '#1565C0', border: '2px solid #fff',
          boxShadow: '0 0 0 1.5px #1565C0',
          zIndex: 1,
        }} />
      )}

      {/* B-label + status icon */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: '#1F3864', lineHeight: 1 }}>
          B{blockIndex + 1}
        </Typography>
        <Typography sx={{ fontSize: '0.52rem', color: borderColor, lineHeight: 1 }}>
          {status === 'done' ? '✓' : status === 'active' ? '⟳' : '○'}
        </Typography>
      </Box>

      {/* Time label */}
      <Typography sx={{ fontSize: '0.46rem', color: '#999', lineHeight: 1.3, mt: '2px' }}>
        {fmtShort(windowStart)}
      </Typography>

      {/* Dot grid */}
      <DotGrid assigned={assignedBatches} total={totalBatches} status={status} />

      {/* Batch count */}
      {totalBatches > 0 && (
        <Typography sx={{ fontSize: '0.46rem', color: '#aaa', mt: '1px', fontVariantNumeric: 'tabular-nums' }}>
          {assignedBatches}/{totalBatches}
        </Typography>
      )}
    </Box>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function SimPipelineBox({ planningProgress, blockHistory, totalSimBlocks, simulatedTime }) {
  const [open, setOpen]           = useState(false)
  const [arrowLeft, setArrowLeft] = useState(80)  // px from left edge of the Paper
  const scrollRef = useRef(null)

  const { phase, iteration, maxIterations, assignedBatches, totalBatches, currentObjective } = planningProgress
  const activeBlock = blockHistory.find(b => b.status === 'active')
  const activeIdx   = activeBlock ? activeBlock.blockIndex : -1

  // Compute arrow position: center of the active card minus scroll offset
  const updateArrow = useCallback(() => {
    if (!scrollRef.current || activeIdx < 0) return
    const el = scrollRef.current
    const cardCenter = SCROLL_PAD + activeIdx * CARD_STEP + CARD_W / 2
    const visibleCenter = cardCenter - el.scrollLeft
    // Clamp inside the 320px Paper with 12px side margins
    setArrowLeft(Math.max(16, Math.min(visibleCenter, 304)))
  }, [activeIdx])

  // Auto-scroll to center the active block; then update arrow
  useEffect(() => {
    if (!open || !scrollRef.current || activeIdx < 0) return
    const el = scrollRef.current
    const target = SCROLL_PAD + activeIdx * CARD_STEP + CARD_W / 2 - el.clientWidth / 2
    el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
    setTimeout(updateArrow, 320)  // after scroll animation
  }, [activeIdx, open, updateArrow])

  // Keep arrow in sync while user scrolls manually
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateArrow, { passive: true })
    return () => el.removeEventListener('scroll', updateArrow)
  }, [updateArrow])

  // Recalc arrow when panel opens
  useEffect(() => {
    if (open) setTimeout(updateArrow, 50)
  }, [open, updateArrow])

  // Which block contains simulatedTime?
  const simNowBlockIdx = (() => {
    if (!simulatedTime) return -1
    for (const b of blockHistory) {
      const ws = toUTCDate(b.windowStart)
      const we = toUTCDate(b.windowEnd)
      if (ws && we && simulatedTime >= ws && simulatedTime < we) return b.blockIndex
    }
    return -1
  })()

  // "Calculated until" = windowEnd of the last block that is done OR active
  const calculatedUntilDate = (() => {
    const last = [...blockHistory].reverse().find(b => b.windowEnd)
    return last ? toUTCDate(last.windowEnd) : null
  })()

  // Lookahead = calculatedUntil − simNow
  const lookaheadMs = calculatedUntilDate && simulatedTime
    ? calculatedUntilDate - simulatedTime
    : 0

  const lookaheadLabel = fmtLookahead(lookaheadMs)
  const iterPct  = maxIterations > 0 ? Math.min(100, (iteration / maxIterations) * 100) : 0
  const batchPct = totalBatches > 0  ? Math.min(100, (assignedBatches / totalBatches) * 100) : 0
  const phaseColor = PHASE_COLOR[phase] ?? '#999'
  const phaseLabel = PHASE_LABEL[phase] ?? (phase || 'Inactivo')
  const showAlns  = !!phase && phase !== '' && activeIdx >= 0

  return (
    <>
      <style>{`
        @keyframes sp-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
      `}</style>

      <Box sx={{ position: 'absolute', top: 124, left: 11, zIndex: 1000 }}>
        {/* Toggle button */}
        <Tooltip title="Pipeline de planificación" placement="right">
          <Paper elevation={2} sx={{ borderRadius: '4px', overflow: 'hidden', backgroundColor: open ? '#1F3864' : '#fff' }}>
            <IconButton size="small" onClick={() => setOpen(o => !o)} sx={{ color: open ? '#fff' : '#333', p: '6px' }}>
              <AccountTreeIcon fontSize="small" />
            </IconButton>
          </Paper>
        </Tooltip>

        {open && (
          <Paper elevation={4} sx={{
            mt: 0.5, width: 320,
            backgroundColor: 'rgba(255,255,255,0.97)',
            borderRadius: 1.5,
            backdropFilter: 'blur(4px)',
            overflow: 'hidden',
          }}>

            {/* ── Header ───────────────────────────────────────────── */}
            <Box sx={{ px: '12px', pt: '10px', pb: '6px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '6px' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#1F3864' }}>
                  Pipeline ALNS
                </Typography>
                {totalSimBlocks > 0 && (
                  <Typography sx={{ fontSize: '0.55rem', color: '#bbb' }}>
                    {blockHistory.length}/{totalSimBlocks} bloques
                  </Typography>
                )}
              </Box>

              {/* Time ribbon: sim now → calculated until */}
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: '6px',
                backgroundColor: '#f4f6fb', borderRadius: '6px',
                px: '8px', py: '5px',
              }}>
                {/* Playing now */}
                <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <Typography sx={{ fontSize: '0.48rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Reproduciendo
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#1565C0', fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>
                    {fmtSimTime(simulatedTime)}
                  </Typography>
                </Box>

                {/* Arrow */}
                <Box sx={{ color: lookaheadMs > 0 ? '#43A047' : '#bbb', fontSize: '0.75rem', flexShrink: 0 }}>
                  →
                </Box>

                {/* Calculated until */}
                <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'flex-end' }}>
                  <Typography sx={{ fontSize: '0.48rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Calculado hasta
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#43A047', fontVariantNumeric: 'tabular-nums', lineHeight: 1.3 }}>
                    {fmtSimTime(calculatedUntilDate)}
                  </Typography>
                </Box>

                {/* Lookahead badge */}
                {lookaheadLabel && (
                  <Box sx={{
                    fontSize: '0.55rem', fontWeight: 700, px: '6px', py: '2px',
                    borderRadius: '8px', color: '#2E7D32',
                    backgroundColor: '#E8F5E9', border: '1px solid #A5D6A7',
                    flexShrink: 0, lineHeight: 1.4,
                  }}>
                    {lookaheadLabel}
                  </Box>
                )}
              </Box>
            </Box>

            {/* ── Horizontal block timeline ─────────────────────────── */}
            <Box sx={{ position: 'relative', pb: showAlns ? '4px' : '10px' }}>
              {/* Sim-now label above the cards */}
              {simNowBlockIdx >= 0 && (
                <Box sx={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  pl: `${SCROLL_PAD + simNowBlockIdx * CARD_STEP + CARD_W / 2 - 16}px`,
                  pointerEvents: 'none', zIndex: 2,
                }}>
                  <Typography sx={{ fontSize: '0.42rem', color: '#1565C0', fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1 }}>
                    sim
                  </Typography>
                </Box>
              )}

              <Box
                ref={scrollRef}
                sx={{
                  display: 'flex', gap: `${CARD_GAP}px`,
                  overflowX: 'auto',
                  px: `${SCROLL_PAD}px`, pt: '14px', pb: '8px',
                  '&::-webkit-scrollbar': { height: 3 },
                  '&::-webkit-scrollbar-thumb': { backgroundColor: '#ddd', borderRadius: 2 },
                }}
              >
                {blockHistory.length > 0 ? blockHistory.map(block => (
                  <BlockCard
                    key={block.blockIndex}
                    block={block}
                    isSimNow={block.blockIndex === simNowBlockIdx}
                  />
                )) : (
                  <Typography sx={{ fontSize: '0.6rem', color: '#bbb', py: '8px' }}>
                    Sin bloques aún
                  </Typography>
                )}
              </Box>
            </Box>

            {/* ── ALNS detail — vertically connected to active block ── */}
            {showAlns && (
              <>
                {/* Connector arrow pointing UP at the active block */}
                <Box sx={{ position: 'relative', height: 0, overflow: 'visible' }}>
                  <Box sx={{
                    position: 'absolute',
                    left: arrowLeft,
                    top: -1,
                    transform: 'translateX(-50%)',
                    width: 0, height: 0,
                    borderLeft:   '7px solid transparent',
                    borderRight:  '7px solid transparent',
                    borderBottom: '8px solid #f2f4f8',
                    zIndex: 2,
                  }} />
                </Box>

                <Box sx={{
                  borderTop: '1px solid #e8eaf0',
                  backgroundColor: '#f2f4f8',
                  px: '12px', py: '9px',
                }}>
                  {/* Block id + time range + phase chip */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', mb: '8px', flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#1F3864' }}>
                      B{activeIdx + 1}
                    </Typography>
                    {activeBlock?.windowStart && (
                      <Typography sx={{ fontSize: '0.54rem', color: '#888' }}>
                        {fmtShort(activeBlock.windowStart)}
                        {activeBlock.windowEnd ? ` → ${fmtShort(activeBlock.windowEnd)}` : ''}
                      </Typography>
                    )}
                    <Box sx={{
                      ml: 'auto', px: '6px', py: '1px', borderRadius: '10px',
                      fontSize: '0.54rem', fontWeight: 700,
                      color: '#fff', backgroundColor: phaseColor,
                    }}>
                      {phaseLabel}
                    </Box>
                  </Box>

                  {/* Iteration progress */}
                  <Box sx={{ mb: '6px' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: '2px' }}>
                      <Typography sx={{ fontSize: '0.54rem', color: '#555' }}>Iteraciones</Typography>
                      <Typography sx={{ fontSize: '0.54rem', color: '#555', fontVariantNumeric: 'tabular-nums' }}>
                        {iteration.toLocaleString()} / {maxIterations.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ height: 4, backgroundColor: '#d5d8e4', borderRadius: 2, overflow: 'hidden' }}>
                      <Box sx={{
                        height: '100%', width: `${iterPct}%`,
                        backgroundColor: '#6A1B9A', borderRadius: 2,
                        transition: 'width 0.35s ease',
                      }} />
                    </Box>
                  </Box>

                  {/* Batch progress */}
                  <Box sx={{ mb: currentObjective > 0 ? '6px' : 0 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: '2px' }}>
                      <Typography sx={{ fontSize: '0.54rem', color: '#555' }}>Lotes asignados</Typography>
                      <Typography sx={{ fontSize: '0.54rem', color: '#555', fontVariantNumeric: 'tabular-nums' }}>
                        {assignedBatches} / {totalBatches}
                      </Typography>
                    </Box>
                    <Box sx={{ height: 4, backgroundColor: '#d5d8e4', borderRadius: 2, overflow: 'hidden' }}>
                      <Box sx={{
                        height: '100%', width: `${batchPct}%`,
                        backgroundColor: '#FB8C00', borderRadius: 2,
                        transition: 'width 0.35s ease',
                      }} />
                    </Box>
                  </Box>

                  {/* Objective score */}
                  {currentObjective > 0 && (
                    <Typography sx={{ fontSize: '0.52rem', color: '#999', textAlign: 'right', mt: '2px' }}>
                      obj {currentObjective.toLocaleString('es-PE', { maximumFractionDigits: 1 })}
                    </Typography>
                  )}
                </Box>
              </>
            )}

            {/* Sim-now legend */}
            {simNowBlockIdx >= 0 && (
              <Box sx={{ px: '12px', py: '6px', display: 'flex', alignItems: 'center', gap: '5px', borderTop: '1px solid #eee' }}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#1565C0', border: '1.5px solid #fff', boxShadow: '0 0 0 1.5px #1565C0', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.52rem', color: '#888' }}>
                  Simulación en B{simNowBlockIdx + 1} · {fmtShort(blockHistory.find(b => b.blockIndex === simNowBlockIdx)?.windowStart)}
                </Typography>
              </Box>
            )}
          </Paper>
        )}
      </Box>
    </>
  )
}
