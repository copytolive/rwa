
// ---- certification-only observability; no execution behavior changes ----
string ParityOrderTypeName(const ENUM_ORDER_TYPE t)
{
   if(t==ORDER_TYPE_BUY_LIMIT) return "BUY_LIMIT";
   if(t==ORDER_TYPE_SELL_LIMIT) return "SELL_LIMIT";
   if(t==ORDER_TYPE_BUY_STOP) return "BUY_STOP";
   if(t==ORDER_TYPE_SELL_STOP) return "SELL_STOP";
   return "OTHER";
}
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
{
   if(trans.type==TRADE_TRANSACTION_ORDER_ADD && trans.order>0)
   {
      if(OrderSelect(trans.order))
      {
         if(OrderGetString(ORDER_SYMBOL)==_Symbol && (ulong)OrderGetInteger(ORDER_MAGIC)==InpMagic)
         {
            ENUM_ORDER_TYPE ot=(ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
            if(ot==ORDER_TYPE_BUY_LIMIT || ot==ORDER_TYPE_SELL_LIMIT || ot==ORDER_TYPE_BUY_STOP || ot==ORDER_TYPE_SELL_STOP)
            {
               datetime setup=(datetime)OrderGetInteger(ORDER_TIME_SETUP);
               datetime exp=(datetime)OrderGetInteger(ORDER_TIME_EXPIRATION);
               double p=OrderGetDouble(ORDER_PRICE_OPEN);
               PrintFormat("PARITY_PLACE method=%s actual=%s ref=%s actualType=%s refType=%s actualPrice=%.3f refPrice=%.3f actualExpiry=%s refExpiry=%s",
                           g_method,TimeToString(setup,TIME_DATE|TIME_SECONDS),TimeToString(g_activationTime,TIME_DATE|TIME_SECONDS),
                           ParityOrderTypeName(ot),g_pendingType,p,g_pendingPrice,
                           TimeToString(exp,TIME_DATE|TIME_SECONDS),TimeToString(g_expirationTime,TIME_DATE|TIME_SECONDS));
            }
         }
      }
      return;
   }

   if(trans.type!=TRADE_TRANSACTION_DEAL_ADD || trans.deal==0) return;
   if(!HistoryDealSelect(trans.deal)) return;
   if(HistoryDealGetString(trans.deal,DEAL_SYMBOL)!=_Symbol) return;

   long entry=(long)HistoryDealGetInteger(trans.deal,DEAL_ENTRY);
   datetime tm=(datetime)HistoryDealGetInteger(trans.deal,DEAL_TIME);
   double price=HistoryDealGetDouble(trans.deal,DEAL_PRICE);
   long dtype=(long)HistoryDealGetInteger(trans.deal,DEAL_TYPE);

   if(entry==DEAL_ENTRY_IN)
   {
      string actualSide=(dtype==DEAL_TYPE_BUY ? "BUY" : (dtype==DEAL_TYPE_SELL ? "SELL" : "OTHER"));
      string refSide=(StringFind(g_pendingType,"BUY_")==0 ? "BUY" : "SELL");
      PrintFormat("PARITY_ENTRY method=%s refFilled=%d actual=%s ref=%s actualSide=%s refSide=%s actualPrice=%.3f refPrice=%.3f",
                  g_method,g_refFilled,TimeToString(tm,TIME_DATE|TIME_SECONDS),TimeToString(g_refFillTime,TIME_DATE|TIME_SECONDS),
                  actualSide,refSide,price,g_refFillPrice);
      return;
   }

   if(entry==DEAL_ENTRY_OUT || entry==DEAL_ENTRY_OUT_BY)
   {
      long reason=(long)HistoryDealGetInteger(trans.deal,DEAL_REASON);
      string actualOutcome="OTHER";
      if(reason==DEAL_REASON_TP) actualOutcome="TP";
      else if(reason==DEAL_REASON_SL) actualOutcome=(g_lockArmed ? "LOCK" : "SL");
      else if(g_refOutcome=="TIME") actualOutcome="TIME";
      long sec=(long)tm;
      datetime actualBar=(datetime)(sec-(sec%900));
      PrintFormat("PARITY_EXIT method=%s actual=%s actualBar=%s refBar=%s actualOutcome=%s refOutcome=%s actualPrice=%.3f reason=%d",
                  g_method,TimeToString(tm,TIME_DATE|TIME_SECONDS),TimeToString(actualBar,TIME_DATE|TIME_SECONDS),
                  TimeToString(g_refExitTime,TIME_DATE|TIME_SECONDS),actualOutcome,g_refOutcome,price,(int)reason);
   }
}
