import { AssetDetail, getBusinessToken } from "@/components/details";

export const dynamicParams = false;
export function generateStaticParams() {
  return [
    { business: "kopi-nusantara" },
    { business: "seablue-estate" },
    { business: "harbourview-asset-management" },
  ];
}

export default async function BusinessTokenPage({params}:{params:Promise<{business:string}>}){
  const {business}=await params;
  return <AssetDetail asset={getBusinessToken(business)}/>;
}
