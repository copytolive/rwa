#property strict
#property version   "2.00"
#property description "GOLD24 strict-qualified canonical translation"
#include <Trade/Trade.mqh>
CTrade trade;

// METHOD: CANDLE_ENGULFING f34/s144 p1=66.0 p2=58.0 p3=1.0 off=2.75 exp=8
// CONFIG_HASH: 7c00212eb6bd65ad07e432d4a261d3f3240478d4d4698cf57e99c549684b61cb
// FROZEN STRICT REFERENCE (qty=100 GOLD units / 1.0 standard-lot reference):
// trades=148, WR=65.540540540541%, PF=1.264150411579, NetProfit=USD 38273.579000000027
// IMPORTANT: Signal/order parameters and D1 signal math below mirror backtest/gold24/core.py.
// Exact PnL parity requires the SAME canonical D1 OHLC history and the canonical stressed cost model.
// Broker XAUUSD/MT5 spread, commission, swap, tick sequence and fills can differ from canonical results.
// For signal-data parity, import the canonical CSV as an MT5 custom symbol and set InpSignalSymbol to it.

input string InpSignalSymbol = "XAUUSD";
input string InpTradeSymbol  = "XAUUSD";
input double InpLot          = 1.0;
input ulong  InpMagic        = 24090102;

const datetime CANONICAL_START = D'2000.10.23 00:00';
const int FAST=34;
const int SLOW=144;
const double SL_USD=23.5;
const double TP_USD=23.5;
const double OFFSET_USD=2.75;
const int EXPIRY_BARS=8;
const string DIRECTION_MODE="LONG_ONLY";
const bool USE_STOP=false;

datetime g_lastBar=0;

void PrepTrade(){ trade.SetExpertMagicNumber(InpMagic); trade.SetTypeFillingBySymbol(InpTradeSymbol); }
bool NewSignalBar(){ datetime t=iTime(InpSignalSymbol,PERIOD_D1,0); if(t==0 || t==g_lastBar) return false; g_lastBar=t; return true; }
bool HasOurPosition(){ if(!PositionSelect(InpTradeSymbol)) return false; return ((ulong)PositionGetInteger(POSITION_MAGIC)==InpMagic); }

ulong OurPendingTicket()
{
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      ulong ticket=OrderGetTicket(i);
      if(ticket==0) continue;
      if(OrderGetString(ORDER_SYMBOL)!=InpTradeSymbol) continue;
      if((ulong)OrderGetInteger(ORDER_MAGIC)!=InpMagic) continue;
      ENUM_ORDER_TYPE type=(ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
      if(type==ORDER_TYPE_BUY_LIMIT || type==ORDER_TYPE_SELL_LIMIT || type==ORDER_TYPE_BUY_STOP || type==ORDER_TYPE_SELL_STOP) return ticket;
   }
   return 0;
}

void CancelExpiredPending()
{
   ulong ticket=OurPendingTicket(); if(ticket==0) return;
   datetime setup=(datetime)OrderGetInteger(ORDER_TIME_SETUP);
   int bars=iBarShift(InpSignalSymbol,PERIOD_D1,setup,false);
   if(bars>=EXPIRY_BARS) trade.OrderDelete(ticket);
}

bool LoadCanonicalRates(MqlRates &r[])
{
   datetime end=iTime(InpSignalSymbol,PERIOD_D1,1); if(end==0) return false;
   ArrayFree(r);
   int copied=CopyRates(InpSignalSymbol,PERIOD_D1,CANONICAL_START,end,r);
   return (copied>0);
}

double PandasEMA(MqlRates &r[],int period)
{
   int n=ArraySize(r); if(n<=0) return EMPTY_VALUE;
   double alpha=2.0/(period+1.0), ema=r[0].close;
   for(int i=1;i<n;i++) ema=alpha*r[i].close+(1.0-alpha)*ema;
   return ema;
}

double SimpleRollingRSI(MqlRates &r[],int period)
{
   int n=ArraySize(r); if(n<period+1) return 50.0;
   double gain=0.0, loss=0.0;
   for(int i=n-period;i<n;i++)
   {
      double d=r[i].close-r[i-1].close;
      if(d>0.0) gain+=d; else if(d<0.0) loss+=(-d);
   }
   gain/=period; loss/=period;
   if(loss==0.0) return 50.0;
   double rs=gain/loss;
   return 100.0-100.0/(1.0+rs);
}

int CanonicalSignal()
{
   MqlRates r[]; if(!LoadCanonicalRates(r)) return 0;
   int n=ArraySize(r), warmup=MathMax(150,SLOW+2);
   if(n<=warmup || n<3) return 0;
   MqlRates cur=r[n-1], prev=r[n-2];
   bool bull=(cur.close>cur.open && prev.close<prev.open && cur.close>=prev.open && cur.open<=prev.close);
   bool bear=(cur.close<cur.open && prev.close>prev.open && cur.close<=prev.open && cur.open>=prev.close);
   double emaFast=PandasEMA(r,FAST);
   double emaSlow=PandasEMA(r,SLOW);
   bool longSig=(bull && emaFast>emaSlow);
   bool shortSig=(bear && emaFast<emaSlow);
   if(DIRECTION_MODE=="LONG_ONLY") shortSig=false;
   if(DIRECTION_MODE=="SHORT_ONLY") longSig=false;
   if(longSig && !shortSig) return 1;
   if(shortSig && !longSig) return -1;
   return 0;
}

double N(double price){ int digits=(int)SymbolInfoInteger(InpTradeSymbol,SYMBOL_DIGITS); return NormalizeDouble(price,digits); }

bool PlaceCanonicalPending(int side)
{
   double close1=iClose(InpSignalSymbol,PERIOD_D1,1); if(close1<=0.0) return false;
   double price=(side==1 ? close1-OFFSET_USD : close1+OFFSET_USD);
   double sl=(side==1 ? price-SL_USD : price+SL_USD);
   double tp=(side==1 ? price+TP_USD : price-TP_USD);
   price=N(price); sl=N(sl); tp=N(tp);
   if(side==1) return trade.BuyLimit(InpLot,price,InpTradeSymbol,sl,tp,ORDER_TIME_GTC,0,"GOLD24_STRICT");
   return trade.SellLimit(InpLot,price,InpTradeSymbol,sl,tp,ORDER_TIME_GTC,0,"GOLD24_STRICT");
}

int OnInit(){ PrepTrade(); if(_Period!=PERIOD_D1) Print("GOLD24: attach/test on D1; logic always reads PERIOD_D1."); return INIT_SUCCEEDED; }

void OnTick()
{
   if(!NewSignalBar()) return;
   CancelExpiredPending();
   if(HasOurPosition() || OurPendingTicket()!=0) return;
   int signal=CanonicalSignal();
   if(signal!=0) PlaceCanonicalPending(signal);
}
