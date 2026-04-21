"use client";

function IconBase({
  children,
  size = 14,
  strokeWidth = 1.5,
  className = "",
  ...props
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconChecklist(props) {
  return (
    <IconBase {...props}>
      <rect x="1.5" y="1.5" width="11" height="11" rx="2" />
      <polyline points="4,7 6,9.5 10,5" />
    </IconBase>
  );
}

export function IconUser(props) {
  return (
    <IconBase {...props}>
      <circle cx="7" cy="4.5" r="2.5" />
      <path d="M2 12c0-2.76 2.24-5 5-5s5 2.24 5 5" />
    </IconBase>
  );
}

export function IconUsers(props) {
  return (
    <IconBase {...props}>
      <circle cx="5.5" cy="5" r="2" />
      <path d="M1 12c0-2.2 2-3.5 4.5-3.5S10 9.8 10 12" />
      <circle cx="10.5" cy="5" r="1.5" />
      <path d="M10 8.7c1.8.3 3 1.4 3 3.3" />
    </IconBase>
  );
}

export function IconFolder(props) {
  return (
    <IconBase {...props}>
      <path d="M1.5 3.5h4l1.5 2h5.5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H1.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z" />
    </IconBase>
  );
}

export function IconChartLine(props) {
  return (
    <IconBase {...props}>
      <polyline points="1.5,10.5 4.5,6.5 7,8.5 10,4.5 12.5,6" />
      <line x1="1.5" y1="12" x2="12.5" y2="12" />
    </IconBase>
  );
}

export function IconDocument(props) {
  return (
    <IconBase {...props}>
      <rect x="2.5" y="1" width="9" height="12" rx="1.5" />
      <line x1="4.5" y1="5" x2="9.5" y2="5" />
      <line x1="4.5" y1="7.5" x2="9.5" y2="7.5" />
      <line x1="4.5" y1="10" x2="7.5" y2="10" />
    </IconBase>
  );
}

export function IconLink(props) {
  return (
    <IconBase {...props}>
      <path d="M5.5 9.5a4 4 0 0 0 3 1.5 3.5 3.5 0 0 0 0-7H7" />
      <path d="M8.5 4.5a4 4 0 0 0-3-1.5 3.5 3.5 0 0 0 0 7H7" />
    </IconBase>
  );
}

export function IconBacklog(props) {
  return (
    <IconBase {...props}>
      <line x1="2" y1="4" x2="8" y2="4" />
      <line x1="2" y1="7" x2="9.5" y2="7" />
      <line x1="2" y1="10" x2="7" y2="10" />
      <polyline points="10.5,5.5 12,7 10.5,8.5" />
    </IconBase>
  );
}

export function IconList(props) {
  return (
    <IconBase {...props}>
      <line x1="2" y1="4" x2="12" y2="4" />
      <line x1="2" y1="7" x2="12" y2="7" />
      <line x1="2" y1="10" x2="12" y2="10" />
    </IconBase>
  );
}

export function IconKanban(props) {
  return (
    <IconBase {...props}>
      <rect x="1" y="2" width="3.5" height="10" rx="1" />
      <rect x="5.25" y="2" width="3.5" height="7" rx="1" />
      <rect x="9.5" y="2" width="3.5" height="5" rx="1" />
    </IconBase>
  );
}

export function IconEdit(props) {
  return (
    <IconBase {...props}>
      <path d="M2 9.8V12h2.2l6.3-6.3-2.2-2.2L2 9.8z" />
      <path d="M7.8 3.4l2.2 2.2" />
      <path d="M2 12h10" />
    </IconBase>
  );
}

export function IconTrash(props) {
  return (
    <IconBase {...props}>
      <path d="M2.5 3.5h9" />
      <path d="M5 3.5V2h4v1.5" />
      <rect x="3.5" y="3.5" width="7" height="8.5" rx="1" />
      <line x1="6" y1="6" x2="6" y2="10" />
      <line x1="8" y1="6" x2="8" y2="10" />
    </IconBase>
  );
}

export function IconBookGrid(props) {
  return (
    <IconBase {...props}>
      <rect x="1" y="2" width="5" height="9.5" rx="0.5" />
      <line x1="2.5" y1="2" x2="2.5" y2="11.5" strokeWidth="1.5" />
      <rect x="8" y="2" width="5" height="9.5" rx="0.5" />
      <line x1="9.5" y1="2" x2="9.5" y2="11.5" strokeWidth="1.5" />
    </IconBase>
  );
}

export function IconBookShelf(props) {
  return (
    <IconBase {...props}>
      <rect x="0.5" y="2" width="2.5" height="9" rx="0.5" />
      <rect x="4" y="4" width="2.5" height="7" rx="0.5" />
      <rect x="7.5" y="2.5" width="2.5" height="8.5" rx="0.5" />
      <rect x="11" y="3" width="2.5" height="8" rx="0.5" />
      <line x1="0" y1="12.5" x2="14" y2="12.5" />
    </IconBase>
  );
}

export const EDIT_ICON = <IconEdit />;
export const DELETE_ICON = <IconTrash />;
export const LIST_VIEW_ICON = <IconList />;
export const KANBAN_VIEW_ICON = <IconKanban />;
export const MEMBER_VIEW_ICON = <IconUser />;
export const PROJECT_VIEW_ICON = <IconFolder />;
export const DATE_VIEW_ICON = <IconDocument />;
export const BOOK_GRID_ICON = <IconBookGrid />;
export const BOOK_SHELF_ICON = <IconBookShelf />;
