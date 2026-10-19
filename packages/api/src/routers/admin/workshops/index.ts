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

export const adminWorkshopsRouter = {
  list,
  byId,
  orders: ordersList,
  save,
  remove,
  removeOrder,
  presignUpload,
  materialUrl,
  uploadImage,
  sendBrief,
  sendMissingBriefs,
};
