# PDF 工具箱 - 桌面版
# 依赖: pip install pywebview

import http.server
import os
import threading
import sys
import pathlib

PORT = 18080

class Handler(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        mime = super().guess_type(path)
        ext = os.path.splitext(path)[1].lower()
        if ext in ('.html', '.css', '.js'):
            return mime + '; charset=utf-8'
        return mime

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def log_message(self, format, *args):
        pass

def start_server():
    os.chdir(pathlib.Path(__file__).parent)
    server = http.server.HTTPServer(('127.0.0.1', PORT), Handler)
    server.serve_forever()

def main():
    t = threading.Thread(target=start_server, daemon=True)
    t.start()

    try:
        import webview
        # 创建窗口
        webview.create_window(
            title='PDF 工具箱',
            url=f'http://127.0.0.1:{PORT}/',
            width=1000,
            height=750,
            min_size=(800, 600),
            resizable=True,
            text_select=True,
        )
        # 启动窗口（阻塞，直到关闭）
        webview.start()
    except ImportError:
        print("请先安装 pywebview: pip install pywebview")
        sys.exit(1)
    except Exception as e:
        print(f"启动失败: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
