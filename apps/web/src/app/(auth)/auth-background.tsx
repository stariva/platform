/** Декоративный фон страниц авторизации: мягкие дрейфующие пятна света,
 *  едва заметное плетение в духе макраме и плёночное зерно. Только CSS. */
export function AuthBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-parchment"
    >
      <div className="auth-blob auth-blob-a" />
      <div className="auth-blob auth-blob-b" />
      <div className="auth-blob auth-blob-c" />
      <div className="auth-weave" />
      <div className="auth-grain" />
    </div>
  );
}
