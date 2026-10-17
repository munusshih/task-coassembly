import { notFound } from "next/navigation";
import Home from "../page";
import { isViewPath } from "../lib/viewUrl.mjs";

export default async function ViewPage({ params }) {
  const { view } = await params;
  if (!isViewPath(view)) notFound();
  return <Home />;
}
