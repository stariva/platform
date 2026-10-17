/** Декоративный фон страниц авторизации: сетка тонких линий, тающая вниз,
 *  и мягкое пастельное свечение за логотипом. Только CSS. */
export function AuthBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-parchment"
    >
      <div className="auth-aurora-glow" />
      <div className="auth-grid" />
      <div className="auth-aurora" />
      <div className="auth-grain" />
    </div>
  );
}
