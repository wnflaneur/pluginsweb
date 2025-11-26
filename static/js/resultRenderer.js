import { escapeHtml } from './utils.js';
import { formatFileSize } from './utils.js';

/**
 * 渲染插件执行结果
 * @param {object} result - 执行结果
 * @param {HTMLElement} container - 容器元素
 * @param {object} outputConfig - 输出配置
 */
export function renderPluginResult(result, container, outputConfig) {
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
        case 'regex_result':
            renderRegexResult(result.data, resultContentDiv);
            break;
        case 'image':
            renderImageResult(content, meta, resultContentDiv);
            break;
        case 'file':
            renderFileResult(content, meta, resultContentDiv);
            break;
        case 'text':
            renderTextResult(content, resultContentDiv);
            break;
        default:
            renderDefaultResult(result.data, resultContentDiv);
    }

    container.appendChild(resultContentDiv);
}

/**
 * 渲染正则表达式结果
 */
function renderRegexResult(data, container) {
    let matchesTable = `
    <table class="table table-striped table-hover mt-3">
        <thead class="table-light">
            <tr>
                <th>匹配项</th>
                <th>位置</th>
                <th>长度</th>
                <th>匹配值</th>
            </tr>
        </thead>
        <tbody>
    `;

    data.matches.forEach((match, index) => {
        const matchNumber = index + 1;
        const position = `${match.start}-${match.end}`;
        matchesTable += `
            <tr>
                <td>${matchNumber}</td>
                <td>${position}</td>
                <td>${match.length}</td>
                <td><code>${match.value}</code></td>
            </tr>
        `;
        
        if (match.groups && match.groups.length > 0) {
            matchesTable += `<tr><td colspan="4" class="p-0">
                <div class="ms-4 mt-2 mb-3">
                    <strong>分组信息:</strong>
                    <ul class="list-group list-group-flush mt-2">
            `;
            
            match.groups.forEach((groupValue, groupIndex) => {
                if (groupValue !== undefined) {
                    const groupPos = match.group_positions ? 
                        `${match.group_positions[groupIndex].start}-${match.group_positions[groupIndex].end}` : 
                        '未知';
                    matchesTable += `
                        <li class="list-group-item">
                            分组 ${groupIndex + 1}: ${groupValue} (位置: ${groupPos})
                        </li>
                    `;
                }
            });
            
            matchesTable += `
                    </ul>
                </div>
            </td></tr>`;
        }
    });

    matchesTable += `</tbody></table>`;

    container.innerHTML = `
        <div class="card mb-3">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0">匹配摘要</h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <p><strong>正则表达式:</strong> <code class="bg-light p-1 rounded">${escapeHtml(data.regex_with_flags || data.regex)}</code></p>
                        <p><strong>匹配模式:</strong> ${data.flags.length ? data.flags.join(', ') : '无'}</p>
                    </div>
                    <div class="col-md-6">
                        <p><strong>测试字符串长度:</strong> ${data.test_string.length} 字符</p>
                        <p><strong>匹配总数:</strong> <span class="badge bg-primary rounded-pill">${data.total_matches}</span></p>
                    </div>
                    <div>
                    <h6>匹配详情:</h6>
                    ${matchesTable}
                </div>
                </div>
            </div>
        </div>
        
        <div class="card mb-3">
            <div class="card-header bg-light">
                <h5 class="mb-0">测试字符串</h5>
            </div>
            <div class="card-body">
                <div class="bg-light p-3 rounded border" style="white-space: pre-wrap; word-break: break-all;">${escapeHtml(data.test_string)}</div>
            </div>
        </div>
    `;
}

/**
 * 渲染图片结果
 */
function renderImageResult(content, meta, container) {
    const filename = meta?.filename || 'image.png';
    container.innerHTML = `
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
}

/**
 * 渲染文件结果
 */
function renderFileResult(content, meta, container) {
    const fileName = meta?.filename || 'download.bin';
    container.innerHTML = `
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
}

/**
 * 渲染文本结果
 */
function renderTextResult(content, container) {
    container.innerHTML = `
        <div class="card">
            <div class="card-body">
                <h5 class="card-title">文本结果</h5>
                <pre class="bg-light p-3 rounded overflow-auto" style="max-height: 300px;">${content}</pre>
            </div>
        </div>
    `;
}

/**
 * 渲染默认结果（JSON格式）
 */
function renderDefaultResult(data, container) {
    container.innerHTML = `
        <div class="card">
            <div class="card-body">
                <h5 class="card-title">返回结果</h5>
                <pre class="bg-light p-3 rounded overflow-auto" style="max-height: 300px;">${JSON.stringify(data, null, 2)}</pre>
            </div>
        </div>
    `;
}
