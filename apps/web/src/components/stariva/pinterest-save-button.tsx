"use client";

/**
 * Pinterest "Save" button — opens the Pinterest pin creation dialog
 * with pre-filled image, URL, and description.
 *
 * Works without loading Pinterest SDK (privacy-friendly, no third-party scripts).
 */

interface PinterestSaveButtonProps {
  /** Full URL of the page (e.g. https://stariva.ru/catalog/interior/lampshade-dome) */
  url: string;
  /** Full image URL to pin */
  imageUrl: string;
  /** Description for the pin */
  description: string;
  /** Visual variant */
  variant?: "icon" | "button";
  /** Additional class names */
  className?: string;
}

function PinterestIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
    </svg>
  );
}

export function PinterestSaveButton({
  url,
  imageUrl,
  description,
  variant = "button",
  className = "",
}: PinterestSaveButtonProps) {
  const handleClick = () => {
    const pinUrl = new URL("https://pinterest.com/pin/create/button/");
    pinUrl.searchParams.set("url", url);
    pinUrl.searchParams.set("media", imageUrl);
    pinUrl.searchParams.set("description", description);

    window.open(
      pinUrl.toString(),
      "pinterest-share",
      "width=750,height=550,toolbar=0,menubar=0,location=0,status=0,scrollbars=0,resizable=1",
    );
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center justify-center w-10 h-10 rounded-full border border-espresso/15 text-taupe hover:text-[#E60023] hover:border-[#E60023]/30 transition-colors ${className}`}
        aria-label="Сохранить в Pinterest"
        title="Сохранить в Pinterest"
      >
        <PinterestIcon className="w-4.5 h-4.5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-espresso/15 text-sm text-taupe hover:text-[#E60023] hover:border-[#E60023]/30 transition-colors ${className}`}
      aria-label="Сохранить в Pinterest"
    >
      <PinterestIcon className="w-4 h-4" />
      <span>Сохранить в Pinterest</span>
    </button>
  );
}
