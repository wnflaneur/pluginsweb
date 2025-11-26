import importlib.util
import os
import sys
import uuid
import traceback

class PluginExecutionError(Exception):
    """插件执行异常（统一捕获标识）"""
    pass

def run_plugin(plugin_id, input_data):
    """
    动态加载并执行插件
    :param plugin_id: 插件ID（对应plugins目录下的文件夹名）
    :param input_data: 传入插件的输入数据（字典）
    :return: 插件执行结果（字典）
    """
    # 插件目录路径
    plugin_dir = os.path.join(os.getcwd(), 'plugins', str(plugin_id))
    if not os.path.isdir(plugin_dir):
        raise PluginExecutionError(f"插件目录不存在：{plugin_dir}")

    # 读取插件元信息（验证合法性）
    plugin_json_path = os.path.join(plugin_dir, 'plugin.json')
    if not os.path.exists(plugin_json_path):
        raise PluginExecutionError("插件缺少配置文件：plugin.json")
    
    try:
        import json
        with open(plugin_json_path, 'r', encoding='utf-8') as f:
            plugin_meta = json.load(f)
    except Exception as e:
        raise PluginExecutionError(f"解析plugin.json失败：{str(e)}")

    # 获取插件执行入口（默认main.run）
    entry_point = plugin_meta.get('entry_point', 'main.run')
    if '.' not in entry_point:
        raise PluginExecutionError(f"入口配置格式错误：{entry_point}（需为 模块.函数）")
    module_name, func_name = entry_point.split('.', 1)

    # 动态加载插件模块（避免污染主程序命名空间）
    module_path = os.path.join(plugin_dir, f"{module_name}.py")
    if not os.path.exists(module_path):
        raise PluginExecutionError(f"入口模块不存在：{module_name}.py")

    # 创建模块规格并加载
    spec = importlib.util.spec_from_file_location(
        f"plugin_{plugin_id}_{uuid.uuid4().hex}",  # 唯一模块名
        module_path
    )
    if spec is None or spec.loader is None:
        raise PluginExecutionError(f"无法加载模块：{module_name}.py")
    
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)  # 执行模块代码（导入依赖等）
    except Exception as e:
        tb = traceback.format_exc()
        raise PluginExecutionError(f"模块执行失败：{str(e)}\n{tb}")

    # 验证并调用入口函数
    if not hasattr(module, func_name):
        raise PluginExecutionError(f"模块缺少入口函数：{func_name}")
    entry_func = getattr(module, func_name)

    try:
        # 执行插件函数（传入输入数据）
        result = entry_func(input_data)
        # 确保返回结果为字典（统一格式）
        if not isinstance(result, dict):
            return {"result": result, "status": "success"}
        return result
    except Exception as e:
        tb = traceback.format_exc()
        raise PluginExecutionError(f"插件执行失败：{str(e)}\n{tb}")

