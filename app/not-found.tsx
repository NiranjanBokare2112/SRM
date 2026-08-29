import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return <main className="flex min-h-screen items-center justify-center px-5 text-center"><div><p className="eyebrow justify-center">Page not found</p><h1 className="section-heading mt-4">This page is not available.</h1><p className="mx-auto mt-4 max-w-md text-[var(--ink-muted)]">The page you are looking for may have moved. Return to the Shree Ram Medical home page.</p><Link className="button button-dark mt-8" href="/"><ArrowLeft size={17} /> Back home</Link></div></main>;
}
