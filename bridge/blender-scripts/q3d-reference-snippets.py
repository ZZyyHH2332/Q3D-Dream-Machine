"""
Q3D Blender Reference Snippets
===============================
TRAE 模型可以参考这些代码片段，但不必严格遵循。
这些是常用的工具函数，确保基础功能正确。

使用方式：
1. 根据多视图图片分析角色特征
2. 自由创作完整的 Blender Python 脚本
3. 可以参考下面的函数实现
4. 确保脚本包含：场景清理、角色创建、材质、灯光、导出
"""

import bpy
import math
from mathutils import Vector, Euler

# ============ 场景管理 ============

def clear_scene():
    """清理场景中的所有对象"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

def set_render_engine(engine='EEVEE'):
    """设置渲染引擎"""
    bpy.context.scene.render.engine = engine

# ============ 材质创建 ============

def create_pbr_material(name, color_rgba, roughness=0.3, metallic=0.0, subsurface=0.0):
    """
    创建 PBR 材质
    
    Args:
        name: 材质名称
        color_rgba: RGBA 颜色元组 (0-1)
        roughness: 粗糙度 (0-1)
        metallic: 金属度 (0-1)
        subsurface: 次表面散射权重 (0-1)
    
    Returns:
        bpy.types.Material
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color_rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    
    if subsurface > 0:
        bsdf.inputs["Subsurface Weight"].default_value = subsurface
        bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.3, 0.1)
    
    return mat

