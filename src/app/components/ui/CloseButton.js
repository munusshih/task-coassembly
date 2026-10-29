import CrossIcon from "./CrossIcon";

export default function CloseButton({ label = "Close", className = "", ...props }) {
  return <button type="button" className={`shared-close-button ${className}`} aria-label={label} title={label} {...props}><CrossIcon /></button>;
}
