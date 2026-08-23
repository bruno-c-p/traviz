type BrandMarkProps = {
  className?: string;
  size?: number;
  title?: string;
};

export function BrandMark({ className, size = 48, title = "Traviz" }: BrandMarkProps) {
  return (
    <svg
      aria-label={title}
      className={className}
      fill="none"
      height={size}
      role="img"
      viewBox="0 0 48 48"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="currentColor" height="48" rx="14" width="48" />
      <path
        d="M13 15H35M24 15V34"
        stroke="var(--color-on-primary, #0e0f0c)"
        strokeLinecap="round"
        strokeWidth="6"
      />
      <circle cx="13" cy="15" fill="var(--color-on-primary, #0e0f0c)" r="3" />
      <path
        d="M24 34L19.5 29.5M24 34L28.5 29.5"
        stroke="var(--color-on-primary, #0e0f0c)"
        strokeLinecap="round"
        strokeWidth="4"
      />
    </svg>
  );
}
