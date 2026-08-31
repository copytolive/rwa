import { DEMO_POSITION_ID, PositionDetailPage } from "@/components/trading";

export const dynamicParams=false;
export function generateStaticParams(){return [{id:DEMO_POSITION_ID},{id:"POS-DEMO-002"}];}
export default async function PositionRoute({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PositionDetailPage positionId={id}/>}
