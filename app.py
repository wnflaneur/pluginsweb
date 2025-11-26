from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from werkzeug.utils import secure_filename
import os
import shutil
import uuid
import json
from models import db, Plugin
from plugin_runner import run_plugin, PluginExecutionError

# 初始化Flask应用
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-123'  # 用于flash消息（可修改）
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///plugins.db'  # 数据库路径
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False  # 关闭SQLAlchemy跟踪
app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'plugins')  # 插件上传目录
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 限制上传文件大小（10MB）
PLUGINS_DIR = os.path.join(os.path.dirname(__file__), 'plugins')
# 确保必要目录存在
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('instance', exist_ok=True)

# 初始化数据库
db.init_app(app)

# 允许上传的文件类型（仅ZIP压缩包）
ALLOWED_EXTENSIONS = {'zip'}

def allowed_file(filename):
    """验证文件类型是否合法"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# 创建数据库表（首次运行自动创建）
with app.app_context():
    db.create_all()

# ------------------- 路由配置 -------------------
@app.route('/')
def index():
    """主页面：展示插件列表"""
    plugins = Plugin.query.order_by(Plugin.created_at.desc()).all()
    return render_template('index.html', plugins=plugins)

@app.route('/upload', methods=['POST'])
def upload_plugin():
    """上传插件（ZIP压缩包）"""
    # 验证请求是否包含文件
    if 'plugin_file' not in request.files:
        flash('请选择插件文件（ZIP格式）')
        return redirect(url_for('index'))
    
    file = request.files['plugin_file']
    if file.filename == '' or not allowed_file(file.filename):
        flash('请上传有效的ZIP压缩包')
        return redirect(url_for('index'))

    # 生成唯一插件ID（避免目录冲突）
    plugin_id = str(uuid.uuid4())
    plugin_dir = os.path.join(app.config['UPLOAD_FOLDER'], plugin_id)
    os.makedirs(plugin_dir, exist_ok=True)

    try:
        # 保存并解压ZIP文件
        zip_path = os.path.join(plugin_dir, secure_filename(file.filename))
        file.save(zip_path)

        # 解压ZIP（需包含plugin.json和入口模块）
        import zipfile
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(plugin_dir)
        os.remove(zip_path)  # 解压后删除原ZIP包

        # 验证插件必备文件
        if not os.path.exists(os.path.join(plugin_dir, 'plugin.json')):
            raise ValueError("插件缺少核心配置：plugin.json")
        
        # 读取插件元信息
        with open(os.path.join(plugin_dir, 'plugin.json'), 'r', encoding='utf-8') as f:
            plugin_meta = json.load(f)
        
        # 验证插件名称（必填）
        if not plugin_meta.get('name'):
            raise ValueError("plugin.json缺少必填字段：name")

        # 存储插件信息到数据库
        new_plugin = Plugin(
            id=plugin_id,
            name=plugin_meta['name'],
            description=plugin_meta.get('description', ''),
            author=plugin_meta.get('author', ''),
            version=plugin_meta.get('version', '1.0'),
            entry_point=plugin_meta.get('entry_point', 'main.run')
        )
        db.session.add(new_plugin)
        db.session.commit()

        flash(f'插件「{plugin_meta["name"]}」上传成功！')
    except Exception as e:
        # 上传失败：清理目录+回滚数据库
        shutil.rmtree(plugin_dir, ignore_errors=True)
        db.session.rollback()
        flash(f'插件上传失败：{str(e)}')
    
    return redirect(url_for('index'))

@app.route('/plugins')
def list_plugins():
    """
    返回所有可用插件的列表。
    遍历 plugins 目录，读取每个插件的 plugin.json 文件。
    """
    plugins = []
    
    # 检查插件目录是否存在
    if not os.path.isdir(PLUGINS_DIR):
        return jsonify(plugins) # 返回空列表
    
    # 遍历插件目录中的每个子目录
    for plugin_folder in os.listdir(PLUGINS_DIR):
        plugin_path = os.path.join(PLUGINS_DIR, plugin_folder)
        if os.path.isdir(plugin_path):
            plugin_json_path = os.path.join(plugin_path, 'plugin.json')
            # 检查 plugin.json 文件是否存在
            if os.path.isfile(plugin_json_path):
                try:
                    with open(plugin_json_path, 'r', encoding='utf-8') as f:
                        plugin_meta = json.load(f)
                    
                    # 为每个插件添加 'id'，通常使用文件夹名作为 id
                    plugin_info = {
                        'id': plugin_folder,
                        'name': plugin_meta.get('name', plugin_folder),
                        'description': plugin_meta.get('description', '无描述'),
                        'version': plugin_meta.get('version', '未知')
                    }
                    plugins.append(plugin_info)
                except json.JSONDecodeError:
                    print(f"警告: 插件 {plugin_folder} 的 plugin.json 文件格式错误，已跳过。")
                except Exception as e:
                    print(f"警告: 读取插件 {plugin_folder} 信息时出错: {e}，已跳过。")

    # 返回 JSON 格式的插件列表
    return jsonify(plugins)



@app.route('/plugin/<plugin_id>/meta')
def get_plugin_meta(plugin_id):
    """获取插件元信息（含UI配置）"""
    plugin = Plugin.query.get_or_404(plugin_id)
    plugin_dir = os.path.join(app.config['UPLOAD_FOLDER'], str(plugin_id))

    # 读取plugin.json
    plugin_json_path = os.path.join(plugin_dir, 'plugin.json')
    print(plugin_json_path)
    if not os.path.exists(plugin_json_path):
        return jsonify({'error': '插件配置文件缺失'}), 404
    
    with open(plugin_json_path, 'r', encoding='utf-8') as f:
        plugin_meta = json.load(f)
    
    # 返回安全的元信息（过滤敏感字段）
    return jsonify({
        'name': plugin_meta.get('name'),
        'description': plugin_meta.get('description'),
        'version': plugin_meta.get('version'),
        'author': plugin_meta.get('author'),
        'ui_schema': plugin_meta.get('ui_schema', [])  # 核心：UI配置
    })

@app.route('/plugin/<int:plugin_id>/toggle', methods=['POST'])
def toggle_plugin(plugin_id):
    """启用/禁用插件"""
    plugin = Plugin.query.get_or_404(plugin_id)
    plugin.is_enabled = not plugin.is_enabled
    db.session.commit()
    return jsonify({'success': True, 'is_enabled': plugin.is_enabled})

@app.route('/plugin/<int:plugin_id>/delete', methods=['POST'])
def delete_plugin(plugin_id):
    """删除插件（含文件+数据库记录）"""
    plugin = Plugin.query.get_or_404(plugin_id)
    plugin_dir = os.path.join(app.config['UPLOAD_FOLDER'], str(plugin_id))

    try:
        # 清理插件文件
        if os.path.exists(plugin_dir):
            shutil.rmtree(plugin_dir, ignore_errors=True)
        
        # 删除数据库记录
        db.session.delete(plugin)
        db.session.commit()
        flash(f'插件「{plugin.name}」已删除')
    except Exception as e:
        db.session.rollback()
        flash(f'插件删除失败：{str(e)}')
    
    return redirect(url_for('index'))



@app.route('/plugin/<plugin_id>/run', methods=['POST'])
def run_plugin_route(plugin_id):
    """运行插件（接收前端输入，返回执行结果）"""
    plugin = Plugin.query.get_or_404(plugin_id)
    
    # 验证插件是否启用
    if not plugin.is_enabled:
        return jsonify({'error': '插件已被禁用，无法执行'}), 403
    
    # 获取前端传入的输入数据
    # 前端发送的JSON数据是直接包含参数的，没有外层的'input'键
    input_data = request.json
    if not isinstance(input_data, dict):
        return jsonify({'error': '输入数据格式错误（需为JSON对象）'}), 400

    try:
        # 执行插件（run_plugin 需返回约定格式：成功时含 status/data，错误时含 error）
        result = run_plugin(plugin_id, input_data)
        
        # 直接返回插件执行结果（无需额外包裹 status/output，由插件自身保证格式）
        return jsonify(result)
        
    except PluginExecutionError as e:
        # 插件执行层面的错误（如参数校验失败、处理逻辑报错）
        return jsonify({'error': str(e)}), 400  # 用 400 表示客户端相关错误
    except Exception as e:
        # 服务器层面的未知错误（如依赖缺失、代码bug）
        current_app.logger.error(f"插件执行服务器错误：{str(e)}", exc_info=True)
        return jsonify({'error': '服务器内部错误，请稍后重试'}), 500


# 启动应用
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')  # 开发环境：允许外部访问

