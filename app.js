/* ==========================================
   PDF 工具箱 - 所有逻辑
   ========================================== */

// ===== 工具函数 =====
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// ===== Tab 切换 =====
const tabBtns = document.querySelectorAll('.tab-btn');
const toolPanels = {
    merge: document.getElementById('tool-merge'),
    compress: document.getElementById('tool-compress'),
    convert: document.getElementById('tool-convert'),
    imgconvert: document.getElementById('tool-imgconvert'),
};

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Object.values(toolPanels).forEach(p => p.classList.remove('active'));
        toolPanels[btn.dataset.tool].classList.add('active');
    });
});


/* ==========================================
   功能 1: 合并 PDF
   ========================================== */
const mergeModule = {
    files: [],

    init() {
        this.dropzone = document.getElementById('merge-dropzone');
        this.input = document.getElementById('merge-input');
        this.fileList = document.getElementById('merge-file-list');
        this.mergeBtn = document.getElementById('merge-btn');
        this.clearBtn = document.getElementById('merge-clear-btn');
        this.progress = document.getElementById('merge-progress');
        this.progressFill = document.getElementById('merge-progress-fill');
        this.progressText = document.getElementById('merge-progress-text');
        this.result = document.getElementById('merge-result');
        this.resultMeta = document.getElementById('merge-result-meta');
        this.downloadBtn = document.getElementById('merge-download');

        this.setupDragDrop(this.dropzone, this.input);
        this.input.addEventListener('change', (e) => this.addFiles(e.target.files));
        this.mergeBtn.addEventListener('click', () => this.merge());
        this.clearBtn.addEventListener('click', () => this.clearAll());
    },

    setupDragDrop(zone, input) {
        zone.addEventListener('click', () => input.click());
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            this.addFiles(e.dataTransfer.files);
        });
    },

    addFiles(fileList) {
        const validFiles = [];
        for (const file of fileList) {
            if (file.type === 'application/pdf' || getFileExtension(file.name) === 'pdf') {
                if (!this.files.some(f => f.name === file.name && f.size === file.size)) {
                    validFiles.push(file);
                }
            }
        }
        this.files = [...this.files, ...validFiles];
        this.renderFileList();
        this.updateButtons();
    },

    removeFile(index) {
        this.files.splice(index, 1);
        this.renderFileList();
        this.updateButtons();
    },

    renderFileList() {
        if (this.files.length === 0) {
            this.fileList.innerHTML = '';
            return;
        }
        if (!this.thumbnails) this.thumbnails = {};
        this.fileList.innerHTML = this.files.map((f, i) => `
            <div class="file-item">
                <span class="file-item-icon">??</span>
                <div class="file-item-info">
                    <div class="file-item-name">${f.name}</div>
                    <div class="file-item-size">${formatSize(f.size)}</div>
                </div>
                <button class="file-item-remove" data-index="${i}">?</button>
            </div>
        `).join('');
        this.fileList.querySelectorAll('.file-item-remove').forEach(btn => {
            btn.addEventListener('click', () => this.removeFile(parseInt(btn.dataset.index)));
        });
    },

    updateButtons() {
        this.mergeBtn.disabled = this.files.length < 2;
        this.clearBtn.disabled = this.files.length === 0;
    },

    clearAll() {
        this.files = [];
        this.renderFileList();
        this.updateButtons();
        this.result.hidden = true;
        this.progress.hidden = true;
    },

    async merge() {
        if (this.files.length < 2) return;

        this.result.hidden = true;
        this.progress.hidden = false;
        this.progressFill.style.width = '0%';
        this.mergeBtn.disabled = true;

        try {
            const mergedPdf = await PDFLib.PDFDocument.create();
            mergedPdf.registerFontkit(fontkit);

            let totalPages = 0;
            const pageCounts = [];

            // 先计算总页数
            for (let i = 0; i < this.files.length; i++) {
                this.progressText.textContent = `正在读取第 ${i + 1}/${this.files.length} 个文件...`;
                this.progressFill.style.width = `${((i) / this.files.length) * 50}%`;
                const bytes = await readFileAsArrayBuffer(this.files[i]);
                const pdf = await PDFLib.PDFDocument.load(bytes, {
                    ignoreEncryption: true,
                });
                pageCounts.push(pdf.getPageCount());
                totalPages += pdf.getPageCount();
            }

            let processedPages = 0;
            for (let i = 0; i < this.files.length; i++) {
                this.progressText.textContent = `正在合并第 ${i + 1}/${this.files.length} 个文件 (${pageCounts[i]} 页)...`;
                const bytes = await readFileAsArrayBuffer(this.files[i]);
                const pdf = await PDFLib.PDFDocument.load(bytes, {
                    ignoreEncryption: true,
                });
                const indices = pdf.getPageIndices();
                const copiedPages = await mergedPdf.copyPages(pdf, indices);
                copiedPages.forEach(page => mergedPdf.addPage(page));
                processedPages += copiedPages.length;
                const pct = 50 + (processedPages / totalPages) * 50;
                this.progressFill.style.width = `${Math.min(pct, 100)}%`;
            }

            this.progressText.textContent = '正在生成最终文件...';
            const mergedBytes = await mergedPdf.save();

            // 生成下载
            const blob = new Blob([mergedBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            this.downloadBtn.href = url;

            const mergedSize = blob.size;
            const originalSize = this.files.reduce((s, f) => s + f.size, 0);
            this.resultMeta.textContent =
                `共 ${this.files.length} 个文件 · ${totalPages} 页 · ${formatSize(originalSize)} → ${formatSize(mergedSize)}`;
            this.result.hidden = false;
            this.progress.hidden = true;
        } catch (err) {
            console.error(err);
            alert('合并失败: ' + err.message);
        } finally {
            this.mergeBtn.disabled = false;
        }
    },
};


/* ==========================================
   功能 2: 压缩 PDF
   ========================================== */
const compressModule = {
    file: null,

    init() {
        this.dropzone = document.getElementById('compress-dropzone');
        this.input = document.getElementById('compress-input');
        this.fileList = document.getElementById('compress-file-list');
        this.compressBtn = document.getElementById('compress-btn');
        this.clearBtn = document.getElementById('compress-clear-btn');
        this.progress = document.getElementById('compress-progress');
        this.progressFill = document.getElementById('compress-progress-fill');
        this.progressText = document.getElementById('compress-progress-text');
        this.result = document.getElementById('compress-result');
        this.resultMeta = document.getElementById('compress-result-meta');
        this.downloadBtn = document.getElementById('compress-download');

        this.setupDragDrop(this.dropzone, this.input);
        this.input.addEventListener('change', (e) => this.setFile(e.target.files[0]));
        this.compressBtn.addEventListener('click', () => this.compress());
        this.clearBtn.addEventListener('click', () => this.clearAll());
    },

    setupDragDrop(zone, input) {
        zone.addEventListener('click', () => input.click());
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                this.setFile(e.dataTransfer.files[0]);
            }
        });
    },

    setFile(file) {
        if (!file) return;
        if (file.type !== 'application/pdf' && getFileExtension(file.name) !== 'pdf') {
            alert('请选择 PDF 文件');
            return;
        }
        this.file = file;
        this.renderFileList();
        this.updateButtons();
    },

    renderFileList() {
        if (!this.file) {
            this.fileList.innerHTML = '';
            return;
        }
        this.fileList.innerHTML = `
            <div class="file-item">
                <span class="file-item-icon">??</span>
                <div class="file-item-info">
                    <div class="file-item-name">${this.file.name}</div>
                    <div class="file-item-size">${formatSize(this.file.size)}</div>
                </div>
                <button class="file-item-remove">?</button>
            </div>
        `;
        this.fileList.querySelector('.file-item-remove').addEventListener('click', () => this.clearAll());
    },

    updateButtons() {
        this.compressBtn.disabled = !this.file;
        this.clearBtn.disabled = !this.file;
    },

    clearAll() {
        this.file = null;
        this.renderFileList();
        this.updateButtons();
        this.result.hidden = true;
        this.progress.hidden = true;
        this.input.value = '';
    },

    getLevel() {
        const selected = document.querySelector('input[name="compress-level"]:checked');
        return selected ? selected.value : 'medium';
    },

    async compress() {
        if (!this.file) return;

        this.result.hidden = true;
        this.progress.hidden = false;
        this.progressFill.style.width = '0%';
        this.compressBtn.disabled = true;

        try {
            this.progressText.textContent = '正在读取文件...';
            this.progressFill.style.width = '20%';
            const bytes = await readFileAsArrayBuffer(this.file);

            this.progressText.textContent = '正在加载 PDF...';
            this.progressFill.style.width = '40%';
            const pdfDoc = await PDFLib.PDFDocument.load(bytes, {
                ignoreEncryption: true,
            });

            this.progressText.textContent = '正在优化内容...';
            this.progressFill.style.width = '60%';

            // 根据压缩级别决定参数
            const level = this.getLevel();
            let objectsPerTick;
            switch (level) {
                case 'low':
                    objectsPerTick = 200;
                    break;
                case 'medium':
                    objectsPerTick = 100;
                    break;
                case 'high':
                    objectsPerTick = 50;
                    break;
                default:
                    objectsPerTick = 100;
            }

            this.progressText.textContent = '正在保存压缩版本...';
            this.progressFill.style.width = '80%';

            const compressedBytes = await pdfDoc.save({
                objectsPerTick: objectsPerTick,
                useObjectStreams: true,
                addDefaultPage: false,
            });

            this.progressText.textContent = '完成！';
            this.progressFill.style.width = '100%';

            const blob = new Blob([compressedBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            this.downloadBtn.href = url;

            const originalSize = this.file.size;
            const compressedSize = blob.size;
            const saving = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
            this.resultMeta.textContent =
                `${formatSize(originalSize)} → ${formatSize(compressedSize)} · 节省了 ${saving}%`;
            this.result.hidden = false;

            setTimeout(() => this.progress.hidden = true, 500);
        } catch (err) {
            console.error(err);
            alert('压缩失败: ' + err.message);
            this.progress.hidden = true;
        } finally {
            this.compressBtn.disabled = false;
        }
    },
};


/* ==========================================
   功能 3: PDF 转图片
   ========================================== */
const convertModule = {
    file: null,
    imageDataUrls: [],

    init() {
        this.dropzone = document.getElementById('convert-dropzone');
        this.input = document.getElementById('convert-input');
        this.fileList = document.getElementById('convert-file-list');
        this.convertBtn = document.getElementById('convert-btn');
        this.clearBtn = document.getElementById('convert-clear-btn');
        this.progress = document.getElementById('convert-progress');
        this.progressFill = document.getElementById('convert-progress-fill');
        this.progressText = document.getElementById('convert-progress-text');
        this.result = document.getElementById('convert-result');
        this.resultMeta = document.getElementById('convert-result-meta');
        this.gallery = document.getElementById('convert-gallery');
        this.downloadAllBtn = document.getElementById('convert-download-all');

        this.setupDragDrop(this.dropzone, this.input);
        this.input.addEventListener('change', (e) => this.setFile(e.target.files[0]));
        this.convertBtn.addEventListener('click', () => this.convert());
        this.clearBtn.addEventListener('click', () => this.clearAll());
        this.downloadAllBtn.addEventListener('click', () => this.downloadAll());
    },

    setupDragDrop(zone, input) {
        zone.addEventListener('click', () => input.click());
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                this.setFile(e.dataTransfer.files[0]);
            }
        });
    },

    setFile(file) {
        if (!file) return;
        if (file.type !== 'application/pdf' && getFileExtension(file.name) !== 'pdf') {
            alert('请选择 PDF 文件');
            return;
        }
        this.file = file;
        this.renderFileList();
        this.updateButtons();
    },

    renderFileList() {
        if (!this.file) {
            this.fileList.innerHTML = '';
            return;
        }
        this.fileList.innerHTML = `
            <div class="file-item">
                <span class="file-item-icon">??</span>
                <div class="file-item-info">
                    <div class="file-item-name">${this.file.name}</div>
                    <div class="file-item-size">${formatSize(this.file.size)}</div>
                </div>
                <button class="file-item-remove">?</button>
            </div>
        `;
        this.fileList.querySelector('.file-item-remove').addEventListener('click', () => this.clearAll());
    },

    updateButtons() {
        this.convertBtn.disabled = !this.file;
        this.clearBtn.disabled = !this.file;
    },

    clearAll() {
        this.file = null;
        this.imageDataUrls = [];
        this.renderFileList();
        this.updateButtons();
        this.result.hidden = true;
        this.progress.hidden = true;
        this.gallery.innerHTML = '';
        this.input.value = '';
    },

    async convert() {
        if (!this.file) return;

        this.result.hidden = true;
        this.gallery.innerHTML = '';
        this.imageDataUrls = [];
        this.progress.hidden = false;
        this.progressFill.style.width = '0%';
        this.convertBtn.disabled = true;

        try {
            this.progressText.textContent = '正在读取 PDF...';
            this.progressFill.style.width = '10%';
            const bytes = await readFileAsArrayBuffer(this.file);

            this.progressText.textContent = '正在解析 PDF...';
            this.progressFill.style.width = '20%';
            const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
            const totalPages = pdf.numPages;

            this.progressFill.style.width = '30%';

            for (let i = 1; i <= totalPages; i++) {
                this.progressText.textContent = `正在转换第 ${i}/${totalPages} 页...`;
                const pct = 30 + ((i - 1) / totalPages) * 60;
                this.progressFill.style.width = `${pct}%`;

                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2.0 }); // 2x 高清

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // 白色背景
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                await page.render({ canvasContext: ctx, viewport }).promise;

                const dataUrl = canvas.toDataURL('image/png');
                this.imageDataUrls.push(dataUrl);
            }

            this.progressFill.style.width = '100%';
            this.progressText.textContent = `转换完成！共 ${totalPages} 页`;

            this.resultMeta.textContent = `${this.file.name} · 共 ${totalPages} 页 · 每页为 PNG 图片`;
            this.result.hidden = false;

            // 渲染预览
            this.gallery.innerHTML = this.imageDataUrls.map((url, i) => `
                <div class="preview-item">
                    <img src="${url}" alt="第 ${i + 1} 页" loading="lazy">
                    <div class="preview-label">第 ${i + 1} 页</div>
                </div>
            `).join('');

            setTimeout(() => this.progress.hidden = true, 500);
        } catch (err) {
            console.error(err);
            alert('转换失败: ' + err.message);
            this.progress.hidden = true;
        } finally {
            this.convertBtn.disabled = false;
        }
    },

    async downloadAll() {
        if (this.imageDataUrls.length === 0) return;

        try {
            let downloadingText = this.downloadAllBtn.innerHTML;
            this.downloadAllBtn.innerHTML = '? 打包中...';
            this.downloadAllBtn.disabled = true;

            if (this.imageDataUrls.length === 1) {
                // 单张直接下载
                const link = document.createElement('a');
                link.download = this.file.name.replace('.pdf', '_page1.png');
                link.href = this.imageDataUrls[0];
                link.click();
            } else {
                // 多张打包 ZIP
                const zip = new JSZip();
                for (let i = 0; i < this.imageDataUrls.length; i++) {
                    const base64 = this.imageDataUrls[i].split(',')[1];
                    zip.file(`${this.file.name.replace('.pdf', '')}_page${i + 1}.png`, base64, { base64: true });
                }
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const link = document.createElement('a');
                link.download = this.file.name.replace('.pdf', '_images.zip');
                link.href = URL.createObjectURL(zipBlob);
                link.click();
            }

            this.downloadAllBtn.innerHTML = downloadingText;
            this.downloadAllBtn.disabled = false;
        } catch (err) {
            console.error(err);
            alert('下载失败: ' + err.message);
            this.downloadAllBtn.disabled = false;
        }
    },
};



