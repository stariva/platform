import { list as listGoals } from "./goals";
import { list as listHits } from "./hits";
import { summary } from "./summary";
import { list as listVisits } from "./visits";

export const adminMetrikaRouter = {
  visits: { list: listVisits },
  hits: { list: listHits },
  goals: { list: listGoals },
  summary,
};
