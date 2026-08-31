import { BusinessRewards } from "@/components/rewards";

export const dynamicParams = false;
export function generateStaticParams(){
  return [
    {business:"kopi-nusantara"},
    {business:"seablue-estate"},
    {business:"harbourview-asset-management"},
  ];
}

export default async function BusinessRewardsPage({params}:{params:Promise<{business:string}>}){
  const {business}=await params;
  return <BusinessRewards slug={business}/>;
}
