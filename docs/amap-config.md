# 高德 API 配置

本项目区分三项凭据：

- `AMAP_WEB_SERVICE_KEY`：只供服务端或离线数据脚本调用 POI 搜索与详情，不进入浏览器包。
- `NEXT_PUBLIC_AMAP_JS_KEY`：浏览器加载高德 JS API。
- `NEXT_PUBLIC_AMAP_SECURITY_JS_CODE`：高德 JS API 2.0 安全密钥。

真实值写入仓库根目录 `.env.local`。该文件已由 `.gitignore` 排除，不得提交、输出到日志或写入文档。

个人自用本机开发时，高德控制台应给 JS API Key 配置本机允许来源；公开部署前再补正式域名白名单。
