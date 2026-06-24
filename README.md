# PDF 工具箱

纯前端 PDF 工具 + 图片格式转换，所有处理在浏览器本地完成，**不上传任何服务器**。

## 在线地址

https://你的用户名.github.io/pdf-tools/

## 功能

- 合并 PDF — 多文件合并，拖拽排列
- 压缩 PDF — 三级压缩（轻度/中度/强力）
- PDF 转图片 — 每页导出 PNG，支持 ZIP 打包
- 图片格式转换 — JPG / PNG / WebP 互转，支持质量调节和缩放

## 本地运行

直接用浏览器打开 `index.html` 即可，无需服务器。

或者用 Python 启动一个简单服务器：
```bash
python -m http.server 8080
```
然后访问 http://localhost:8080

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库，命名为 `pdf-tools`
2. 把本项目所有文件上传到仓库
3. 在仓库 Settings → Pages 中：
   - Source 选 `Deploy from a branch`
   - Branch 选 `main`，目录选 `/ (root)`
   - 点 Save
4. 等待几分钟，你的工具就在 `https://你的用户名.github.io/pdf-tools/` 上线了

## 绑定自定义域名（可选）

1. 去域名注册商（阿里云/腾讯云）购买域名
2. 添加 CNAME 记录指向 `你的用户名.github.io`
3. 在 GitHub Pages 设置中填写你的域名
4. 在项目根目录创建 `CNAME` 文件，内容为你的域名

## 技术栈

- PDF-Lib — PDF 合并与压缩
- PDF.js — PDF 渲染
- Canvas API — 图片格式转换
- JSZip — ZIP 打包下载

## 目录结构

```
pdf-tools/
  index.html      — 页面结构
  styles.css      — 样式
  app.js          — 核心逻辑
  lib/            — 本地依赖库
  README.md       — 说明文档
```
