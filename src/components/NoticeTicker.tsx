'use client';

import { useEffect, useRef } from 'react';

const NOTICES = [
  '📢 내보내기 버튼을 눌러서 꼭 저장하세요! 📢',
  '💸 모두 부자되세요~! 💸',
];

const SPEED = 80; // px/s

export function NoticeTicker() {
  const trackRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const text = textRef.current;
    if (!track || !text) return;

    const from = track.offsetWidth;
    const to = -text.offsetWidth;
    const duration = ((from - to) / SPEED) * 1000;

    const anim = text.animate(
      [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }],
      { duration, iterations: Infinity, easing: 'linear' },
    );

    const pause = () => anim.pause();
    const resume = () => anim.play();
    track.addEventListener('mouseenter', pause);
    track.addEventListener('mouseleave', resume);

    return () => {
      anim.cancel();
      track.removeEventListener('mouseenter', pause);
      track.removeEventListener('mouseleave', resume);
    };
  }, []);

  return (
    <div className="notice-ticker" aria-label="공지사항">
      <span className="notice-ticker__badge">공지</span>
      <div className="notice-ticker__track" ref={trackRef}>
        <span className="notice-ticker__text" ref={textRef}>
          {NOTICES.map((notice, i) => (
            <span key={i} className="notice-ticker__item">{notice}</span>
          ))}
        </span>
      </div>
    </div>
  );
}
