import React from 'react';

/**
 * A segmented circular "progress clock" component.
 * Displays a circle divided into `total` segments, with `filled` segments colored.
 *
 * Props:
 *  - label: Optional label displayed below the clock
 *  - total: Number of segments (e.g., 4, 6, 8)
 *  - filled: Number of segments to fill (0..total)
 *  - size: Optional diameter of the SVG in pixels (default: 80)
 *  - strokeWidth: Optional segment thickness (default: 10)
 */
export default function Clock({ label, total, filled, size = 80, strokeWidth = 10 }) {
  const segments = [];
  const anglePer = 360 / total;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  for (let i = 0; i < total; i++) {
    // Calculate start and end angles for each segment
    const startAngle = anglePer * i - 90;
    const endAngle = startAngle + anglePer;
    const x1 = center + radius * Math.cos((Math.PI * startAngle) / 180);
    const y1 = center + radius * Math.sin((Math.PI * startAngle) / 180);
    const x2 = center + radius * Math.cos((Math.PI * endAngle) / 180);
    const y2 = center + radius * Math.sin((Math.PI * endAngle) / 180);
    const largeArcFlag = anglePer > 180 ? 1 : 0;
    // Path for arc segment
    const d = [`M ${x1} ${y1}`, `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`].join(' ');

    segments.push(
      <path
        key={i}
        d={d}
        stroke={i < filled ? 'currentColor' : '#e5e7eb'}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="butt"
      />
    );
  }

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="text-indigo-600">
        {segments}
      </svg>
      {label && <div className="mt-1 text-sm font-medium text-gray-700">{label}</div>}
    </div>
  );
}
