/**
 * 初始化上传表单事件
 */
export function initUploadForm() {
    const uploadForm = document.querySelector('form[action="/upload"]');
    if (!uploadForm) return;

    uploadForm.addEventListener('submit', function(e) {
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        // 显示加载状态
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>上传中...';
        
        // 可在此处添加AJAX上传逻辑实现进度条
    });
}
