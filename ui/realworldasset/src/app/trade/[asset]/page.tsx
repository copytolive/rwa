import { TradingPage } from "@/components/trading";

export const dynamicParams=false;
export function generateStaticParams(){return ["kopi","btc-usdc","marina-bay-residences","marina-bay-residences-regulated","seaside-private-credit-fund"].map(asset=>({asset}));}
export default async function TradeRoute({params}:{params:Promise<{asset:string}>}){const {asset}=await params;return <TradingPage assetSlug={asset}/>}