def create_toon_material(name, color_rgba, shadow_color=(0.3, 0.3, 0.3, 1.0)):
    """
    创建 Toon 材质（卡通渲染）
    
    Args:
        name: 材质名称
        color_rgba: 基础颜色
        shadow_color: 阴影颜色
    
    Returns:
        bpy.types.Material
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    
    # 清除默认节点
    nodes.clear()
    
    # 创建输出节点
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (400, 0)
    
    # 创建 Toon BSDF 节点
    toon = nodes.new('ShaderNodeBsdfToon')
    toon.location = (0, 0)
    toon.inputs["Color"].default_value = color_rgba
    toon.inputs["Size"].default_value = 0.5
    toon.inputs["Smoothness"].default_value = 0.1
    
    # 连接
    links.new(toon.outputs["BSDF"], output.inputs["Surface"])
    
    return mat

def apply_material_to_object(obj, material):
    """将材质应用到对象"""
    if obj.type == 'MESH':
        obj.data.materials.append(material)

# ============ 三灯布光 ============

def setup_three_point_lighting(key_energy=80, fill_energy=40, rim_energy=60):
    """
    三灯布光：Key + Fill + Rim
    
    Args:
        key_energy: 主光能量
        fill_energy: 补光能量
        rim_energy: 轮廓光能量
    """
    # Key Light（主光）- 暖白色，从右上方照射
    bpy.ops.object.light_add(type='AREA', location=(3, 3, 4))
    key = bpy.context.active_object
    key.name = "Key_Light"
    key.data.energy = key_energy
    key.data.color = (1.0, 0.95, 0.9)  # 暖白
    key.data.size = 2.0
    key.rotation_euler = Euler((math.radians(45), 0, math.radians(45)))
    
    # Fill Light（补光）- 冷白色，从左上方照射
    bpy.ops.object.light_add(type='AREA', location=(-3, 1, 3))
    fill = bpy.context.active_object
    fill.name = "Fill_Light"
    fill.data.energy = fill_energy
    fill.data.color = (0.9, 0.95, 1.0)  # 冷白
    fill.data.size = 2.5
    fill.rotation_euler = Euler((math.radians(50), 0, math.radians(-45)))
    
    # Rim Light（轮廓光）- 淡紫色，从后方照射
    bpy.ops.object.light_add(type='AREA', location=(0, -3, 3))
    rim = bpy.context.active_object
    rim.name = "Rim_Light"
    rim.data.energy = rim_energy
    rim.data.color = (1.0, 0.9, 1.0)  # 淡紫
    rim.data.size = 1.5
    rim.rotation_euler = Euler((math.radians(45), 0, math.radians(180)))

def setup_hdri_environment(hdri_path=None):
    """
    设置 HDRI 环境光照
    
    Args:
        hdri_path: HDRI 文件路径（可选）
    """
    world = bpy.context.scene.world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    
    # 清除默认节点
    nodes.clear()
    
    # 创建输出节点
    output = nodes.new('ShaderNodeOutputWorld')
    output.location = (400, 0)
    
    # 创建背景节点
    background = nodes.new('ShaderNodeBackground')
    background.location = (0, 0)
    background.inputs["Color"].default_value = (0.5, 0.5, 0.5, 1.0)
    background.inputs["Strength"].default_value = 1.0
    
    # 连接
    links.new(background.outputs["Background"], output.inputs["Surface"])

# ============ 几何体创建 ============

def create_smooth_sphere(name, location, radius, segments=32, rings=16):
    """创建平滑球体"""
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        radius=radius,
        location=location
    )
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    return obj

def create_smooth_cube(name, location, size):
    """创建平滑立方体"""
    bpy.ops.mesh.primitive_cube_add(size=size, location=location)
    obj = bpy.context.active_object
    obj.name = name
    # 添加细分修改器使边缘更平滑
    mod = obj.modifiers.new(name="Subdivision", type='SUBSURF')
    mod.levels = 2
    mod.render_levels = 2
    bpy.ops.object.shade_smooth()
    return obj

def create_capsule(name, location, radius, height, segments=16, rings=8):
    """创建胶囊体"""
    # 创建球体并拉伸
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        radius=radius,
        location=location
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale.z = height / (radius * 2)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    return obj

# ============ 头发创建 ============

def create_hair_strand_curve(name, points, radius=0.02):
    """
    使用贝塞尔曲线创建头发
    
    Args:
        name: 头发名称
        points: 控制点列表 [(x,y,z), ...]
        radius: 头发半径
    
    Returns:
        bpy.types.Object
    """
    # 创建曲线
    curve_data = bpy.data.curves.new(name=name, type='CURVE')
    curve_data.dimensions = '3D'
    curve_data.resolution_u = 12
    
    # 创建贝塞尔样条
    spline = curve_data.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    
    for i, point in enumerate(points):
        spline.bezier_points[i].co = point
        spline.bezier_points[i].handle_left_type = 'AUTO'
        spline.bezier_points[i].handle_right_type = 'AUTO'
    
    # 创建对象
    curve_obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(curve_obj)
    
    # 设置曲线倒角以产生厚度
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 4
    
    return curve_obj

def create_hair_mesh_from_curve(curve_obj, hair_material):
    """将曲线头发转换为 mesh"""
    bpy.context.view_layer.objects.active = curve_obj
    curve_obj.select_set(True)
    
    # 转换为 mesh
    bpy.ops.object.convert(target='MESH')
    
    # 应用材质
    if hair_material:
        curve_obj.data.materials.append(hair_material)
    
    return curve_obj

# ============ 面部特征 ============

def create_eye(name, location, radius=0.1, eye_color=(0.2, 0.5, 0.9, 1.0)):
    """
    创建眼睛
    
    Args:
        name: 眼睛名称
        location: 位置
        radius: 半径
        eye_color: 眼睛颜色
    """
    # 眼白
    eye_white = create_smooth_sphere(
        f"{name}_White",
        location,
        radius
    )
    
    # 虹膜
    iris_location = (location[0], location[1] - radius * 0.3, location[2])
    eye_iris = create_smooth_sphere(
        f"{name}_Iris",
        iris_location,
        radius * 0.6
    )
    
    # 瞳孔
    pupil_location = (location[0], location[1] - radius * 0.5, location[2])
    eye_pupil = create_smooth_sphere(
        f"{name}_Pupil",
        pupil_location,
        radius * 0.3
    )
    
    # 创建材质
    white_mat = create_pbr_material(f"{name}_White_Mat", (1, 1, 1, 1), roughness=0.1)
    iris_mat = create_pbr_material(f"{name}_Iris_Mat", eye_color, roughness=0.2)
    pupil_mat = create_pbr_material(f"{name}_Pupil_Mat", (0, 0, 0, 1), roughness=0.1)
    
    apply_material_to_object(eye_white, white_mat)
    apply_material_to_object(eye_iris, iris_mat)
    apply_material_to_object(eye_pupil, pupil_mat)
    
    return eye_white, eye_iris, eye_pupil

# ============ GLB 导出 ============

def export_glb(output_path, apply_modifiers=True):
    """
    导出 GLB 文件
    
    Args:
        output_path: 输出路径
        apply_modifiers: 是否应用修改器
    """
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_yup=True,
        export_materials='EXPORT',
        export_apply=apply_modifiers
    )
    print(f"GLB exported to: {output_path}")

# ============ 平滑处理 ============

def smooth_all_meshes():
    """对所有 mesh 应用平滑着色"""
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.shade_smooth()

def add_subdivision_modifier(obj, levels=1, render_levels=2):
    """为对象添加细分修改器"""
    mod = obj.modifiers.new(name="Subdivision", type='SUBSURF')
    mod.levels = levels
    mod.render_levels = render_levels
    return mod

# ============ 高级建模技术 ============

def create_organic_shape(name, base_mesh, subdivision_levels=2):
    """
    添加细分修改器使形状更平滑（用于有机形体）
    
    Args:
        name: 修改器名称
        base_mesh: 基础 mesh 对象
        subdivision_levels: 细分级别
    
    Returns:
        bpy.types.SubsurfModifier
    """
    mod = base_mesh.modifiers.new(name=name, type='SUBSURF')
    mod.levels = subdivision_levels
    mod.render_levels = subdivision_levels + 1
    mod.subdivision_type = 'CATMULL_CLARK'
    return mod

def create_metaball_body(name, location, elements):
    """
    使用融球创建有机身体（自然融合效果）
    
    Args:
        name: 融球名称
        location: 中心位置
        elements: 融球元素列表 [{'location': (x,y,z), 'radius': r}, ...]
    
    Returns:
        bpy.types.Object
    """
    meta = bpy.data.metaballs.new(name)
    obj = bpy.data.objects.new(name, meta)
    bpy.context.collection.objects.link(obj)
    
    for elem in elements:
        e = meta.elements.new()
        e.co = elem['location']
        e.radius = elem['radius']
    
    return obj

def create_metaball_element(meta, location, radius):
    """
    向融球添加元素
    
    Args:
        meta: 融球数据对象
        location: 元素位置 (x,y,z)
        radius: 元素半径
    """
    e = meta.elements.new()
    e.co = location
    e.radius = radius
    return e

# ============ UV 展开与纹理 ============

def smart_uv_unwrap(obj, method='ANGLE_BASED', angle_limit=66):
    """
    智能 UV 展开
    
    Args:
        obj: 目标 mesh 对象
        method: 展开方法 ('ANGLE_BASED' / 'CONFORMAL')
        angle_limit: 角度限制（度）
    """
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    
    if method == 'ANGLE_BASED':
        bpy.ops.uv.smart_project(angle_limit=math.radians(angle_limit))
    else:
        bpy.ops.uv.unwrap(method=method, margin=0.02)
    
    bpy.ops.object.mode_set(mode='OBJECT')

def cube_uv_project(obj):
    """为立方体形状的物体做立方体投影"""
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cube_project()
    bpy.ops.object.mode_set(mode='OBJECT')

def cylinder_uv_project(obj):
    """为圆柱体形状的物体做柱面投影"""
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cylinder_project()
    bpy.ops.object.mode_set(mode='OBJECT')

def sphere_uv_project(obj):
    """为球体形状的物体做球面投影"""
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.sphere_project()
    bpy.ops.object.mode_set(mode='OBJECT')

# ============ 纹理材质（Image Texture） ============

def create_textured_material(name, texture_path, roughness=0.3, metallic=0.0, 
                              color_tint=None, use_alpha=False):
    """
    创建带图像纹理的 PBR 材质（核心新增函数）
    
    Args:
        name: 材质名称
        texture_path: 纹理贴图文件路径（绝对路径）
        roughness: 粗糙度
        metallic: 金属度
        color_tint: 可选的颜色叠加 RGBA
        use_alpha: 是否使用纹理的 Alpha 通道
    
    Returns:
        bpy.types.Material
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    # 输出节点
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (800, 0)
    
    # Principled BSDF
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (500, 0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    
    # 图像纹理
    tex = nodes.new('ShaderNodeTexImage')
    tex.location = (100, 0)
    tex.interpolation = 'Smart'
    tex.projection = 'FLAT'
    try:
        tex.image = bpy.data.images.load(texture_path)
    except:
        print(f"  [WARNING] Texture not found: {texture_path}, using color fallback")
        tex.image = bpy.data.images.new(name + "_blank", 512, 512, alpha=True)
    
    # 纹理坐标
    coord = nodes.new('ShaderNodeTexCoord')
    coord.location = (-200, 0)
    
    # 连接：UV → 纹理 → BSDF
    links.new(coord.outputs['UV'], tex.inputs['Vector'])
    
    if color_tint:
        # 颜色叠加：纹理色 × 色调
        mix = nodes.new('ShaderNodeMix')
        mix.location = (300, 0)
        mix.data_type = 'RGBA'
        mix.inputs['Factor'].default_value = 0.5
        mix.inputs['A'].default_value = color_tint
        links.new(tex.outputs['Color'], mix.inputs['B'])
        links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    else:
        links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    
    if use_alpha:
        links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
        mat.blend_method = 'CLIP'
    
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    return mat

def create_blended_material(name, base_color_rgba, texture_path, blend_factor=0.5,
                             roughness=0.3, metallic=0.0):
    """
    创建纯色 + 纹理混合材质（如星点图案叠加在纯色裙摆上）
    
    Args:
        name: 材质名称
        base_color_rgba: 基础纯色 RGBA
        texture_path: 纹理贴图路径
        blend_factor: 混合比例 (0=纯色, 1=纹理)
        roughness: 粗糙度
        metallic: 金属度
    
    Returns:
        bpy.types.Material
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (800, 0)
    
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (500, 0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    
    # 纯色输入
    rgb = nodes.new('ShaderNodeRGB')
    rgb.location = (-100, 200)
    rgb.outputs['Color'].default_value = base_color_rgba
    
    # 纹理输入
    tex = nodes.new('ShaderNodeTexImage')
    tex.location = (-100, -100)
    try:
        tex.image = bpy.data.images.load(texture_path)
    except:
        tex.image = bpy.data.images.new(name + "_blank", 512, 512, alpha=True)
    
    coord = nodes.new('ShaderNodeTexCoord')
    coord.location = (-400, -100)
    links.new(coord.outputs['UV'], tex.inputs['Vector'])
    
    # 混合
    mix = nodes.new('ShaderNodeMix')
    mix.location = (300, 0)
    mix.data_type = 'RGBA'
    mix.inputs['Factor'].default_value = blend_factor
    mix.inputs['A'].default_value = base_color_rgba
    links.new(tex.outputs['Color'], mix.inputs['B'])
    links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    return mat

def load_texture_and_apply(obj, texture_path, material_name=None, roughness=0.3):
    """
    一键加载纹理并应用到对象
    
    Args:
        obj: 目标 mesh 对象
        texture_path: 纹理贴图路径
        material_name: 材质名称（可选，默认使用纹理文件名）
        roughness: 粗糙度
    """
    import os
    if material_name is None:
        material_name = os.path.splitext(os.path.basename(texture_path))[0] + "_Mat"
    
    mat = create_textured_material(material_name, texture_path, roughness=roughness)
    obj.data.materials.append(mat)
    return mat

# ============ 高级材质 ============

def create_skin_material(name, base_color, subsurface_color=(1.0, 0.8, 0.7)):
    """
    创建手办级皮肤材质（次表面散射）
    
    Args:
        name: 材质名称
        base_color: 基础颜色 RGBA
        subsurface_color: 次表面散射颜色 RGB
    
    Returns:
        bpy.types.Material
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Subsurface Weight"].default_value = 0.15
    bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.3, 0.1)
    bsdf.inputs["Subsurface IOR"].default_value = 1.4
    bsdf.inputs["Subsurface Anisotropy"].default_value = 0.5
    bsdf.inputs["Roughness"].default_value = 0.35
    bsdf.inputs["Specular IOR Level"].default_value = 0.5
    return mat

