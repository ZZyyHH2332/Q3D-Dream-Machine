import { registerHealthCheck } from "./health-check.js";
import { registerUploadPhoto } from "./upload-photo.js";
import { registerGenerateAvatar } from "./generate-avatar.js";
import { registerSaveAvatar } from "./save-avatar.js";
import { registerCreate3DPreview } from "./create-3d-preview.js";
import { registerSpawnPet } from "./spawn-pet.js";
import { registerChatWithPet } from "./chat-with-pet.js";
import { registerGenerate3DModel } from "./generate-3d-model.js";
// 新增 7 个工具
import { registerGetProjectInfo } from "./get-project-info.js";
import { registerManageGallery } from "./manage-gallery.js";
import { registerCreateBonesPreview } from "./create-bones-preview.js";
import { registerControlMood } from "./control-mood.js";
import { registerPetCare } from "./pet-care.js";
import { registerRegenerateAvatar } from "./regenerate-avatar.js";
import { registerGenerateDreamLattice } from "./generate-dream-lattice.js";

export function registerAllTools(server: any): void {
  // 核心工具（8 个）
  registerHealthCheck(server);
  registerUploadPhoto(server);
  registerGenerateAvatar(server);
  registerSaveAvatar(server);
  registerCreate3DPreview(server);
  registerSpawnPet(server);
  registerChatWithPet(server);
  registerGenerate3DModel(server);

  // 新增工具（7 个）
  registerGetProjectInfo(server);
  registerManageGallery(server);
  registerCreateBonesPreview(server);
  registerControlMood(server);
  registerPetCare(server);
  registerRegenerateAvatar(server);
  registerGenerateDreamLattice(server);
}
