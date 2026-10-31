import ControlSurface from "./ControlSurface";
export default function EditButton({ label = "Edit", className = "", ...props }) {
  return <ControlSurface type="button" className={`shared-edit-button ${className}`} aria-label={label} title={label} {...props}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l1-5L16 4a2.8 2.8 0 0 1 4 4L9 19l-5 1Z" /></svg></ControlSurface>;
}
