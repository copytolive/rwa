#property strict
#property version   "1.00"
#include <Trade/Trade.mqh>
CTrade trade;

input string InpSymbol = "XAUUSD";
input double InpLot = 1.0;
input ulong InpMagic = 24082802;

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

// GOLD24 DEV translation: BOLLINGER_REVERSION, D1.
// Completed-candle signal -> pending next bar. Flat lot, fixed USD SL/TP.

const int FAST=5;
const int SLOW=14;
const double BAND_DEV=3.0;
const double RSI_LEVEL=30.0;
const double SL_USD=12.0;
const double TP_USD=22.5;
const double OFFSET_USD=2.75;
const int EXPIRY_BARS=6;
const bool LONG_ONLY=false;
const bool SHORT_ONLY=true;
const bool USE_STOP=true;

int hBands=INVALID_HANDLE,hRsi=INVALID_HANDLE;

int OnInit()
{
   PrepTrade();
   hBands=iBands(InpSymbol,PERIOD_D1,SLOW,0,BAND_DEV,PRICE_CLOSE);
   hRsi=iRSI(InpSymbol,PERIOD_D1,FAST,PRICE_CLOSE);
   if(hBands==INVALID_HANDLE || hRsi==INVALID_HANDLE) return INIT_FAILED;
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason){ IndicatorRelease(hBands); IndicatorRelease(hRsi); }

void OnTick()
{
   if(!NewBar() || HasExposure()) return;
   double close1=iClose(InpSymbol,PERIOD_D1,1);
   double upper=Buf(hBands,1,1), lower=Buf(hBands,2,1), rsi=Buf(hRsi,0,1);
   if(close1<=0 || upper==EMPTY_VALUE || lower==EMPTY_VALUE || rsi==EMPTY_VALUE) return;

   bool longSig=(close1 < lower) && (rsi < RSI_LEVEL);
   bool shortSig=(close1 > upper) && (rsi > 100.0-RSI_LEVEL);
   if(LONG_ONLY) shortSig=false;
   if(SHORT_ONLY) longSig=false;
   datetime exp=TimeCurrent()+EXPIRY_BARS*PeriodSeconds(PERIOD_D1);

   if(longSig)
   {
      double price=USE_STOP ? close1+OFFSET_USD : close1-OFFSET_USD;
      double stop=price-SL_USD,target=price+TP_USD;
      if(USE_STOP) trade.BuyStop(InpLot,price,InpSymbol,stop,target,ORDER_TIME_SPECIFIED,exp,"GOLD24");
      else trade.BuyLimit(InpLot,price,InpSymbol,stop,target,ORDER_TIME_SPECIFIED,exp,"GOLD24");
   }
   else if(shortSig)
   {
      double price=USE_STOP ? close1-OFFSET_USD : close1+OFFSET_USD;
      double stop=price+SL_USD,target=price-TP_USD;
      if(USE_STOP) trade.SellStop(InpLot,price,InpSymbol,stop,target,ORDER_TIME_SPECIFIED,exp,"GOLD24");
      else trade.SellLimit(InpLot,price,InpSymbol,stop,target,ORDER_TIME_SPECIFIED,exp,"GOLD24");
   }
}
