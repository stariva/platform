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
  saveClient,
} from "./clients";
import { report } from "./report";

export const adminCrmRouter = {
  report,
  clients,
  client,
  saveClient,
  removeClient,
  addSale,
  removeSale,
  campaigns,
  campaign,
  saveCampaign,
  removeCampaign,
  addExpense,
  removeExpense,
};
