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
}) {
  const modalClasses = [
    "edit-modal",
    size === "sm" ? "edit-modal--sm" : "",
    size === "lg" ? "edit-modal--lg" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const bodyClasses = ["edit-modal-body", bodyClassName].filter(Boolean).join(" ");

  return (
    <div className="edit-modal-overlay" onClick={onClose}>
      <div className={modalClasses} onClick={(event) => event.stopPropagation()}>
        {(title || onClose) && (
          <div className="edit-modal-header">
            <span className="edit-modal-title">{title}</span>
            {onClose ? (
              <button type="button" className="edit-modal-close" onClick={onClose} title={closeTitle}>
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
