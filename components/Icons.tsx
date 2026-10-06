// Decorative icons are aria-hidden; meaning always comes from visible text.

type P = { className?: string; title?: string };

export function HeartIcon({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 20.5s-7.5-4.4-9.2-9.3C1.7 7.9 3.8 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.4 0 5.5 3.4 4.4 6.7-1.7 4.9-9.2 9.3-9.2 9.3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WhiskIcon({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M14.5 9.5 21 3" />
      <path d="M14.5 9.5c-2.5-2.5-7.4-3.6-9.6-1.4s-1.1 7.1 1.4 9.6 7.4 3.6 9.6 1.4 1.1-7.1-1.4-9.6z" />
      <path d="M14.5 9.5c-1.6 1.6-5.8.6-7.4-1M14.5 9.5c-1.6 1.6-.6 5.8 1 7.4" />
    </svg>
  );
}

export function SearchIcon({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function MenuIcon({ className, open }: P & { open?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {open ? (
        <path d="M6 6l12 12M18 6 6 18" />
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  );
}

export function CloseIcon({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function CakeArt({ className }: P) {
  // Hand-drawn style illustration used when no photo exists yet. Not presented as her work.
  return (
    <svg className={className} viewBox="0 0 240 200" aria-hidden="true" focusable="false" fill="none" stroke="#3B2728" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="120" cy="176" rx="96" ry="12" fill="#FFF7E8" />
      <path d="M40 174c0-6 4-10 10-10h140c6 0 10 4 10 10" fill="#FFF7E8" />
      <path d="M58 164V112h124v52" fill="#FAE0E7" />
      <path d="M58 112c8 10 16 10 24 0 8 10 16 10 24 0 8 10 16 10 24 0 8 10 16 10 24 0 8 10 16 10 24 0" fill="#FFF7E8" />
      <path d="M72 112V76h96v36" fill="#FFF7E8" />
      <path d="M72 76c6 8 12 8 18 0 6 8 12 8 18 0 6 8 12 8 18 0 6 8 12 8 18 0 6 8 12 8 18 0" fill="#F5C9D5" />
      <path d="M120 76V54" />
      <path d="M120 54c-5-6-5-12 0-18 5 6 5 12 0 18z" fill="#F6D776" />
      <circle cx="96" cy="62" r="7" fill="#B92E46" stroke="#B92E46" />
      <path d="M96 55c2-6 6-9 10-10" stroke="#5f7a3a" />
      <circle cx="146" cy="64" r="7" fill="#B92E46" stroke="#B92E46" />
      <path d="M146 57c-1-6 2-10 7-12" stroke="#5f7a3a" />
      <path d="M86 140h4M110 132h4M136 144h4M158 134h4M100 150h4" stroke="#B92E46" />
    </svg>
  );
}

export function ArrowIcon({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
