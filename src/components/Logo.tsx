// Brand mark recreated as crisp, theme-able SVG: a gradient play triangle with a
// 4-point sparkle, plus the Video2Skill wordmark (gradient "2").

export function LogoIcon({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="v2sGrad" x1="8" y1="8" x2="42" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <path
        d="M13 9.2 Q13 6.7 15.3 8 L39.6 22.4 Q42 24 39.6 25.6 L15.3 40 Q13 41.3 13 38.8 Z"
        fill="url(#v2sGrad)"
      />
      <path
        d="M22 14.5 C22.6 20.8 24.7 22.9 31 23.5 C24.7 24.1 22.6 26.2 22 32.5 C21.4 26.2 19.3 24.1 13 23.5 C19.3 22.9 21.4 20.8 22 14.5 Z"
        fill="#fff"
      />
    </svg>
  );
}

export function Logo({
  iconSize = 28,
  showWordmark = true,
  className = "",
  wordmarkClassName = "text-lg font-bold tracking-tight text-gray-900",
}: {
  iconSize?: number;
  showWordmark?: boolean;
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoIcon size={iconSize} />
      {showWordmark && (
        <span className={wordmarkClassName}>
          Video
          <span className="bg-gradient-to-r from-blue-600 to-cyan-400 bg-clip-text text-transparent">
            2
          </span>
          Skill
        </span>
      )}
    </span>
  );
}