def create_hair_material(name, base_color):
    """
    创建手办级头发材质（高光泽 + 涂层）
    
    Args:
        name: 材质名称
        base_color: 头发颜色 RGBA
    
    Returns:
        bpy.types.Material
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Roughness"].default_value = 0.2
    bsdf.inputs["Specular IOR Level"].default_value = 0.8
    bsdf.inputs["Coat Weight"].default_value = 0.3
    bsdf.inputs["Coat Roughness"].default_value = 0.1
    return mat

def create_fabric_material(name, base_color, roughness=0.7):
    """
    创建布料材质
    
    Args:
        name: 材质名称
        base_color: 布料颜色 RGBA
        roughness: 粗糙度（布料通常较高）
    
    Returns:
        bpy.types.Material
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Sheen Weight"].default_value = 0.3
    bsdf.inputs["Sheen Tint"].default_value = 0.5
    return mat

def create_metal_material(name, base_color, metallic=0.9, roughness=0.1):
    """
    创建金属材质（用于配饰、装饰）
    
    Args:
        name: 材质名称
        base_color: 金属颜色 RGBA
        metallic: 金属度
        roughness: 粗糙度
    
    Returns:
        bpy.types.Material
    """
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Specular IOR Level"].default_value = 1.0
    return mat

# ============ 示例：完整脚本结构 ============

