#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Q3D Blender Automation Script
一键导入 Q3D 生成的 GLB 模型并设置卡通渲染工作流

使用方法:
1. 打开 Blender
2. 切换到 Scripting 工作区
3. 新建文本，粘贴此脚本
4. 修改下方 GLB_PATH 为你的模型路径
5. 点击运行脚本（▶）
"""

import bpy
import os

# ==================== 用户配置 ====================
GLB_PATH = ""           # 例如: "C:/Users/YourName/Downloads/q3d-avatar.glb"
RENDER_OUTPUT = ""      # 例如: "C:/Users/YourName/Desktop/q3d-render.png"
USE_ORTHO = False       # True=正交相机(适合产品展示), False=透视相机(适合角色)
# ==================================================


def ensure_collection(name):
    """获取或创建集合"""
    if name in bpy.data.collections:
        return bpy.data.collections[name]
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def clear_scene_keep_camera():
    """清空场景但保留相机（如果存在）"""
    # 删除所有 mesh, light, material（保留相机和空对象）
    for obj in list(bpy.context.scene.objects):
        if obj.type in {'MESH', 'LIGHT', 'CURVE', 'FONT'}:
            bpy.data.objects.remove(obj, do_unlink=True)


def import_glb(filepath):
    """导入 GLB 文件"""
    if not filepath or not os.path.exists(filepath):
        print(f"[Q3D] 错误: 找不到 GLB 文件: {filepath}")
        return None
    bpy.ops.import_scene.gltf(filepath=filepath)
    imported = [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']
    if imported:
        print(f"[Q3D] 成功导入 {len(imported)} 个网格对象")
        return imported
    return None


def setup_toon_material(obj):
    """为对象创建卡通材质（Toon Shader）"""
    mat_name = f"Q3D_Toon_{obj.name}"
    if mat_name in bpy.data.materials:
        mat = bpy.data.materials[mat_name]
    else:
        mat = bpy.data.materials.new(name=mat_name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        links = mat.node_tree.links
        nodes.clear()

        # 输出节点
        output = nodes.new(type='ShaderNodeOutputMaterial')
        output.location = (400, 0)

        # Diffuse BSDF
        diffuse = nodes.new(type='ShaderNodeBsdfDiffuse')
        diffuse.location = (0, 100)
        diffuse.inputs['Color'].default_value = (0.35, 0.65, 1.0, 1.0)  # Q3D 主题蓝
        diffuse.inputs['Roughness'].default_value = 0.8

        # Shader To RGB（将光照转为颜色，实现硬边卡通效果）
        to_rgb = nodes.new(type='ShaderNodeShaderToRGB')
        to_rgb.location = (200, 100)

        # ColorRamp（控制光影硬边）
        ramp = nodes.new(type='ShaderNodeValToRGB')
        ramp.location = (200, -100)
        ramp.color_ramp.elements[0].position = 0.35
        ramp.color_ramp.elements[0].color = (0.15, 0.25, 0.45, 1.0)   # 阴影色
        ramp.color_ramp.elements[1].position = 0.65
        ramp.color_ramp.elements[1].color = (0.55, 0.85, 1.0, 1.0)   # 高光色

        # 连接
        links.new(diffuse.outputs['BSDF'], to_rgb.inputs['Shader'])
        links.new(to_rgb.outputs['Color'], ramp.inputs['Fac'])
        links.new(ramp.outputs['Color'], output.inputs['Surface'])

    # 赋值给对象
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    return mat


def add_outline(obj):
    """添加轮廓线效果（Solidify + Backface）"""
    if 'Q3D_Outline' in obj.modifiers:
        return
    mod = obj.modifiers.new(name='Q3D_Outline', type='SOLIDIFY')
    mod.thickness = -0.02
    mod.offset = 1.0
    mod.use_rim = True
    mod.use_flip_normals = True
    mod.material_offset = 1

    # 创建轮廓材质
    outline_mat = bpy.data.materials.new(name=f"Q3D_Outline_{obj.name}")
    outline_mat.use_nodes = True
    outline_mat.use_backface_culling = True
    nodes = outline_mat.node_tree.nodes
    links = outline_mat.node_tree.links
    nodes.clear()
    output = nodes.new(type='ShaderNodeOutputMaterial')
    emission = nodes.new(type='ShaderNodeEmission')
    emission.inputs['Color'].default_value = (0.05, 0.05, 0.15, 1.0)
    emission.inputs['Strength'].default_value = 1.0
    links.new(emission.outputs['Emission'], output.inputs['Surface'])

    if len(obj.data.materials) < 2:
        obj.data.materials.append(outline_mat)
    else:
        obj.data.materials[1] = outline_mat


def setup_three_point_lighting():
    """设置三灯布光（Key / Rim / Fill）"""
    lights = []
    light_data = [
        ('Q3D_Key', (2.5, -3.5, 4.0), 80, (0.75, 0.88, 1.0)),      # 主光
        ('Q3D_Rim', (-3.0, 2.0, 3.5), 60, (0.55, 0.75, 1.0)),       # 轮廓光
        ('Q3D_Fill', (-2.0, -2.5, 2.0), 30, (0.9, 0.95, 1.0)),      # 补光
    ]

    for name, loc, power, color in light_data:
        if name in bpy.data.objects:
            light_obj = bpy.data.objects[name]
            light_obj.location = loc
        else:
            light = bpy.data.lights.new(name=name, type='AREA')
            light.energy = power
            light.color = color
            light.size = 2.0
            light_obj = bpy.data.objects.new(name=name, object_data=light)
            bpy.context.scene.collection.objects.link(light_obj)
            light_obj.location = loc
        lights.append(light_obj)

    # 让主光和轮廓光指向原点
    for obj in lights[:2]:
        constraint = obj.constraints.new(type='TRACK_TO')
        constraint.target = None
        # 创建空对象作为目标
        empty_name = f"{obj.name}_Target"
        if empty_name not in bpy.data.objects:
            target = bpy.data.objects.new(empty_name, None)
            bpy.context.scene.collection.objects.link(target)
        else:
            target = bpy.data.objects[empty_name]
        constraint.target = target

    print("[Q3D] 三灯布光已设置")
    return lights


def setup_camera():
    """设置标准 Q 版角色相机"""
    cam_name = 'Q3D_Camera'
    if cam_name in bpy.data.objects:
        cam_obj = bpy.data.objects[cam_name]
    else:
        cam = bpy.data.cameras.new(name=cam_name)
        cam_obj = bpy.data.objects.new(cam_name, cam)
        bpy.context.scene.collection.objects.link(cam_obj)

    cam_obj.location = (3.5, -4.5, 3.2)
    cam_obj.rotation_euler = (1.1, 0.0, 0.7)

    cam = cam_obj.data
    cam.lens = 50
    if USE_ORTHO:
        cam.type = 'ORTHO'
        cam.ortho_scale = 3.0
    else:
        cam.type = 'PERSP'

    # 设置为活动相机
    bpy.context.scene.camera = cam_obj
    print("[Q3D] 相机已设置")
    return cam_obj


def setup_eevee():
    """配置 EEVEE 渲染引擎（适合卡通风格）"""
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'

    # 基础渲染设置
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1920
    scene.render.resolution_percentage = 100

    # 色彩管理
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'High Contrast'

    # EEVEE 特定设置
    if hasattr(scene, 'eevee'):
        eevee = scene.eevee
        eevee.taa_render_samples = 64
        eevee.use_bloom = True
        eevee.bloom_intensity = 0.03
        eevee.use_ssr = True
        eevee.ssr_quality = 0.5
        eevee.use_gtao = True
        eevee.gtao_distance = 0.5

    print("[Q3D] EEVEE 渲染设置完成")


def setup_world():
    """设置环境光和世界背景"""
    world = bpy.context.scene.world
    if not world:
        world = bpy.data.worlds.new("Q3D_World")
        bpy.context.scene.world = world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    bg = nodes.get('Background')
    if bg:
        bg.inputs['Color'].default_value = (0.02, 0.03, 0.06, 1.0)
        bg.inputs['Strength'].default_value = 0.3


def main():
    print("\n" + "="*50)
    print(" Q3D Blender Automation Script ")
    print("="*50)

    # 1. 清空场景
    clear_scene_keep_camera()

    # 2. 导入 GLB
    imported = None
    if GLB_PATH:
        imported = import_glb(GLB_PATH)
    else:
        print("[Q3D] 提示: 未设置 GLB_PATH，跳过导入。请修改脚本顶部的 GLB_PATH 变量。")

    # 3. 设置材质
    if imported:
        for obj in imported:
            setup_toon_material(obj)
            add_outline(obj)
            # 居中对象
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
            obj.location = (0, 0, 0)

    # 4. 灯光
    setup_three_point_lighting()

    # 5. 相机
    setup_camera()

    # 6. 渲染设置
    setup_eevee()

    # 7. 世界环境
    setup_world()

    # 8. 渲染（如果设置了输出路径）
    if RENDER_OUTPUT:
        bpy.context.scene.render.filepath = RENDER_OUTPUT
        bpy.ops.render.render(write_still=True)
        print(f"[Q3D] 渲染完成: {RENDER_OUTPUT}")

    print("\n[Q3D] 所有设置已完成！")
    print("="*50 + "\n")


if __name__ == "__main__":
    main()
