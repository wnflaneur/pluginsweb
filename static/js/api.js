/**
 * 获取所有插件列表
 */
export async function fetchPlugins() {
    const response = await fetch('/plugins');
    if (!response.ok) throw new Error('网络错误');
    return await response.json();
}

/**
 * 获取插件元信息（含UI配置）
 * @param {string} pluginId - 插件ID
 */
export async function fetchPluginMetadata(pluginId) {
    const response = await fetch(`/plugin/${pluginId}/meta`);
    if (!response.ok) throw new Error('加载插件配置失败');
    return await response.json();
}

/**
 * 执行插件
 * @param {string} pluginId - 插件ID
 * @param {object} data - 输入数据
 */
export async function runPlugin(pluginId, data) {
    const response = await fetch(`/plugin/${pluginId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return await response.json();
}
