import { registerHealthCheck } from "./health-check.js";
import { registerUploadPhoto } from "./upload-photo.js";
import { registerGenerateAvatar } from "./generate-avatar.js";
import { registerCreate3DPreview } from "./create-3d-preview.js";
import { registerSpawnPet } from "./spawn-pet.js";
import { registerChatWithPet } from "./chat-with-pet.js";
import { registerGenerate3DModel } from "./generate-3d-model.js";

export function registerAllTools(server: any): void {
  registerHealthCheck(server);
  registerUploadPhoto(server);
  registerGenerateAvatar(server);
  registerCreate3DPreview(server);
  registerSpawnPet(server);
  registerChatWithPet(server);
  registerGenerate3DModel(server);
}
