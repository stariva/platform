import { sendBrief, sendMissingBriefs } from "./brief";
import { byId } from "./by-id";
import { list } from "./list";
import { materialUrl } from "./material-url";
import { ordersList } from "./orders";
import { presignUpload } from "./presign-upload";
import { remove } from "./remove";
import { removeOrder } from "./remove-order";
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
  presignUpload,
  materialUrl,
  uploadImage,
  sendBrief,
  sendMissingBriefs,
};
