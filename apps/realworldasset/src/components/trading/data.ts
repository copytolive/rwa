export type TradeAsset = {
  slug:string; name:string; symbol:string; pair:string; price:number; change:string; volume:string; marketCap:string; liquidity:string; country:string; business:string; color:string;
};

export const tradeAssets:Record<string,TradeAsset>={
  kopi:{slug:"kopi",name:"Kopi Nusantara",symbol:"KOPI",pair:"KOPI / USDC",price:2.48,change:"+8.72%",volume:"100.24M KOPI",marketCap:"$248.5M",liquidity:"$6.42M",country:"Indonesia",business:"Kopi Nusantara",color:"#9b5b2c"},
  "btc-usdc":{slug:"btc-usdc",name:"Bitcoin",symbol:"BTC",pair:"BTC / USDC",price:66842.35,change:"+1.82%",volume:"$28.45B",marketCap:"$1.32T",liquidity:"$842.71M",country:"Global",business:"Bitcoin Network",color:"#f7931a"},
  "marina-bay-residences":{slug:"marina-bay-residences",name:"Marina Bay Residences",symbol:"MBR",pair:"MBR / USDC",price:1.0234,change:"+1.32%",volume:"$1.14M",marketCap:"$58.72M",liquidity:"$8.91M",country:"Singapore",business:"Harbourview Asset Management",color:"#326bd6"},
  "marina-bay-residences-regulated":{slug:"marina-bay-residences-regulated",name:"Marina Bay Residences",symbol:"MBR",pair:"MBR / USDC",price:1.0234,change:"+0.32%",volume:"$1.14M",marketCap:"$58.72M",liquidity:"$8.91M",country:"Singapore",business:"Harbourview Asset Management",color:"#326bd6"},
  "seaside-private-credit-fund":{slug:"seaside-private-credit-fund",name:"Seaside Private Credit Fund",symbol:"SSPC",pair:"SSPC / USDC",price:1.0821,change:"+0.46%",volume:"$12.8M",marketCap:"$986.4M",liquidity:"$44.1M",country:"Cayman Islands",business:"Seaside Capital Partners",color:"#15a6a6"},
};

export const DEMO_ORDER_ID="ORD-20240517-8F4A2C9D";
export const DEMO_POSITION_ID="POS-KOPI-001";

export function getTradeAsset(slug:string):TradeAsset{return tradeAssets[slug]??{...tradeAssets.kopi,slug,name:slug.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase()),symbol:slug.split("-")[0]?.toUpperCase()||"RWA",pair:`${slug.split("-")[0]?.toUpperCase()||"RWA"} / USDC`};}
