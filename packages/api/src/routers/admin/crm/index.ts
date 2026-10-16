import {
  addExpense,
  campaign,
  campaigns,
  removeCampaign,
  removeExpense,
  saveCampaign,
} from "./campaigns";
import {
  addSale,
  client,
  clients,
  removeClient,
  removeSale,
  saleForRequest,
  saveClient,
} from "./clients";
import {
  addPayment,
  analytics,
  order,
  orders,
  removePayment,
  setOrderStatus,
  updateOrder,
} from "./orders";
import { report } from "./report";

export const adminCrmRouter = {
  report,
  analytics,
  orders,
  order,
  updateOrder,
  setOrderStatus,
  addPayment,
  removePayment,
  clients,
  client,
  saveClient,
  removeClient,
  addSale,
  removeSale,
  saleForRequest,
  campaigns,
  campaign,
  saveCampaign,
  removeCampaign,
  addExpense,
  removeExpense,
};
