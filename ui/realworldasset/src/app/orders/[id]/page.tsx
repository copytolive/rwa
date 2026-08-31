import { DEMO_ORDER_ID, OrderDetailPage } from "@/components/trading";

export const dynamicParams=false;
export function generateStaticParams(){return [{id:DEMO_ORDER_ID},{id:"ORD-DEMO-002"}];}
export default async function OrderRoute({params}:{params:Promise<{id:string}>}){const {id}=await params;return <OrderDetailPage orderId={id}/>}
