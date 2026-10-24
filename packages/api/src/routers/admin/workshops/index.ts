import {
  accessCodesList,
  issueAccessCode,
  removeAccessCode,
} from "./access-codes";
import { sendBrief, sendMissingBriefs } from "./brief";
import { byId, videos } from "./by-id";
import { list } from "./list";
import { livemasterPdf } from "./livemaster-pdf";
import { materialUrl } from "./material-url";
import { ordersList } from "./orders";
import { presignUpload } from "./presign-upload";
import { remove } from "./remove";
import { removeOrder } from "./remove-order";
import { removeViews } from "./remove-views";
import { save } from "./save";
import { setLessonVideo } from "./set-lesson-video";
import { uploadImage } from "./upload-image";
import { viewsList } from "./views";

export const adminWorkshopsRouter = {
  list,
  byId,
  videos,
  orders: ordersList,
  views: viewsList,
  save,
  remove,
  removeOrder,
  removeViews,
  presignUpload,
  setLessonVideo,
  materialUrl,
  livemasterPdf,
  uploadImage,
  sendBrief,
  sendMissingBriefs,
  accessCodes: accessCodesList,
  issueAccessCode,
  removeAccessCode,
};
