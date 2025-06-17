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
 *  - color: Color for filled segments (default: '#3b82f6')
 *  - onSegmentClick: Function called when a segment is clicked (index)
 *  - style: Additional styles for the container
 */
export default function Clock({ 
  label, 
  total, 
  filled, 
  size = 80, 
  strokeWidth = 10, 
  color = '#3b82f6',
  onSegmentClick,
  style = {}
}) {
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
        stroke={i < filled ? color : '#374151'}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="butt"
        style={{ cursor: onSegmentClick ? 'pointer' : 'default' }}
        onClick={() => onSegmentClick && onSegmentClick(i)}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', ...style }}>
      <svg width={size} height={size}>
        {segments}
      </svg>
      {label && (
        <div style={{ 
          marginTop: '4px', 
          fontSize: '9px', 
          fontWeight: 'bold', 
          color: color,
          textAlign: 'center'
        }}>
          {label}
        </div>
      )}
    </div>
  );
}
