import {
  accessCodesList,
  issueAccessCode,
  removeAccessCode,
} from "./access-codes";
import { sendBrief, sendMissingBriefs } from "./brief";
import { byId } from "./by-id";
import { list } from "./list";
import { materialUrl } from "./material-url";
import { ordersList } from "./orders";
import { presignUpload } from "./presign-upload";
import { remove } from "./remove";
import { removeOrder } from "./remove-order";
import { removeViews } from "./remove-views";
import { save } from "./save";
import { uploadImage } from "./upload-image";
import { viewsList } from "./views";

export const adminWorkshopsRouter = {
  list,
  byId,
  orders: ordersList,
  views: viewsList,
  save,
  remove,
  removeOrder,
  removeViews,
  presignUpload,
  materialUrl,
  uploadImage,
  sendBrief,
  sendMissingBriefs,
  accessCodes: accessCodesList,
  issueAccessCode,
  removeAccessCode,
};
