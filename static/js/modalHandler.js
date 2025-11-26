import { fetchPluginMetadata } from './api.js';
import { renderUIFromSchema } from './uiRenderer.js';
import { collectFormData } from './formHandler.js';
import { runPlugin } from './api.js';
import { renderPluginResult } from './resultRenderer.js';

let pluginModal;
let modalTitleElement;
let modalDescriptionElement;
let pluginUIElement;
let pluginResultElement;
let executeBtnElement;
const pluginMetadataCache = new Map();

export function initModalEvents() {
    // 初始化模态框元素
    pluginModal = new bootstrap.Modal(document.getElementById('pluginModal'));
    modalTitleElement = document.getElementById('pluginModalLabel');
    modalDescriptionElement = document.getElementById('pluginDescription');
    pluginUIElement = document.getElementById('pluginUI');
    pluginResultElement = document.getElementById('pluginResult');
    executeBtnElement = document.getElementById('executePluginBtn');

    // 绑定执行按钮事件
    executeBtnElement.addEventListener('click', handleExecutePlugin);

    // 绑定模态框显示事件（初始化滑块）
    pluginModal._element.addEventListener('shown.bs.modal', initSliderListeners);
}

/**
 * 打开插件模态框
 * @param {string} pluginId - 插件ID
 */
export async function openPluginModal(pluginId) {
    try {
        const metadata = await loadPluginMetadata(pluginId);
        
        // 更新模态框内容
        modalTitleElement.textContent = metadata.name;
        modalDescriptionElement.textContent = metadata.description || '无详细描述。';
        pluginUIElement.innerHTML = '';
        
        // 渲染UI表单
        if (metadata.ui_schema && metadata.ui_schema.length > 0) {
            pluginUIElement.innerHTML = renderUIFromSchema(metadata.ui_schema);
        } else {
            pluginUIElement.innerHTML = '<div class="alert alert-info"><i class="fas fa-info-circle me-2"></i>此插件无需配置，点击下方按钮即可执行。</div>';
        }
        
        // 清空结果区
        pluginResultElement.innerHTML = '';
        
        // 存储插件ID和输出配置
        pluginModal._element.dataset.pluginId = pluginId;
        pluginModal._element.dataset.pluginOutputConfig = JSON.stringify(metadata.output || {});
        
        pluginModal.show();

    } catch (error) {
        pluginUIElement.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-circle me-2"></i>加载插件失败: ${error.message}</div>`;
        pluginModal.show();
    }
}

/**
 * 加载插件元信息（带缓存）
 * @param {string} pluginId - 插件ID
 */
async function loadPluginMetadata(pluginId) {
    if (pluginMetadataCache.has(pluginId)) {
        return pluginMetadataCache.get(pluginId);
    }
    const metadata = await fetchPluginMetadata(pluginId);
    pluginMetadataCache.set(pluginId, metadata);
    return metadata;
}

/**
 * 处理插件执行逻辑
 */
async function handleExecutePlugin() {
    const pluginId = pluginModal._element.dataset.pluginId;
    if (!pluginId) return;

    const formElement = document.getElementById('pluginForm');
    let data = {};
    if (formElement) {
        try {
            data = await collectFormData(formElement);
        } catch (error) {
            pluginResultElement.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-circle me-2"></i>收集表单数据失败: ${error.message}</div>`;
            return;
        }
    }

    try {
        // 显示加载状态
        pluginResultElement.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"><span class="sr-only">执行中...</span></div><p class="mt-3">正在处理，请稍候...</p></div>';
        
        // 执行插件
        const result = await runPlugin(pluginId, data);
        const outputConfig = JSON.parse(pluginModal._element.dataset.pluginOutputConfig || '{}');
        
        // 渲染结果
        renderPluginResult(result, pluginResultElement, outputConfig);

    } catch (error) {
        pluginResultElement.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-circle me-2"></i>执行失败: ${error.message}</div>`;
        console.error(error);
    }
}

/**
 * 初始化滑块值实时显示
 */
function initSliderListeners() {
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        const displaySpan = document.getElementById(`slider-value-${slider.name}`);
        if (displaySpan) {
            // 初始值设置
            displaySpan.textContent = slider.value;
            // 监听变化
            slider.addEventListener('input', (e) => {
                displaySpan.textContent = e.target.value;
            });
        }
    });
}
