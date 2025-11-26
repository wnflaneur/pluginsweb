from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Plugin(db.Model):
    """插件模型：存储插件元信息"""
    id = db.Column(db.String(36), primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)  # 插件名称（唯一）
    description = db.Column(db.Text, nullable=True)               # 插件描述
    author = db.Column(db.String(80), nullable=True)              # 作者
    version = db.Column(db.String(20), nullable=True)             # 版本
    entry_point = db.Column(db.String(120), default="main.run")   # 执行入口（模块.函数）
    is_enabled = db.Column(db.Boolean, default=True)              # 是否启用
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  # 创建时间

    def __repr__(self):
        return f'<Plugin {self.name}>'

