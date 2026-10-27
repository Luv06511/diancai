#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
点菜 App 的本地小服务。

用法：
    python serve.py            # 默认 8000 端口
    python serve.py 8080       # 指定端口
    python serve.py --open     # 顺便在电脑上打浏览器

手机和电脑连同一个 WiFi，用打印出来的地址打开就行。
"""
import http.server
import os
import socket
import socketserver
import sys
import threading
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
except Exception:
    pass


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # 改完文件刷新就能看到，不用清缓存
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def log_message(self, *args):
        pass


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        return s.getsockname()[0]
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return '127.0.0.1'
    finally:
        s.close()


def print_qr(url):
    try:
        import segno  # pip install segno
    except Exception:
        return
    try:
        segno.make(url, error='m').terminal(compact=True)
    except Exception:
        pass


def is_our_app(port):
    """这个端口上跑的是不是已经开着的「点菜」"""
    import urllib.request
    try:
        with urllib.request.urlopen('http://127.0.0.1:%d/' % port, timeout=1.2) as r:
            body = r.read(4096).decode('utf-8', 'replace')
            return '私人菜单' in body
    except Exception:
        return False


def main():
    args = [a for a in sys.argv[1:]]
    port = 8000
    for a in args:
        if a.isdigit():
            port = int(a)
    open_browser = '--open' in args or '-o' in args

    httpd = None
    for p in range(port, port + 20):
        try:
            httpd = socketserver.ThreadingTCPServer(('0.0.0.0', p), Handler)
            port = p
            break
        except OSError:
            if is_our_app(p):
                print('')
                print('  %d 端口上已经开着一个「点菜」了，直接用就行：' % p)
                print('')
                print('   这台电脑：  http://localhost:%d/' % p)
                print('   手机打开：  http://%s:%d/' % (lan_ip(), p))
                print('')
                if open_browser:
                    webbrowser.open('http://localhost:%d/' % p)
                return
            continue

    if httpd is None:
        print('端口都被占用了，换一个试试：python serve.py 9000')
        return
    httpd.daemon_threads = True

    ip = lan_ip()
    url = 'http://%s:%d/' % (ip, port)

    print('')
    print('  ==========================================')
    print('   点菜 · 私人菜单  已经开好了')
    print('  ==========================================')
    print('')
    print('   这台电脑打开：  http://localhost:%d/' % port)
    print('   手机打开：      %s' % url)
    print('')
    print('   手机要和电脑连同一个 WiFi。第一次打开没反应，')
    print('   大概率是 Windows 防火墙拦了 —— 允许一下就行。')
    print('')
    print_qr(url)
    print('')
    print('   这个窗口别关；按 Ctrl+C 停止。')
    print('')

    if open_browser:
        threading.Timer(0.8, lambda: webbrowser.open('http://localhost:%d/' % port)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n  已停止。')


if __name__ == '__main__':
    main()
