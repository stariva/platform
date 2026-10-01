import { byId } from "./by-id";
import { list } from "./list";
import { save } from "./save";
import { setAvailability } from "./set-availability";
import { setPrice } from "./set-price";
import { uploadImage } from "./upload-image";

export const adminProductsRouter = {
  list,
  byId,
  save,
  setAvailability,
  setPrice,
  uploadImage,
};
