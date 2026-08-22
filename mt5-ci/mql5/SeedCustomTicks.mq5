#property script_show_inputs
#property strict
input string InpSymbol="CT_EURUSD";
input string InpCsvFile="smoke_ticks.csv";

void Status(string s,string m,int n){int h=FileOpen("seed_status.csv",FILE_WRITE|FILE_CSV|FILE_ANSI,','); if(h!=INVALID_HANDLE){FileWrite(h,"status","message","ticks");FileWrite(h,s,m,n);FileClose(h);}}

void OnStart(){
 bool custom=false;
 if(SymbolExist(InpSymbol,custom)){ Status("FAIL","symbol already exists",0); return; }
 if(!CustomSymbolCreate(InpSymbol,"ChatGPT-CI")){Status("FAIL","CustomSymbolCreate "+IntegerToString(GetLastError()),0);return;}
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
 int h=FileOpen(InpCsvFile,FILE_READ|FILE_CSV|FILE_ANSI,','); if(h==INVALID_HANDLE){Status("FAIL","FileOpen "+IntegerToString(GetLastError()),0);return;}
 FileReadString(h);FileReadString(h);FileReadString(h);
 MqlTick ticks[]; int n=0;
 while(!FileIsEnding(h)){
   string a=FileReadString(h); if(a=="") break; string b=FileReadString(h),c=FileReadString(h);
   ArrayResize(ticks,n+1); ticks[n].time_msc=(long)StringToInteger(a); ticks[n].time=(datetime)(ticks[n].time_msc/1000); ticks[n].bid=StringToDouble(b);ticks[n].ask=StringToDouble(c);ticks[n].last=0;ticks[n].volume=1;ticks[n].volume_real=1;ticks[n].flags=TICK_FLAG_BID|TICK_FLAG_ASK;n++;
 }
 FileClose(h); if(n<10){Status("FAIL","too few ticks",n);return;}
 long copied=CustomTicksReplace(InpSymbol,ticks[0].time_msc,ticks[n-1].time_msc,ticks); if(copied!=n){Status("FAIL","replace "+IntegerToString((int)copied)+"/"+IntegerToString(n),n);return;}
 SymbolSelect(InpSymbol,true); MqlTick p[]; int got=CopyTicksRange(InpSymbol,p,COPY_TICKS_ALL,(ulong)ticks[0].time_msc,(ulong)ticks[n-1].time_msc); if(got!=n){Status("FAIL","probe "+IntegerToString(got)+"/"+IntegerToString(n),n);return;}
 Status("PASS","custom ticks loaded",n);
}
