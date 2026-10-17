import { notFound } from "next/navigation";
import { SHARE_ID_PATTERN } from "../../lib/shareUrl.mjs";
import ShareLinkClient from "./ShareLinkClient";

export default async function ShareLinkPage({ params }) {
  const { id } = await params;
  if (!SHARE_ID_PATTERN.test(id)) notFound();
  return <ShareLinkClient id={id} />;
}
