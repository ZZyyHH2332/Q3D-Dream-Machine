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
// 纯 TRAE 模型驱动 3D 建模工具
import { registerGenerateMultiview } from "./generate-multiview.js";
import { registerGenerateBlenderScript } from "./generate-blender-script.js";
import { registerExecuteBlenderScript } from "./execute-blender-script.js";
import { registerRefineBlenderScript } from "./refine-blender-script.js";
import { registerAssessModelQuality } from "./assess-model-quality.js";
import { registerPipelineGenerate } from "./pipeline-generate.js";
export function registerAllTools(server) {
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
    // 纯 TRAE 模型驱动 3D 建模工具（6 个）
    registerGenerateMultiview(server); // 多视图生成（front/side/back）
    registerGenerateBlenderScript(server); // Blender 脚本生成
    registerExecuteBlenderScript(server); // Blender 脚本执行
    registerRefineBlenderScript(server); // 脚本迭代优化
    registerAssessModelQuality(server); // 3D 模型质量评估
    registerPipelineGenerate(server); // Pipeline 编排器
}
//# sourceMappingURL=index.js.map