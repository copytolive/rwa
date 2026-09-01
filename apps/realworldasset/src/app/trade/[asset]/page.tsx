import { TradingPage } from "@/components/trading";

export const dynamicParams=false;
export function generateStaticParams(){return [
  "kopi",
  "btc-usdc",
  "marina-bay-residences",
  "marina-bay-residences-regulated",
  "seaside-private-credit-fund",
  "treasury-income-note",
  "gold-reserve-trust",
  "blue-port-logistics-infrastructure",
  "green-energy-fund",
].map(asset=>({asset}));}
export default async function TradeRoute({params}:{params:Promise<{asset:string}>}){const {asset}=await params;return <TradingPage assetSlug={asset}/>}
