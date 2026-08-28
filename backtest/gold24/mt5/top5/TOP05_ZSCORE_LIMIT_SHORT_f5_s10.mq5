#property strict
#property version   "1.00"
#include <Trade/Trade.mqh>
CTrade trade;

input string InpSymbol = "XAUUSD";
input double InpLot = 1.0;
input ulong InpMagic = 24082805;

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

// GOLD24 DEV translation: ZSCORE_REVERSION, D1.
// Z=(Close-SMA(SLOW))/StdDev(SLOW), RSI(FAST). Pending-only, fixed USD SL/TP.

const int FAST=5;
const int SLOW=10;
const double Z_LEVEL=2.7;
const double RSI_LEVEL=25.0;
const double SL_USD=6.0;
const double TP_USD=14.5;
const double OFFSET_USD=1.25;
const int EXPIRY_BARS=2;
const bool LONG_ONLY=false;
const bool SHORT_ONLY=true;
const bool USE_STOP=false;

int hSma=INVALID_HANDLE,hStd=INVALID_HANDLE,hRsi=INVALID_HANDLE;

int OnInit()
{
   PrepTrade();
   hSma=iMA(InpSymbol,PERIOD_D1,SLOW,0,MODE_SMA,PRICE_CLOSE);
   hStd=iStdDev(InpSymbol,PERIOD_D1,SLOW,0,MODE_SMA,PRICE_CLOSE);
   hRsi=iRSI(InpSymbol,PERIOD_D1,FAST,PRICE_CLOSE);
   if(hSma==INVALID_HANDLE || hStd==INVALID_HANDLE || hRsi==INVALID_HANDLE) return INIT_FAILED;
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason){ IndicatorRelease(hSma); IndicatorRelease(hStd); IndicatorRelease(hRsi); }

void OnTick()
{
   if(!NewBar() || HasExposure()) return;
   double close1=iClose(InpSymbol,PERIOD_D1,1);
   double sma=Buf(hSma,0,1), sd=Buf(hStd,0,1), rsi=Buf(hRsi,0,1);
   if(close1<=0 || sma==EMPTY_VALUE || sd==EMPTY_VALUE || rsi==EMPTY_VALUE || sd<=0) return;

   double z=(close1-sma)/sd;
   bool longSig=(z < -Z_LEVEL) && (rsi < RSI_LEVEL);
   bool shortSig=(z > Z_LEVEL) && (rsi > 100.0-RSI_LEVEL);
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
