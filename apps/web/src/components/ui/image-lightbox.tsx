import { useEffect } from "react";
import { createPortal } from "react-dom";

export function ImageLightbox({
  imageUrl,
  label,
  onClose,
  testId = "image-lightbox",
  zIndexClassName = "z-50",
}: {
  imageUrl: string;
  label: string;
  onClose: () => void;
  testId?: string;
  zIndexClassName?: string;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndexClassName} overflow-auto bg-black/85 p-4 backdrop-blur-sm`}
      role="dialog"
      aria-modal="true"
      aria-label={`${label} 预览`}
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
      data-testid={testId}
    >
      <div className="flex min-h-full min-w-full items-start justify-center p-4">
        <img
          src={imageUrl}
          alt={label}
          className="max-w-none rounded-md shadow-2xl"
          draggable={false}
        />
      </div>
    </div>,
    document.body,
  );
}
