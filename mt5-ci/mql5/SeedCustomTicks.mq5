#property script_show_inputs
#property strict

input string InpSymbol="CT_EURUSD";
input string InpCsvFile="smoke_ticks.csv";

void Status(string s,string m,int ticks_n,int bars_n)
{
   int h=FileOpen("seed_status.csv",FILE_WRITE|FILE_CSV|FILE_ANSI,',');
   if(h!=INVALID_HANDLE)
   {
      FileWrite(h,"status","message","ticks","m1_bars");
      FileWrite(h,s,m,ticks_n,bars_n);
      FileClose(h);
   }
}

void Sessions()
{
   datetime f=D'1970.01.01 00:00:00',t=D'1970.01.01 23:59:59';
   for(int d=MONDAY;d<=FRIDAY;d++)
   {
      CustomSymbolSetSessionQuote(InpSymbol,(ENUM_DAY_OF_WEEK)d,0,f,t);
      CustomSymbolSetSessionTrade(InpSymbol,(ENUM_DAY_OF_WEEK)d,0,f,t);
   }
}

void OnStart()
{
   bool custom=false;
   if(SymbolExist(InpSymbol,custom))
   {
      SymbolSelect(InpSymbol,false);
      if(custom)
      {
         CustomTicksDelete(InpSymbol,0,LONG_MAX);
         CustomRatesDelete(InpSymbol,0,LONG_MAX);
         CustomSymbolDelete(InpSymbol);
      }
      else
      {
         Status("FAIL","non-custom symbol already exists",0,0);
         return;
      }
   }

   if(!CustomSymbolCreate(InpSymbol,"ChatGPT-CI"))
   {
      Status("FAIL","CustomSymbolCreate "+IntegerToString(GetLastError()),0,0);
      return;
   }

   CustomSymbolSetInteger(InpSymbol,SYMBOL_DIGITS,5);
   CustomSymbolSetDouble(InpSymbol,SYMBOL_POINT,0.00001);
   CustomSymbolSetDouble(InpSymbol,SYMBOL_TRADE_TICK_SIZE,0.00001);
   CustomSymbolSetDouble(InpSymbol,SYMBOL_TRADE_TICK_VALUE,1.0);
   CustomSymbolSetDouble(InpSymbol,SYMBOL_TRADE_CONTRACT_SIZE,100000.0);
   CustomSymbolSetDouble(InpSymbol,SYMBOL_VOLUME_MIN,0.01);
   CustomSymbolSetDouble(InpSymbol,SYMBOL_VOLUME_MAX,100.0);
   CustomSymbolSetDouble(InpSymbol,SYMBOL_VOLUME_STEP,0.01);
   CustomSymbolSetInteger(InpSymbol,SYMBOL_TRADE_MODE,SYMBOL_TRADE_MODE_FULL);
   CustomSymbolSetInteger(InpSymbol,SYMBOL_TRADE_CALC_MODE,SYMBOL_CALC_MODE_FOREX);
   CustomSymbolSetInteger(InpSymbol,SYMBOL_FILLING_MODE,SYMBOL_FILLING_FOK|SYMBOL_FILLING_IOC);
   CustomSymbolSetString(InpSymbol,SYMBOL_CURRENCY_BASE,"EUR");
   CustomSymbolSetString(InpSymbol,SYMBOL_CURRENCY_PROFIT,"USD");
   CustomSymbolSetString(InpSymbol,SYMBOL_CURRENCY_MARGIN,"USD");
   Sessions();

   int h=FileOpen(InpCsvFile,FILE_READ|FILE_CSV|FILE_ANSI,',');
   if(h==INVALID_HANDLE)
   {
      Status("FAIL","FileOpen "+IntegerToString(GetLastError()),0,0);
      return;
   }
   FileReadString(h);FileReadString(h);FileReadString(h);

   MqlTick ticks[];
   int n=0;
   while(!FileIsEnding(h))
   {
      string a=FileReadString(h);
      if(a=="") break;
      string b=FileReadString(h),c=FileReadString(h);
      ArrayResize(ticks,n+1);
      ticks[n].time_msc=(long)StringToInteger(a);
      ticks[n].time=(datetime)(ticks[n].time_msc/1000);
      ticks[n].bid=StringToDouble(b);
      ticks[n].ask=StringToDouble(c);
      ticks[n].last=0.0;
      ticks[n].volume=1;
      ticks[n].volume_real=1.0;
      ticks[n].flags=TICK_FLAG_BID|TICK_FLAG_ASK;
      n++;
   }
   FileClose(h);
   if(n<10){Status("FAIL","too few ticks",n,0);return;}

   // Build deterministic M1 BID bars from the exact same tick tape.
   MqlRates bars[];
   int bars_n=0;
   long active_minute=-1;
   for(int i=0;i<n;i++)
   {
      long minute=(long)ticks[i].time/60;
      if(minute!=active_minute)
      {
         active_minute=minute;
         ArrayResize(bars,bars_n+1);
         bars[bars_n].time=(datetime)(minute*60);
         bars[bars_n].open=ticks[i].bid;
         bars[bars_n].high=ticks[i].bid;
         bars[bars_n].low=ticks[i].bid;
         bars[bars_n].close=ticks[i].bid;
         bars[bars_n].tick_volume=1;
         bars[bars_n].spread=(int)MathRound((ticks[i].ask-ticks[i].bid)/0.00001);
         bars[bars_n].real_volume=0;
         bars_n++;
      }
      else
      {
         int j=bars_n-1;
         if(ticks[i].bid>bars[j].high) bars[j].high=ticks[i].bid;
         if(ticks[i].bid<bars[j].low) bars[j].low=ticks[i].bid;
         bars[j].close=ticks[i].bid;
         bars[j].tick_volume++;
      }
   }

   if(bars_n<2){Status("FAIL","too few M1 bars",n,bars_n);return;}
   int rates_copied=CustomRatesReplace(InpSymbol,bars[0].time,bars[bars_n-1].time,bars);
   if(rates_copied!=bars_n)
   {
      Status("FAIL","rates replace "+IntegerToString(rates_copied)+"/"+IntegerToString(bars_n),n,bars_n);
      return;
   }

   long ticks_copied=CustomTicksReplace(InpSymbol,ticks[0].time_msc,ticks[n-1].time_msc,ticks);
   if(ticks_copied!=n)
   {
      Status("FAIL","ticks replace "+IntegerToString((int)ticks_copied)+"/"+IntegerToString(n),n,bars_n);
      return;
   }

   if(!SymbolSelect(InpSymbol,true))
   {
      Status("FAIL","SymbolSelect "+IntegerToString(GetLastError()),n,bars_n);
      return;
   }

   MqlTick probe_ticks[];
   int got_ticks=CopyTicksRange(InpSymbol,probe_ticks,COPY_TICKS_ALL,(ulong)ticks[0].time_msc,(ulong)ticks[n-1].time_msc);
   MqlRates probe_bars[];
   int got_bars=CopyRates(InpSymbol,PERIOD_M1,bars[0].time,bars[bars_n-1].time,probe_bars);
   if(got_ticks!=n)
   {
      Status("FAIL","tick probe "+IntegerToString(got_ticks)+"/"+IntegerToString(n),n,bars_n);
      return;
   }
   if(got_bars!=bars_n)
   {
      Status("FAIL","M1 probe "+IntegerToString(got_bars)+"/"+IntegerToString(bars_n),n,bars_n);
      return;
   }

   Status("PASS","custom ticks + deterministic M1 loaded",n,bars_n);
}
