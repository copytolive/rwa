import { Suspense } from "react";
import { SearchResults } from "@/components/discovery";
export default function SearchPage(){return <Suspense fallback={<main style={{padding:40}}>Loading search…</main>}><SearchResults/></Suspense>}
