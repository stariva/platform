import { byId } from "./by-id";
import { list } from "./list";
import { presignUpload } from "./presign-upload";
import { remove } from "./remove";
import { save } from "./save";
import { uploadImage } from "./upload-image";

export const adminWorkshopsRouter = {
  list,
  byId,
  save,
  remove,
  presignUpload,
  uploadImage,
};
