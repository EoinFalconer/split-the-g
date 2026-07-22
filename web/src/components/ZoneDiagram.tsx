// Line-art pint glass showing where the beer line has to land for each
// challenge: the coral band is the scoring zone, the dashed line is the
// perfect 100%. Drawn in the wedding stationery style — ink on paper.
export function ZoneDiagram({
  mode,
  className = '',
}: {
  mode: 'splitG' | 'dropHarp'
  className?: string
}) {
  const split = mode === 'splitG'
  // The GUINNESS wordmark sits at y≈64–72, the harp emblem at y≈28–52.
  // Split the G: the zone is the height of the letter G itself.
  // Drop the Harp: the zone is the gap between the harp and the wordmark.
  const zone = split ? {top: 63.5, bottom: 72.5, line: 68} : {top: 52.5, bottom: 62.5, line: 57.5}
  return (
    <svg
      viewBox="0 0 84 124"
      className={className}
      role="img"
      aria-label={
        split
          ? 'Target: the beer line through the centre of the G on the glass'
          : 'Target: the beer line in the gap between the harp and the word Guinness'
      }
    >
      {/* tulip pint glass */}
      <path
        d="M23 5 Q24 38 28.5 117 L55.5 117 Q60 38 61 5"
        fill="rgba(255,255,255,0.5)"
        stroke="#414198"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* harp emblem */}
      <g stroke="#414198" strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path d="M35 48 Q33 34 42 29 Q51 33 49 48 Z" />
        <path d="M38.5 46 L38 34.5" strokeWidth="1" />
        <path d="M42 46 L42 32.5" strokeWidth="1" />
        <path d="M45.5 46 L46 34.5" strokeWidth="1" />
      </g>
      {/* wordmark — the G is the star of the show */}
      <text
        x="42"
        y="71"
        textAnchor="middle"
        fontFamily="var(--font-body), sans-serif"
        fontSize="8"
        fontWeight="700"
        letterSpacing="0.4"
        fill="#414198"
      >
        <tspan fill={split ? '#e06a45' : '#414198'}>G</tspan>
        UINNESS
      </text>
      {/* scoring zone (½ point on the G) + full-point middle band + perfect line */}
      <rect x="10" y={zone.top} width="64" height={zone.bottom - zone.top} rx="2" fill="rgba(224,106,69,0.22)" />
      {split && (
        <rect x="10" y={zone.line - 1.6} width="64" height="3.2" rx="1" fill="rgba(224,106,69,0.4)" />
      )}
      <line
        x1="6"
        x2="78"
        y1={zone.line}
        y2={zone.line}
        stroke="#e06a45"
        strokeWidth="1.8"
        strokeDasharray="4 3"
        strokeLinecap="round"
      />
    </svg>
  )
}
