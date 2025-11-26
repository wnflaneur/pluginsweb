document.addEventListener('DOMContentLoaded', () => {
    const pluginsListElement = document.getElementById('pluginsList');
    const pluginModal = new bootstrap.Modal(document.getElementById('pluginModal'));
    const modalTitleElement = document.getElementById('pluginModalLabel');
    const modalDescriptionElement = document.getElementById('pluginDescription');
    const pluginUIElement = document.getElementById('pluginUI');
    const pluginResultElement = document.getElementById('pluginResult');
    const executeBtnElement = document.getElementById('executePluginBtn');

    const pluginMetadataCache = new Map();

    async function init() {
        try {
            const plugins = await fetchPlugins();
            renderPluginsList(plugins);
        } catch (error) {
            pluginsListElement.innerHTML = `<div class="col"><div class="alert alert-danger"><i class="fas fa-exclamation-circle me-2"></i>加载插件失败: ${error.message}</div></div>`;
        }
    }

    async function fetchPlugins() {
        const response = await fetch('/plugins');
        if (!response.ok) throw new Error('网络错误');
        return await response.json();
    }

    function renderPluginsList(plugins) {
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

        document.querySelectorAll('.plugin-card').forEach(card => {
            card.addEventListener('click', () => {
                const pluginId = card.dataset.pluginId;
                if (pluginId && pluginId !== 'loading') openPluginModal(pluginId);
            });
        });
    }

    async function openPluginModal(pluginId) {
        try {
            const metadata = await loadPluginMetadata(pluginId);
            
            modalTitleElement.textContent = metadata.name;
            modalDescriptionElement.textContent = metadata.description || '无详细描述。';
            
            pluginUIElement.innerHTML = '';
            if (metadata.ui_schema && metadata.ui_schema.length > 0) {
                pluginUIElement.innerHTML = renderUIFromSchema(metadata.ui_schema);
            } else {
                pluginUIElement.innerHTML = '<div class="alert alert-info"><i class="fas fa-info-circle me-2"></i>此插件无需配置，点击下方按钮即可执行。</div>';
            }
            
            pluginResultElement.innerHTML = '';
            
            pluginModal._element.dataset.pluginId = pluginId;
            pluginModal._element.dataset.pluginOutputConfig = JSON.stringify(metadata.output || {});
            
            pluginModal.show();

        } catch (error) {
            pluginUIElement.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-circle me-2"></i>加载插件失败: ${error.message}</div>`;
            pluginModal.show();
        }
    }

    async function loadPluginMetadata(pluginId) {
        if (pluginMetadataCache.has(pluginId)) {
            return pluginMetadataCache.get(pluginId);
        }
        const response = await fetch(`/plugin/${pluginId}/meta`);
        if (!response.ok) throw new Error('加载插件配置失败');
        const metadata = await response.json();
        pluginMetadataCache.set(pluginId, metadata);
        return metadata;
    }

    function renderUIFromSchema(uiSchema) {
        let html = '<form id="pluginForm">';
        uiSchema.forEach(field => {
            const { type, name, label, description, default: defaultValue, min, max, step, accept, options } = field;
            html += `<div class="mb-3">`;
            html += `<label for="field-${name}" class="form-label">${label}</label>`;
            
            switch (type) {
                case 'text':
                    html += `<input type="text" class="form-control" id="field-${name}" name="${name}" value="${defaultValue || ''}">`;
                    break;
                case 'number':
                    html += `<input type="number" class="form-control" id="field-${name}" name="${name}" value="${defaultValue || 0}" min="${min}" max="${max}" step="${step}">`;
                    break;
                case 'slider':
                    html += `<input type="range" class="form-range" id="field-${name}" name="${name}" value="${defaultValue || 0}" min="${min || 0}" max="${max || 100}" step="${step || 1}">`;
                    html += `<div class="slider-value">当前值: <span id="slider-value-${name}">${defaultValue || 0}</span></div>`;
                    break;
                case 'file':
                    html += `<input type="file" class="form-control" id="field-${name}" name="${name}" ${accept ? `accept="${accept}"` : ''}>`;
                    break;
                case 'select':
                    html += `<select class="form-select" id="field-${name}" name="${name}">`;
                    (options || []).forEach(option => {
                        const isSelected = (defaultValue === option.value) ? 'selected' : '';
                        html += `<option value="${option.value}" ${isSelected}>${option.label}</option>`;
                    });
                    html += `</select>`;
                    break;
                default:
                    html += `<p class="text-warning"><i class="fas fa-exclamation-triangle me-2"></i>不支持的控件类型: ${type}</p>`;
            }

            if (description) {
                html += `<div class="form-text">${description}</div>`;
            }
            html += `</div>`;
        });
        html += '</form>';
        return html;
    }

    function collectFormData(formElement) {
        const formData = new FormData(formElement);
        const data = {};
        
        formData.forEach((value, key) => {
            data[key] = value;
        });

        const fileInputs = formElement.querySelectorAll('input[type="file"]');
        const filePromises = Array.from(fileInputs).map(input => {
            if (input.files.length > 0) {
                return fileToBase64(input.files[0])
                    .then(base64 => { data[input.name] = base64; });
            }
            return Promise.resolve();
        });

        return Promise.all(filePromises).then(() => data);
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(file);
        });
    }

    executeBtnElement.addEventListener('click', async () => {
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
            pluginResultElement.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"><span class="sr-only">执行中...</span></div><p class="mt-3">正在处理，请稍候...</p></div>';
            
            const response = await fetch(`/plugin/${pluginId}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();
            
            const outputConfig = JSON.parse(pluginModal._element.dataset.pluginOutputConfig || '{}');
            
            renderPluginResult(result, pluginResultElement, outputConfig);

        } catch (error) {
            pluginResultElement.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-circle me-2"></i>执行失败: ${error.message}</div>`;
            console.error(error);
        }
    });

    function renderPluginResult(result, container, outputConfig) {
        container.innerHTML = '';

        if (result.error) {
            container.innerHTML = `<div class="alert alert-danger" role="alert"><strong><i class="fas fa-times-circle me-2"></i>执行失败:</strong> ${result.error}</div>`;
            return;
        }

        if (result.status !== 'success') {
            container.innerHTML = `<div class="alert alert-info" role="alert"><i class="fas fa-info-circle me-2"></i>${result.message || '操作完成'}</div>`;
            return;
        }
        
        if (result.message) {
            container.innerHTML += `<div class="alert alert-success" role="alert"><strong><i class="fas fa-check-circle me-2"></i>执行成功!</strong> ${result.message}</div>`;
        }

        if (!result.data) {
            return;
        }

        const resultContentDiv = document.createElement('div');
        resultContentDiv.className = 'plugin-result-content mt-3';

        const { type, content, meta } = result.data;

        switch (outputConfig.type || type) {
            case 'image':
                const filename = meta?.filename || 'image.png';
                resultContentDiv.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">图片预览</h5>
                            <div class="text-center">
                                <img src="${content}" alt="Result Image" class="img-fluid rounded mb-3">
                                <a href="${content}" class="btn btn-primary" download="${filename}"><i class="fas fa-download me-2"></i>下载图片</a>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'file':
                const fileName = meta?.filename || 'download.bin';
                resultContentDiv.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">文件已生成</h5>
                             <div class="text-center">
                                <p class="card-text">准备下载: <strong>${fileName}</strong></p>
                                ${meta?.size ? `<p class="card-text text-muted">大小: ${formatFileSize(meta.size)}</p>` : ''}
                                <a href="${content}" class="btn btn-primary" download="${fileName}"><i class="fas fa-download me-2"></i>下载文件</a>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'text':
                resultContentDiv.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">文本结果</h5>
                            <pre class="bg-light p-3 rounded overflow-auto" style="max-height: 300px;">${content}</pre>
                        </div>
                    </div>
                `;
                break;
            default:
                resultContentDiv.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">返回结果</h5>
                            <pre class="bg-light p-3 rounded overflow-auto" style="max-height: 300px;">${JSON.stringify(result.data, null, 2)}</pre>
                        </div>
                    </div>
                `;
        }

        container.appendChild(resultContentDiv);
    }
    
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
        else return (bytes / 1048576).toFixed(2) + ' MB';
    }
    
    init();

    pluginModal._element.addEventListener('shown.bs.modal', () => {
        document.querySelectorAll('input[type="range"]').forEach(slider => {
            const displaySpan = document.getElementById(`slider-value-${slider.name}`);
            if (displaySpan) {
                slider.addEventListener('input', (e) => {
                    displaySpan.textContent = e.target.value;
                });
            }
        });
    });
});

