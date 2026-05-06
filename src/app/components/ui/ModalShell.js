"use client";

export default function ModalShell({
  title,
  onClose,
  children,
  footer,
  size = "md",
  className = "",
  bodyClassName = "",
  closeTitle = "Close",
  closeOnOverlayClick = false,
  hasUnsavedChanges = false,
  unsavedWarning = "You have unsaved changes. Close anyway?",
  onDiscardChanges,
}) {
  const modalClasses = [
    "edit-modal",
    size === "sm" ? "edit-modal--sm" : "",
    size === "lg" ? "edit-modal--lg" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const bodyClasses = ["edit-modal-body", bodyClassName]
    .filter(Boolean)
    .join(" ");

  function requestClose() {
    if (!onClose) return;
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(unsavedWarning);
      if (!confirmed) return;
      if (typeof onDiscardChanges === "function") onDiscardChanges();
    }
    onClose();
  }

  function handleOverlayClick() {
    if (!closeOnOverlayClick) return;
    requestClose();
  }

  return (
    <div className="edit-modal-overlay" onClick={handleOverlayClick}>
      <div
        className={modalClasses}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || onClose) && (
          <div className="edit-modal-header">
            <span className="edit-modal-title">{title}</span>
            {onClose ? (
              <button
                type="button"
                className="edit-modal-close"
                onClick={requestClose}
                title={closeTitle}
              >
                ✕
              </button>
            ) : null}
          </div>
        )}
        <div className={bodyClasses}>{children}</div>
        {footer ? <div className="edit-modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
