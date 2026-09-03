#property strict
#property version   "1.00"
#include <Trade/Trade.mqh>
CTrade trade;

input string InpSymbol = "XAUUSD";
input double InpLot = 1.0;
input ulong InpMagic = 24082803;

datetime g_lastBar=0;

bool HasExposure()
{
   if(PositionSelect(InpSymbol)) return true;
   for(int i=OrdersTotal()-1;i>=0;i--)
   {
      ulong ticket=OrderGetTicket(i);
      if(ticket==0) continue;
      if(OrderGetString(ORDER_SYMBOL)!=InpSymbol) continue;
      if((ulong)OrderGetInteger(ORDER_MAGIC)==InpMagic) return true;
   }
   return false;
}

bool NewBar()
{
   datetime t=iTime(InpSymbol,PERIOD_D1,0);
   if(t==0 || t==g_lastBar) return false;
   g_lastBar=t;
   return true;
}

double Buf(int handle,int buffer,int shift)
{
   double x[];
   ArraySetAsSeries(x,true);
   if(CopyBuffer(handle,buffer,shift,1,x)!=1) return EMPTY_VALUE;
   return x[0];
}

void PrepTrade(){ trade.SetExpertMagicNumber(InpMagic); trade.SetTypeFillingBySymbol(InpSymbol); }

// GOLD24 DEV translation: ATR_BREAKOUT, D1, completed-candle signal -> pending next bar.
// Flat lot, pending-only, fixed absolute USD SL/TP. No trailing or compounding.
// Exact MT5 parity still requires trade-ledger comparison.

const int FAST=3;
const int SLOW=7;
const double ATR_MULT=2.8;
const double SL_USD=20.5;
const double TP_USD=16.5;
const double OFFSET_USD=2.5;
const int EXPIRY_BARS=2;
const bool LONG_ONLY=false;
const bool SHORT_ONLY=true;
const bool USE_STOP=true;

int hFast=INVALID_HANDLE,hSlow=INVALID_HANDLE,hSma=INVALID_HANDLE,hAtr=INVALID_HANDLE;

int OnInit()
{
   PrepTrade();
   hFast=iMA(InpSymbol,PERIOD_D1,FAST,0,MODE_EMA,PRICE_CLOSE);
   hSlow=iMA(InpSymbol,PERIOD_D1,SLOW,0,MODE_EMA,PRICE_CLOSE);
   hSma=iMA(InpSymbol,PERIOD_D1,SLOW,0,MODE_SMA,PRICE_CLOSE);
   hAtr=iATR(InpSymbol,PERIOD_D1,FAST);
   if(hFast==INVALID_HANDLE || hSlow==INVALID_HANDLE || hSma==INVALID_HANDLE || hAtr==INVALID_HANDLE) return INIT_FAILED;
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   IndicatorRelease(hFast); IndicatorRelease(hSlow); IndicatorRelease(hSma); IndicatorRelease(hAtr);
}

void OnTick()
{
   if(!NewBar() || HasExposure()) return;
   double close1=iClose(InpSymbol,PERIOD_D1,1);
   double fast=Buf(hFast,0,1), slow=Buf(hSlow,0,1), sma=Buf(hSma,0,1), atr=Buf(hAtr,0,1);
   if(close1<=0 || fast==EMPTY_VALUE || slow==EMPTY_VALUE || sma==EMPTY_VALUE || atr==EMPTY_VALUE) return;

   bool longSig=(close1 > sma + ATR_MULT*atr) && (fast > slow);
   bool shortSig=(close1 < sma - ATR_MULT*atr) && (fast < slow);
   if(LONG_ONLY) shortSig=false;
   if(SHORT_ONLY) longSig=false;
   datetime exp=TimeCurrent()+EXPIRY_BARS*PeriodSeconds(PERIOD_D1);

   if(longSig)
   {
      double price=USE_STOP ? close1+OFFSET_USD : close1-OFFSET_USD;
      double stop=price-SL_USD, target=price+TP_USD;
      if(USE_STOP) trade.BuyStop(InpLot,price,InpSymbol,stop,target,ORDER_TIME_SPECIFIED,exp,"GOLD24");
      else trade.BuyLimit(InpLot,price,InpSymbol,stop,target,ORDER_TIME_SPECIFIED,exp,"GOLD24");
   }
   else if(shortSig)
   {
      double price=USE_STOP ? close1-OFFSET_USD : close1+OFFSET_USD;
      double stop=price+SL_USD, target=price-TP_USD;
      if(USE_STOP) trade.SellStop(InpLot,price,InpSymbol,stop,target,ORDER_TIME_SPECIFIED,exp,"GOLD24");
      else trade.SellLimit(InpLot,price,InpSymbol,stop,target,ORDER_TIME_SPECIFIED,exp,"GOLD24");
   }
}
