/**
 * 根据UI schema渲染表单
 * @param {array} uiSchema - 表单配置 schema
 * @returns {string} 渲染后的HTML字符串
 */
export function renderUIFromSchema(uiSchema) {
    let html = '<form id="pluginForm">';
    uiSchema.forEach(field => {
        const { type, name, label, description, default: defaultValue, min, max, step, accept, options, rows, placeholder } = field;
        html += `<div class="mb-3">`;
        html += `<label for="field-${name}" class="form-label">${label}</label>`;
        
        switch (type) {
            case 'text':
                html += `<input type="text" class="form-control" id="field-${name}" name="${name}" value="${defaultValue || ''}">`;
                break;
            case 'textarea':
                html += `<textarea class="form-control" id="field-${name}" name="${name}" rows="${rows || 3}" ${placeholder ? `placeholder="${placeholder}"` : ''}>${defaultValue || ''}</textarea>`;
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
            case 'checkbox-group':
                if (!options || !Array.isArray(options)) {
                    html += `<p class="text-warning"><i class="fas fa-exclamation-triangle me-2"></i>复选框组配置错误：缺少选项</p>`;
                } else {
                    const defaultValues = Array.isArray(defaultValue) ? defaultValue : (defaultValue ? [defaultValue] : []);
                    html += `<div class="checkbox-group">`;
                    options.forEach((option, index) => {
                        const id = `field-${name}-${index}`;
                        const isChecked = defaultValues.includes(option.value) ? 'checked' : '';
                        html += `
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="${id}" name="${name}" value="${option.value}" ${isChecked}>
                                <label class="form-check-label" for="${id}">${option.label}</label>
                            </div>
                        `;
                    });
                    html += `</div>`;
                }
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
