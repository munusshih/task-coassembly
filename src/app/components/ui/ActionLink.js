import ControlSurface from "./ControlSurface";
import styles from "./ActionLink.module.css";

export default function ActionLink({ href, children, className = "", iconOnly=false, label }) {
  const classes = ["btn", "btn--ghost", styles.link, iconOnly&&styles.iconOnly, className]
    .filter(Boolean)
    .join(" ");

  return (
    <ControlSurface as="a"
      className={classes}
      href={href}
      aria-label={iconOnly?label:undefined}
      title={iconOnly?label:undefined}
      target="_blank"
      rel="noopener noreferrer"
    >
      {iconOnly?<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-10 10M10 4H4v16h16v-6"/></svg>:<>{children}<span aria-hidden="true">↗</span></>}
    </ControlSurface>
  );
}