"""
# 这是一个完整脚本的示例结构，仅供参考

import bpy
import math
from mathutils import Vector, Euler

# 1. 清理场景
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# 2. 创建角色各部分
# ... 你的创意代码 ...

# 3. 创建并应用材质
# ... 材质代码 ...

# 4. 设置灯光
# 可以调用 setup_three_point_lighting() 或自定义

# 5. 平滑处理
smooth_all_meshes()

# 6. 导出 GLB
export_glb("output.glb")
"""

print("Q3D Reference Snippets loaded successfully!")
print("Available functions:")
print("  - clear_scene()")
print("  - create_pbr_material(name, color_rgba, roughness, metallic, subsurface)")
print("  - create_toon_material(name, color_rgba, shadow_color)")
print("  - create_skin_material(name, base_color, subsurface_color)")
print("  - create_hair_material(name, base_color)")
print("  - create_fabric_material(name, base_color, roughness)")
print("  - create_metal_material(name, base_color, metallic, roughness)")
print("  - smart_uv_unwrap(obj, method, angle_limit)")
print("  - cube_uv_project(obj) / cylinder_uv_project(obj) / sphere_uv_project(obj)")
print("  - create_textured_material(name, texture_path, roughness, metallic, color_tint, use_alpha)")
print("  - create_blended_material(name, base_color_rgba, texture_path, blend_factor, roughness, metallic)")
print("  - load_texture_and_apply(obj, texture_path, material_name, roughness)")
print("  - setup_three_point_lighting(key_energy, fill_energy, rim_energy)")
print("  - create_smooth_sphere(name, location, radius)")
print("  - create_smooth_cube(name, location, size)")
print("  - create_capsule(name, location, radius, height)")
print("  - create_organic_shape(name, base_mesh, subdivision_levels)")
print("  - create_metaball_body(name, location, elements)")
print("  - create_hair_strand_curve(name, points, radius)")
print("  - create_eye(name, location, radius, eye_color)")
print("  - export_glb(output_path)")
print("  - smooth_all_meshes()")
print("")
print("高级建模技术：")
print("  - 细分曲面 (Subdivision Surface) - 有机形体平滑")
print("  - 融球 (Metaballs) - 自然融合效果")
print("  - 贝塞尔曲线 - 头发、装饰线条")
print("  - 高级材质 - 皮肤 SSS、头发涂层、布料、金属")
