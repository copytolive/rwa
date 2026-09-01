import { BusinessProfile } from "@/components/details";

export const dynamicParams = false;
export function generateStaticParams() {
  return [
    "kopi-nusantara",
    "seablue-estate",
    "harbourview-asset-management",
    "blue-ocean-shipping",
    "maple-finance",
    "green-city-living",
    "seaside-villas",
  ].map(business => ({ business }));
}

export default async function BusinessDetailPage({params}:{params:Promise<{business:string}>}){
  const {business}=await params;
  return <BusinessProfile slug={business}/>;
}
