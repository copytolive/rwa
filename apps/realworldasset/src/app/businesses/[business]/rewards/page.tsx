import { BusinessRewards } from "@/components/rewards";

export const dynamicParams = false;
export function generateStaticParams(){
  return [
    "kopi-nusantara",
    "seablue-estate",
    "harbourview-asset-management",
    "blue-ocean-shipping",
    "maple-finance",
    "green-city-living",
    "seaside-villas",
  ].map(business => ({business}));
}

export default async function BusinessRewardsPage({params}:{params:Promise<{business:string}>}){
  const {business}=await params;
  return <BusinessRewards slug={business}/>;
}
