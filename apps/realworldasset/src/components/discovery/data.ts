export type Business = {slug:string;name:string;category:string;country:string;symbol:string;price:string;change:string;marketCap:string;followers:string;verified:boolean;rating:string;metrics:string[]};
export type Asset = {slug:string;name:string;className:string;issuer:string;country:string;symbol:string;aum:string;yield:string;maturity:string;verified:boolean};
export type Person = {slug:string;name:string;handle:string;role:string;followers:string};

export const businesses: Business[] = [
 {slug:"kopi-nusantara",name:"Kopi Nusantara",category:"Food & Beverage",country:"Indonesia",symbol:"KOPI",price:"$2.48",change:"+8.72%",marketCap:"$248.5M",followers:"12.6K",verified:true,rating:"4.8",metrics:["42 Stores","18 Products","1.2M Customers"]},
 {slug:"seablue-estate",name:"Seablue Estate",category:"Real Estate",country:"Singapore",symbol:"SEA",price:"$4.21",change:"+5.18%",marketCap:"$158.2M",followers:"8.3K",verified:true,rating:"4.7",metrics:["6 Projects","23 Units","860 Clients"]},
 {slug:"blue-ocean-shipping",name:"Blue Ocean Shipping",category:"Shipping & Logistics",country:"Singapore",symbol:"SHIP",price:"$1.35",change:"+3.20%",marketCap:"$96.4M",followers:"5.4K",verified:true,rating:"4.7",metrics:["12 Vessels","24 Routes","320 Clients"]},
 {slug:"maple-finance",name:"Maple Finance",category:"Finance",country:"Singapore",symbol:"MAPLE",price:"$1.96",change:"+6.31%",marketCap:"$82.1M",followers:"9.1K",verified:true,rating:"4.7",metrics:["3 Products","125K Users","$450M TVL"]},
 {slug:"green-city-living",name:"GreenCity Living",category:"Real Estate",country:"Indonesia",symbol:"GCL",price:"$2.15",change:"+4.91%",marketCap:"$67.8M",followers:"7.2K",verified:true,rating:"4.6",metrics:["8 Projects","156 Units","1.1K Residents"]},
 {slug:"seaside-villas",name:"Seaside Villas",category:"Hospitality",country:"Indonesia",symbol:"VILLA",price:"$1.28",change:"+2.64%",marketCap:"$43.6M",followers:"6.3K",verified:true,rating:"4.6",metrics:["10 Properties","85 Rooms","4.8K Guests"]},
];

export const assets: Asset[] = [
 {slug:"marina-bay-residences",name:"Marina Bay Residences",className:"Real Estate",issuer:"Harbourview Capital",country:"Singapore",symbol:"MBR",aum:"$1.28B",yield:"5.25%",maturity:"Dec 2031",verified:true},
 {slug:"seaside-private-credit-fund",name:"Seaside Private Credit Fund",className:"Private Credit",issuer:"Seaside Capital Partners",country:"Cayman Islands",symbol:"SSPC",aum:"$986.4M",yield:"11.75%",maturity:"Jun 2027",verified:true},
 {slug:"treasury-income-note",name:"Treasury Income Note",className:"Treasury & Bonds",issuer:"RWA Treasury",country:"United States",symbol:"TIN",aum:"$872.1M",yield:"4.85%",maturity:"Feb 2026",verified:true},
 {slug:"gold-reserve-trust",name:"Gold Reserve Trust",className:"Commodities",issuer:"Aurum Digital",country:"Switzerland",symbol:"GOLD",aum:"$765.3M",yield:"0.90%",maturity:"N/A",verified:true},
 {slug:"blue-port-logistics-infrastructure",name:"Blue Port Logistics Infrastructure",className:"Infrastructure",issuer:"BluePort Asset Management",country:"Netherlands",symbol:"BPLI",aum:"$654.2M",yield:"7.20%",maturity:"Aug 2032",verified:true},
 {slug:"green-energy-fund",name:"Green Energy Fund",className:"Funds",issuer:"Sustainable Yield Fund",country:"Germany",symbol:"GEF",aum:"$532.6M",yield:"8.60%",maturity:"Nov 2032",verified:true},
];

export const people: Person[] = [
 {slug:"andreas-wijaya",name:"Andreas Wijaya",handle:"@andreaswijaya",role:"Head of Research @ RWA Research",followers:"12.6K"},
 {slug:"jessica-santoso",name:"Jessica Santoso",handle:"@jessSantoso",role:"Analyst @ RWA Capital",followers:"8.7K"},
 {slug:"michael-tanuwijaya",name:"Michael Tanuwijaya",handle:"@mtanuwijaya",role:"Founder @ Kopifam Group",followers:"5.4K"},
];
