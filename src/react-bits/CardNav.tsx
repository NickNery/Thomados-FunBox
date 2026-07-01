import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { gsap } from 'gsap';

export type CardNavLink<T extends string> = {
  label: string;
  tabId: T;
  ariaLabel: string;
};

export type CardNavItem<T extends string> = {
  label: string;
  links: CardNavLink<T>[];
};

type CardNavProps<T extends string> = {
  title: string;
  items: CardNavItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  activeLabel: string;
  className?: string;
  ease?: string;
  baseColor?: string;
  secondaryColor?: string;
  activeColor?: string;
};

export default function CardNav<T extends string>({
  title,
  items,
  activeTab,
  onTabChange,
  activeLabel,
  className = '',
  ease = 'power3.out',
  baseColor = '#2C2F33',
  secondaryColor = '#4A5466',
  activeColor = '#4371CC'
}: CardNavProps<T>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const cardsRef = useRef<HTMLDivElement[]>([]);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  function calculateHeight() {
    const nav = navRef.current;
    const content = nav?.querySelector('.card-nav-content') as HTMLElement | null;

    if (!nav || !content) {
      return 64;
    }

    const previous = {
      height: content.style.height,
      pointerEvents: content.style.pointerEvents,
      position: content.style.position,
      visibility: content.style.visibility
    };

    content.style.height = 'auto';
    content.style.pointerEvents = 'auto';
    content.style.position = 'static';
    content.style.visibility = 'visible';
    const expandedHeight = 64 + content.scrollHeight + 16;
    content.style.height = previous.height;
    content.style.pointerEvents = previous.pointerEvents;
    content.style.position = previous.position;
    content.style.visibility = previous.visibility;
    return expandedHeight;
  }

  function createTimeline() {
    const nav = navRef.current;

    if (!nav) {
      return null;
    }

    gsap.set(nav, { height: 64, overflow: 'hidden' });
    gsap.set(cardsRef.current, { y: 36, opacity: 0 });

    const timeline = gsap.timeline({ paused: true });
    timeline.to(nav, { height: calculateHeight, duration: 0.36, ease });
    timeline.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.3, ease, stagger: 0.06 }, '-=0.16');
    return timeline;
  }

  useLayoutEffect(() => {
    const timeline = createTimeline();
    timelineRef.current = timeline;

    return () => {
      timeline?.kill();
      timelineRef.current = null;
    };
  }, [ease, items]);

  useLayoutEffect(() => {
    function handleResize() {
      const previousTimeline = timelineRef.current;

      if (!previousTimeline) {
        return;
      }

      previousTimeline.kill();
      const nextTimeline = createTimeline();

      if (nextTimeline && isExpanded) {
        nextTimeline.progress(1);
      }

      timelineRef.current = nextTimeline;
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isExpanded]);

  function closeMenu() {
    const timeline = timelineRef.current;

    if (!timeline) {
      setIsExpanded(false);
      return;
    }

    timeline.eventCallback('onReverseComplete', () => setIsExpanded(false));
    timeline.reverse();
  }

  function toggleMenu() {
    if (isExpanded) {
      closeMenu();
      return;
    }

    setIsExpanded(true);
    timelineRef.current?.play(0);
  }

  function selectTab(tabId: T) {
    onTabChange(tabId);
    closeMenu();
  }

  return (
    <div className={`relative z-50 w-full ${className}`}>
      <nav
        ref={navRef}
        className="relative block h-16 overflow-hidden rounded-lg border shadow-lg will-change-[height]"
        style={{ backgroundColor: baseColor, borderColor: secondaryColor, boxShadow: '0 12px 30px rgb(74 84 102 / 20%)' }}
      >
        <div className="absolute inset-x-0 top-0 z-[2] flex h-16 items-center justify-between gap-3 px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{title}</p>
            <p className="truncate text-xs" style={{ color: activeColor }}>{activeLabel}</p>
          </div>

          <button
            type="button"
            onClick={toggleMenu}
            aria-label={isExpanded ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={isExpanded}
            className="group flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-[6px] rounded-md border transition-colors"
            style={{ borderColor: isExpanded ? activeColor : secondaryColor, color: 'white' }}
          >
            <span
              className={`h-0.5 w-6 bg-current transition-transform duration-300 ${isExpanded ? 'translate-y-1 rotate-45' : ''}`}
            />
            <span
              className={`h-0.5 w-6 bg-current transition-transform duration-300 ${isExpanded ? '-translate-y-1 -rotate-45' : ''}`}
            />
          </button>
        </div>

        <div
          className={`card-nav-content absolute inset-x-0 top-16 z-[1] grid gap-2 p-2 sm:grid-cols-3 ${
            isExpanded ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
          }`}
          aria-hidden={!isExpanded}
        >
          {items.slice(0, 3).map((item, itemIndex) => (
            <div
              key={item.label}
              ref={(element) => {
                if (element) {
                  cardsRef.current[itemIndex] = element;
                }
              }}
              className="flex min-h-24 min-w-0 flex-col gap-2 rounded-lg border p-3"
              style={{ backgroundColor: itemIndex % 2 === 0 ? secondaryColor : baseColor, borderColor: secondaryColor }}
            >
              <p className="text-sm font-bold text-white">{item.label}</p>
              <div className="mt-auto grid gap-1">
                {item.links.map((link) => {
                  const isActive = activeTab === link.tabId;

                  return (
                    <button
                      key={link.tabId}
                      type="button"
                      onClick={() => selectTab(link.tabId)}
                      aria-label={link.ariaLabel}
                      aria-current={isActive ? 'page' : undefined}
                      tabIndex={isExpanded ? 0 : -1}
                      className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-white transition-colors"
                      style={{ backgroundColor: isActive ? activeColor : baseColor }}
                    >
                      <span className="min-w-0 truncate">{link.label}</span>
                      <ChevronRight size={14} className="shrink-0" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
