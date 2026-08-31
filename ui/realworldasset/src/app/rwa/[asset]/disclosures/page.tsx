import { DisclosuresDataRoom } from "@/components/compliance";
import { RoutePlaceholder } from "@/components/public";
import "@/components/compliance/compliance-parity.css";
import "@/components/compliance/compliance-parity-fixes.css";

export const dynamicParams = false;
const rwaAssets=["marina-bay-residences","marina-bay-residences-regulated","seaside-private-credit-fund"];

export function generateStaticParams(){
  return [...rwaAssets,"kopi","btc-usdc"].map(asset=>({asset}));
}

export default async function DisclosuresPage({params}:{params:Promise<{asset:string}>}){
  const {asset}=await params;
  if(!rwaAssets.includes(asset)) return <RoutePlaceholder title="Disclosures" path={`/rwa/${asset}/disclosures`}/>;
  return <DisclosuresDataRoom assetSlug={asset}/>;
}
