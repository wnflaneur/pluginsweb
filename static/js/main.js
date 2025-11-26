import { initPlugins } from './pluginList.js';
import { initModalEvents } from './modalHandler.js';
import { initUploadForm } from './uploadHandler.js';

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initPlugins();
    initModalEvents();
    initUploadForm();
});
