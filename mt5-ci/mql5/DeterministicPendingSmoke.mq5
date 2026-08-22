#property strict
#include <Trade\Trade.mqh>
CTrade trade;
input double Lots=0.10;
input int DistancePoints=20;
input int RiskPoints=20;
input int RewardPoints=40;
input datetime BuyOrderTime=D'2024.01.02 00:10:00';
input datetime SellOrderTime=D'2024.01.02 01:10:00';
input ulong Magic=26082301;
bool buy_placed=false,sell_placed=false;

int OnInit(){trade.SetExpertMagicNumber(Magic);trade.SetDeviationInPoints(0);return INIT_SUCCEEDED;}
bool Busy(){
 for(int i=PositionsTotal()-1;i>=0;i--){ulong t=PositionGetTicket(i);if(t>0&&PositionSelectByTicket(t)&&((ulong)PositionGetInteger(POSITION_MAGIC)==Magic)&&PositionGetString(POSITION_SYMBOL)==_Symbol)return true;}
 for(int i=OrdersTotal()-1;i>=0;i--){ulong t=OrderGetTicket(i);if(t>0&&OrderSelect(t)&&((ulong)OrderGetInteger(ORDER_MAGIC)==Magic)&&OrderGetString(ORDER_SYMBOL)==_Symbol)return true;}
 return false;
}
void Buy(){MqlTick q;if(!SymbolInfoTick(_Symbol,q))return;double e=NormalizeDouble(q.ask+DistancePoints*_Point,_Digits),sl=NormalizeDouble(e-RiskPoints*_Point,_Digits),tp=NormalizeDouble(e+RewardPoints*_Point,_Digits);if(trade.BuyStop(Lots,e,_Symbol,sl,tp,ORDER_TIME_GTC,0,"SMOKE_BUY"))buy_placed=true;}
void Sell(){MqlTick q;if(!SymbolInfoTick(_Symbol,q))return;double e=NormalizeDouble(q.bid-DistancePoints*_Point,_Digits),sl=NormalizeDouble(e+RiskPoints*_Point,_Digits),tp=NormalizeDouble(e-RewardPoints*_Point,_Digits);if(trade.SellStop(Lots,e,_Symbol,sl,tp,ORDER_TIME_GTC,0,"SMOKE_SELL"))sell_placed=true;}
void OnTick(){datetime n=TimeCurrent();if(!buy_placed&&n>=BuyOrderTime&&n<D'2024.01.02 00:20:00'&&!Busy())Buy();if(!sell_placed&&n>=SellOrderTime&&n<D'2024.01.02 01:20:00'&&!Busy())Sell();}
string E(long x){if(x==DEAL_ENTRY_IN)return"IN";if(x==DEAL_ENTRY_OUT)return"OUT";return"OTHER";} string T(long x){if(x==DEAL_TYPE_BUY)return"BUY";if(x==DEAL_TYPE_SELL)return"SELL";return"OTHER";}
void OnDeinit(const int reason){
 if(!HistorySelect(D'2024.01.01 00:00:00',D'2024.01.03 23:59:59'))return;
 int h=FileOpen("mt5_smoke_deals.csv",FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON,',');if(h==INVALID_HANDLE)return;FileWrite(h,"position_id","entry","type","time_msc","price","profit");
 for(int i=0;i<HistoryDealsTotal();i++){ulong d=HistoryDealGetTicket(i);if(d==0||HistoryDealGetString(d,DEAL_SYMBOL)!=_Symbol||(ulong)HistoryDealGetInteger(d,DEAL_MAGIC)!=Magic)continue;long en=HistoryDealGetInteger(d,DEAL_ENTRY),ty=HistoryDealGetInteger(d,DEAL_TYPE);if(en!=DEAL_ENTRY_IN&&en!=DEAL_ENTRY_OUT)continue;FileWrite(h,(long)HistoryDealGetInteger(d,DEAL_POSITION_ID),E(en),T(ty),(long)HistoryDealGetInteger(d,DEAL_TIME_MSC),DoubleToString(HistoryDealGetDouble(d,DEAL_PRICE),_Digits),DoubleToString(HistoryDealGetDouble(d,DEAL_PROFIT),2));}
 FileClose(h);
}
