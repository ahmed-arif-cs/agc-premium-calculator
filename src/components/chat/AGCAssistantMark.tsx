export function AGCAssistantMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle
        cx="24"
        cy="24"
        r="22.5"
        stroke="rgba(var(--c-accent-rgb), 0.45)"
        strokeWidth="1.5"
      />
      <circle cx="24" cy="24" r="19" fill="rgba(var(--c-accent-rgb), 0.08)" />
      {/* Stylized phoenix mark — echoes the AGC logo's wings without copying it pixel-for-pixel */}
      <path
        d="M24 11.5c1.6 2.1 2.4 4.2 2.4 6.3 0 1.1-.3 2.1-.9 3 2.6-.6 5.1-1.9 7.5-3.9-.5 3.4-2.1 6.1-4.8 8.1 2.3.2 4.6-.2 6.8-1.3-1.7 3.1-4.3 5.2-7.8 6.3 1.8 1 3.8 1.5 6 1.5-2.6 2.1-5.6 3-9 2.7.9 1.6 2.2 2.9 3.9 3.8-3-.1-5.5-1.1-7.6-3-.2 1.7-.9 3.1-2.1 4.3-.2-1.7-.7-3.1-1.6-4.3-2 2-4.5 3-7.5 3.1 1.6-1 2.9-2.3 3.7-3.9-3.3.2-6.2-.7-8.7-2.7 2.1 0 4-.5 5.7-1.5-3.4-1.2-5.9-3.4-7.5-6.5 2.1 1.1 4.3 1.5 6.6 1.3-2.6-2-4.1-4.7-4.5-8.1 2.3 2 4.7 3.3 7.2 3.9-.5-.9-.7-1.8-.7-2.9 0-2.1.7-4.2 2.3-6.3.4 2 1.2 3.6 2.4 4.9 1.1-1.3 1.9-2.9 2.2-4.9z"
        fill="var(--c-accent-soft)"
      />
      <circle cx="24" cy="21.5" r="1.6" fill="#0a0e17" />
    </svg>
  );
}