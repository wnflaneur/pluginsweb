import { fetchPlugins } from './api.js';

let pluginsListElement;

export function initPlugins() {
    pluginsListElement = document.getElementById('pluginsList');
    loadAndRenderPlugins();
}

async function loadAndRenderPlugins() {
    try {
        const plugins = await fetchPlugins();
        renderPluginsList(plugins);
    } catch (error) {
        pluginsListElement.innerHTML = `<div class="col"><div class="alert alert-danger"><i class="fas fa-exclamation-circle me-2"></i>加载插件失败: ${error.message}</div></div>`;
    }
}

export function renderPluginsList(plugins) {
    if (!pluginsListElement) return;

    if (plugins.length === 0) {
        pluginsListElement.innerHTML = '<div class="col"><div class="alert alert-info"><i class="fas fa-info-circle me-2"></i>暂无可用插件</div></div>';
        return;
    }

    pluginsListElement.innerHTML = '';
    plugins.forEach(plugin => {
        const card = document.createElement('div');
        card.className = 'col';
        card.innerHTML = `
            <div class="card plugin-card h-100" data-plugin-id="${plugin.id}">
                <div class="card-body">
                    <h5 class="card-title">${plugin.name}</h5>
                    <p class="card-text">${plugin.description || '无描述'}</p>
                </div>
                <div class="card-footer text-muted">
                    <small>版本: ${plugin.version || '未知'}</small>
                </div>
            </div>
        `;
        pluginsListElement.appendChild(card);
    });

    // 绑定卡片点击事件（打开模态框）
    document.querySelectorAll('.plugin-card').forEach(card => {
        card.addEventListener('click', () => {
            const pluginId = card.dataset.pluginId;
            if (pluginId && pluginId !== 'loading') {
                // 调用模态框模块的打开方法
                import('./modalHandler.js').then(({ openPluginModal }) => {
                    openPluginModal(pluginId);
                });
            }
        });
    });
}
