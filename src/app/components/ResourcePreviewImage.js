"use client";

import { useEffect, useState } from "react";
import { resourceRevision } from "./resourceMetadata.mjs";
const requests = new Map();

export default function ResourcePreviewImage({ link }) {
  const [preview, setPreview] = useState(null);
  const revision = resourceRevision(link.data);
  const url = /^https?:\/\//i.test(link.data.url || "") ? link.data.url : `https://${link.data.url || ""}`;
  useEffect(() => {
    let live = true;
    const identity = JSON.stringify([link.id, url, revision]);
    if (!requests.has(identity)) requests.set(identity, fetch("/api/resource-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: link.id, url, revision }) }).then((response) => response.json()).catch(() => ({ image: false })));
    setPreview(null);
    requests.get(identity).then((result) => { if (live) setPreview(result); });
    return () => { live = false; };
  }, [link.id, url, revision]);
  if (!preview?.src || preview.favicon) return null;
  return <img className={`resource-preview-image${preview.favicon ? " resource-preview-image--favicon" : ""}`} src={preview.src} alt="" onError={() => setPreview(null)} />;
}
