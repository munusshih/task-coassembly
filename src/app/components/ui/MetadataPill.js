import Pill from "./Pill";

export default function MetadataPill({ tone = "neutral", className = "", children }) {
  return <Pill className={`metadata-pill metadata-pill--${tone} ${className}`}>{children}</Pill>;
}
