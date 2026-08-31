import { BusinessProfile } from "@/components/details";

export const dynamicParams = false;
export function generateStaticParams() {
  return [
    { business: "kopi-nusantara" },
    { business: "seablue-estate" },
    { business: "harbourview-asset-management" },
  ];
}

export default async function BusinessDetailPage({params}:{params:Promise<{business:string}>}){
  const {business}=await params;
  return <BusinessProfile slug={business}/>;
}
