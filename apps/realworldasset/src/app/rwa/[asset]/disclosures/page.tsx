import { LiveRouteWorkspace } from "@/components/live-dashboard";

export const dynamicParams = false;
const rwaAssets=["marina-bay-residences","marina-bay-residences-regulated","seaside-private-credit-fund","kopi","btc-usdc"];

export function generateStaticParams(){
  return rwaAssets.map(asset=>({asset}));
}

export default async function DisclosuresPage({params}:{params:Promise<{asset:string}>}){
  const {asset}=await params;
  return <LiveRouteWorkspace title={`${asset.replace(/-/g," ")} / Disclosures`} path={`/rwa/${asset}/disclosures`}/>;
}
