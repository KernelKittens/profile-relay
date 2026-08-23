import type { Metadata } from "next";
import { SiteShell } from "./site-shell";
import { loadRuntimeConfig } from "../lib/config";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await loadRuntimeConfig();
  return {
    title: site.profile.name,
    description: site.profile.bio,
  };
}

export default async function Home() {
  const { site } = await loadRuntimeConfig();
  return <SiteShell config={site} />;
}