/* ==========================================
   功能 4: 图片格式转换
   ========================================== */
const imageConvertModule = {
    files: [],
    convertedBlobs: [],

    init() {
        this.dropzone = document.getElementById('imgconvert-dropzone');
        this.input = document.getElementById('imgconvert-input');
        this.fileList = document.getElementById('imgconvert-file-list');
        this.convertBtn = document.getElementById('imgconvert-btn');
        this.clearBtn = document.getElementById('imgconvert-clear-btn');
        this.progress = document.getElementById('imgconvert-progress');
        this.progressFill = document.getElementById('imgconvert-progress-fill');
        this.progressText = document.getElementById('imgconvert-progress-text');
        this.result = document.getElementById('imgconvert-result');
        this.resultMeta = document.getElementById('imgconvert-result-meta');
        this.gallery = document.getElementById('imgconvert-gallery');
        this.downloadAllBtn = document.getElementById('imgconvert-download-all');
        this.qualitySlider = document.getElementById('imgconvert-quality');
        this.qualityVal = document.getElementById('imgconvert-quality-val');

        this.setupDragDrop(this.dropzone, this.input);
        this.input.addEventListener('change', (e) => this.addFiles(e.target.files));
        this.convertBtn.addEventListener('click', () => this.convert());
        this.clearBtn.addEventListener('click', () => this.clearAll());
        this.downloadAllBtn.addEventListener('click', () => this.downloadAll());
        this.qualitySlider.addEventListener('input', () => {
            this.qualityVal.textContent = this.qualitySlider.value;
        });
    },

    setupDragDrop(zone, input) {
        zone.addEventListener('click', () => input.click());
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            this.addFiles(e.dataTransfer.files);
        });
    },

    addFiles(fileList) {
        const validFiles = [];
        for (const file of fileList) {
            if (file.type.startsWith('image/')) {
                if (!this.files.some(f => f.name === file.name && f.size === file.size)) {
                    validFiles.push(file);
                }
            }
        }
        this.files = [...this.files, ...validFiles];
        // Create thumbnail URLs for new files
        if (!this.thumbnails) this.thumbnails = {};
        for (const file of validFiles) {
            this.thumbnails[file.name + '_' + file.size] = URL.createObjectURL(file);
        }
        this.renderFileList();
        this.updateButtons();
    },

    removeFile(index) {
        this.files.splice(index, 1);
        this.renderFileList();
        this.updateButtons();
    },

    renderFileList() {
        if (this.files.length === 0) {
            this.fileList.innerHTML = '';
            return;
        }
        if (!this.thumbnails) this.thumbnails = {};
        this.fileList.innerHTML = this.files.map((f, i) => `
            <div class="file-item file-item-img">
                <div class="file-item-thumb">
                    <img src="${this.thumbnails[f.name + '_' + f.size] || ''}" alt="">
                </div>
                <div class="file-item-info">
                    <div class="file-item-name">${f.name}</div>
                    <div class="file-item-size">${formatSize(f.size)}</div>
                </div>
                <button class="file-item-remove" data-index="${i}">✖</button>
            </div>
        `).join('');
        this.fileList.querySelectorAll('.file-item-remove').forEach(btn => {
            btn.addEventListener('click', () => this.removeFile(parseInt(btn.dataset.index)));
        });
    },

    updateButtons() {
        this.convertBtn.disabled = this.files.length === 0;
        this.clearBtn.disabled = this.files.length === 0;
    },

    clearAll() {
        // Revoke thumbnail URLs
        if (this.thumbnails) {
            Object.values(this.thumbnails).forEach(url => URL.revokeObjectURL(url));
            this.thumbnails = {};
        }
        this.files = [];
        this.convertedBlobs = [];
        this.renderFileList();
        this.updateButtons();
        this.result.hidden = true;
        this.progress.hidden = true;
        this.gallery.innerHTML = '';
        this.input.value = '';
    },

    async convert() {
        if (this.files.length === 0) return;

        this.result.hidden = true;
        this.gallery.innerHTML = '';
        this.convertedBlobs = [];
        this.progress.hidden = false;
        this.progressFill.style.width = '0%';
        this.convertBtn.disabled = true;

        const format = document.querySelector('input[name="imgformat"]:checked').value;
        const scale = parseFloat(document.querySelector('input[name="imgscale"]:checked').value);
        const quality = parseInt(this.qualitySlider.value) / 100;

        try {
            const total = this.files.length;

            for (let i = 0; i < total; i++) {
                this.progressText.textContent = "正在转换 " + (i + 1) + "/" + total + "...";
                const pct = ((i) / total) * 90;
                this.progressFill.style.width = pct + "%";

                const blob = await this.convertImage(this.files[i], format, scale, quality);
                this.convertedBlobs.push(blob);
            }

            this.progressFill.style.width = '100%';
            this.progressText.textContent = "转换完成！共 " + total + " 个文件";
            this.resultMeta.textContent = total + " 个图片已转换";
            this.result.hidden = false;

            // Preview
            this.gallery.innerHTML = '';
            for (let i = 0; i < this.convertedBlobs.length; i++) {
                const url = URL.createObjectURL(this.convertedBlobs[i]);
                const item = document.createElement('div');
                item.className = 'preview-item';
                const img = document.createElement('img');
                img.src = url;
                img.alt = "输出 " + (i + 1);
                img.loading = 'lazy';
                const label = document.createElement('div');
                label.className = 'preview-label';
                label.textContent = this.files[i].name.replace(/\.[^.]+$/, '.' + format.split('/')[1]);
                item.appendChild(img);
                item.appendChild(label);
                this.gallery.appendChild(item);
            }

            setTimeout(() => this.progress.hidden = true, 500);
        } catch (err) {
            console.error(err);
            alert("转换失败: " + err.message);
            this.progress.hidden = true;
        } finally {
            this.convertBtn.disabled = false;
        }
    },

    convertImage(file, format, scale, quality) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const w = Math.round(img.naturalWidth * scale);
                const h = Math.round(img.naturalHeight * scale);
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');

                // Fill white background for JPEG (no alpha)
                if (format === 'image/jpeg') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, w, h);
                }
                ctx.drawImage(img, 0, 0, w, h);

                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("图片转换失败"));
                }, format, quality);
            };
            img.onerror = () => reject(new Error("无法加载图片: " + file.name));
            img.src = URL.createObjectURL(file);
        });
    },

    downloadBlob(blob, filename) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    },

    async downloadAll() {
        if (this.convertedBlobs.length === 0) return;

        try {
            this.downloadAllBtn.disabled = true;
            const format = document.querySelector('input[name="imgformat"]:checked').value;
            const ext = format.split('/')[1];

            if (this.convertedBlobs.length === 1) {
                const name = this.files[0].name.replace(/\.[^.]+$/, '.' + ext);
                this.downloadBlob(this.convertedBlobs[0], name);
            } else {
                const zip = new JSZip();
                for (let i = 0; i < this.convertedBlobs.length; i++) {
                    const name = this.files[i].name.replace(/\.[^.]+$/, '.' + ext);
                    zip.file(name, this.convertedBlobs[i]);
                }
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(zipBlob);
                link.download = "图片转换.zip";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (err) {
            console.error(err);
            alert("下载失败: " + err.message);
        } finally {
            this.downloadAllBtn.disabled = false;
        }
    }
};

/* ==========================================
   初始化
   ========================================== */
document.addEventListener('DOMContentLoaded', () => {
    mergeModule.init();
    compressModule.init();
    convertModule.init();
    imageConvertModule.init();
});
