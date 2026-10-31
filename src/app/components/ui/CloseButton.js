import ControlSurface from "./ControlSurface";
import CrossIcon from "./CrossIcon";

export default function CloseButton({ label = "Close", className = "", ...props }) {
  return <ControlSurface type="button" className={`shared-close-button ${className}`} aria-label={label} title={label} {...props}><CrossIcon /></ControlSurface>;
}
