/**
 * 收集表单数据（含文件转换）
 * @param {HTMLFormElement} formElement - 表单元素
 * @returns {Promise<object>} 处理后的表单数据
 */
export async function collectFormData(formElement) {
    const data = {};
    
    // 处理普通表单字段
    const inputs = formElement.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.type === 'checkbox') {
            if (!input.checked) return;
            if (data[input.name]) {
                if (!Array.isArray(data[input.name])) {
                    data[input.name] = [data[input.name]];
                }
                data[input.name].push(input.value);
            } else {
                data[input.name] = input.value;
            }
        } else if (input.type === 'radio') {
            if (input.checked) {
                data[input.name] = input.value;
            }
        } else {
            if (data[input.name] === undefined) {
                data[input.name] = input.value;
            }
        }
    });

    // 处理文件上传（转换为Base64）
    const fileInputs = formElement.querySelectorAll('input[type="file"]');
    const filePromises = Array.from(fileInputs).map(input => {
        if (input.files.length > 0) {
            return fileToBase64(input.files[0])
                .then(base64 => { data[input.name] = base64; });
        }
        return Promise.resolve();
    });

    // 确保复选框组返回数组
    return Promise.all(filePromises).then(() => {
        Object.keys(data).forEach(key => {
            if (formElement.querySelectorAll(`input[name="${key}"][type="checkbox"]`).length > 0 && 
                !Array.isArray(data[key])) {
                data[key] = [data[key]];
            }
        });
        return data;
    });
}

/**
 * 将文件转换为Base64字符串
 * @param {File} file - 要转换的文件
 * @returns {Promise<string>} Base64字符串
 */
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
}
