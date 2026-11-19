import React, { useEffect, useRef, useState } from 'react';

interface MarqueeTextProps {
  text: string;
  className?: string;
}

export const MarqueeText: React.FC<MarqueeTextProps> = ({ text, className = '' }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shiftPx, setShiftPx] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (!viewportRef.current || !textRef.current) return;
      const overflow = textRef.current.scrollWidth - viewportRef.current.clientWidth;
      setShiftPx(overflow > 4 ? -(overflow + 12) : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [text]);

  return (
    <div ref={viewportRef} className="marquee-viewport">
      <span
        ref={textRef}
        className={`marquee-track ${shiftPx < 0 ? 'animate' : ''} ${className}`}
        style={
          shiftPx < 0
            ? ({ '--marquee-shift': `${shiftPx}px` } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
};
