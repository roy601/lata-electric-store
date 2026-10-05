import { useEffect, useRef, useState } from 'react';

/** Fades its content up once it scrolls into view (CSS in global.css). */
export default function Reveal({ as: Tag = 'div', children, className = '', ...rest }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={`reveal${inView ? ' is-in' : ''} ${className}`.trim()} {...rest}>{children}</Tag>;
}
