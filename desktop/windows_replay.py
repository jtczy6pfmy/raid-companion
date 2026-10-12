"""Foreground-only Win32 screen capture and calibrated replay input."""
import ctypes
from ctypes import wintypes
import hashlib
from pathlib import Path
import sys
from replay_profile import patch_bytes, matches


class WindowsReplay:
    def __init__(self, profile=None):
        if sys.platform != 'win32': raise RuntimeError('Windows is required for native replay')
        self.user = ctypes.WinDLL('user32', use_last_error=True)
        self.kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        self.gdi = ctypes.WinDLL('gdi32', use_last_error=True)
        u, k, g = self.user, self.kernel, self.gdi
        u.GetForegroundWindow.restype = wintypes.HWND
        u.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
        u.GetClientRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
        u.ClientToScreen.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.POINT)]
        u.GetAsyncKeyState.argtypes = [ctypes.c_int]
        u.GetAsyncKeyState.restype = ctypes.c_short
        u.GetDC.argtypes = [wintypes.HWND]; u.GetDC.restype = wintypes.HDC
        u.ReleaseDC.argtypes = [wintypes.HWND, wintypes.HDC]
        k.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        k.OpenProcess.restype = wintypes.HANDLE
        k.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
        k.CloseHandle.argtypes = [wintypes.HANDLE]
        g.CreateCompatibleDC.argtypes = [wintypes.HDC]; g.CreateCompatibleDC.restype = wintypes.HDC
        g.CreateDIBSection.argtypes = [wintypes.HDC, ctypes.c_void_p, wintypes.UINT, ctypes.POINTER(ctypes.c_void_p), wintypes.HANDLE, wintypes.DWORD]
        g.CreateDIBSection.restype = wintypes.HBITMAP
        g.SelectObject.argtypes = [wintypes.HDC, wintypes.HANDLE]; g.SelectObject.restype = wintypes.HANDLE
        g.BitBlt.argtypes = [wintypes.HDC, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.HDC, ctypes.c_int, ctypes.c_int, wintypes.DWORD]
        g.DeleteObject.argtypes = [wintypes.HANDLE]; g.DeleteDC.argtypes = [wintypes.HDC]
        try:
            u.SetProcessDpiAwarenessContext.argtypes = [ctypes.c_void_p]
            u.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))
        except AttributeError: raise RuntimeError('Windows 10 or later is required')
        self.hwnd = u.GetForegroundWindow()
        pid = wintypes.DWORD()
        u.GetWindowThreadProcessId(self.hwnd, ctypes.byref(pid))
        self.pid = pid.value
        handle = k.OpenProcess(0x1000, False, self.pid)
        if not handle: raise RuntimeError('Cannot identify the foreground process')
        try:
            path = ctypes.create_unicode_buffer(32768); length = wintypes.DWORD(len(path))
            if not k.QueryFullProcessImageNameW(handle, 0, path, ctypes.byref(length)):
                raise RuntimeError('Cannot verify foreground executable')
            self.executable = Path(path.value)
        finally: k.CloseHandle(handle)
        if self.executable.name.lower() != 'raid.exe':
            raise RuntimeError('Put the RAID game window in the foreground during the countdown')
        self.size = self.client_size()
        self.profile = profile
        with self.executable.open('rb') as file:
            self.fingerprint = hashlib.file_digest(file, 'sha256').hexdigest()
        if profile and (profile['client_size'] != self.size or profile['executable_sha256'] != self.fingerprint):
            raise RuntimeError('Game geometry or executable changed; recalibrate before replay')
        self.pixels = {name: {key: patch_bytes(state[key], self.size) for key in ('patch', 'replay_patch') if key in state}
                       for name, state in (profile or {}).get('states', {}).items()}

    def client_size(self):
        rect = wintypes.RECT()
        if not self.user.GetClientRect(self.hwnd, ctypes.byref(rect)): raise RuntimeError('Game window unavailable')
        return [rect.right - rect.left, rect.bottom - rect.top]

    def ready(self):
        if self.user.GetForegroundWindow() != self.hwnd: return False
        pid = wintypes.DWORD(); self.user.GetWindowThreadProcessId(self.hwnd, ctypes.byref(pid))
        try: return pid.value == self.pid and self.client_size() == self.size
        except RuntimeError: return False

    def stop_requested(self):
        return bool(self.user.GetAsyncKeyState(0x1B) & 0x8000)  # Escape

    def capture(self, region):
        if not self.ready(): raise RuntimeError('RAID must remain in the foreground at its calibrated size')
        x, y, width, height = region
        if not 0 <= x < self.size[0] or not 0 <= y < self.size[1] or width < 4 or height < 4 or width > 1024 or height > 1024 or x + width > self.size[0] or y + height > self.size[1]:
            raise ValueError('Capture region must fit inside the game client')
        class Header(ctypes.Structure):
            _fields_ = [('size', wintypes.DWORD), ('width', wintypes.LONG), ('height', wintypes.LONG),
                        ('planes', wintypes.WORD), ('bits', wintypes.WORD), ('compression', wintypes.DWORD),
                        ('image_size', wintypes.DWORD), ('xppm', wintypes.LONG), ('yppm', wintypes.LONG),
                        ('colors', wintypes.DWORD), ('important', wintypes.DWORD)]
        source = self.user.GetDC(self.hwnd)
        if not source: raise RuntimeError('Game capture unavailable')
        dest = self.gdi.CreateCompatibleDC(source); bitmap = None; old = None
        try:
            header = Header(ctypes.sizeof(Header), width, -height, 1, 32, 0, width*height*4, 0, 0, 0, 0)
            bits = ctypes.c_void_p()
            bitmap = self.gdi.CreateDIBSection(source, ctypes.byref(header), 0, ctypes.byref(bits), None, 0)
            if not dest or not bitmap or not bits.value: raise RuntimeError('Capture buffer allocation failed')
            old = self.gdi.SelectObject(dest, bitmap)
            if not old or old == ctypes.c_void_p(-1).value: raise RuntimeError('Capture bitmap selection failed')
            if not self.gdi.BitBlt(dest, 0, 0, width, height, source, x, y, 0x00CC0020):
                raise RuntimeError('Game capture failed')
            if not self.ready(): raise RuntimeError('Foreground changed during capture')
            raw = ctypes.string_at(bits, width*height*4)
            return bytes((77*raw[i+2] + 150*raw[i+1] + 29*raw[i]) >> 8 for i in range(0, len(raw), 4))
        finally:
            if old and old != ctypes.c_void_p(-1).value: self.gdi.SelectObject(dest, old)
            if bitmap: self.gdi.DeleteObject(bitmap)
            if dest: self.gdi.DeleteDC(dest)
            self.user.ReleaseDC(self.hwnd, source)

    def patch_matches(self, state, key):
        patch = self.profile['states'][state][key]
        return matches(self.capture(patch['region']), self.pixels[state][key], patch.get('tolerance', 4))

    def observe(self):
        states = [name for name in self.profile['states'] if self.patch_matches(name, 'patch')]
        if len(states) > 1: return 'Blocked'
        return states[0] if states else 'Unknown'

    def replay(self, result):
        if self.stop_requested() or not self.ready() or self.observe() != result or not self.patch_matches(result, 'replay_patch'):
            return False
        point = wintypes.POINT(*self.profile['states'][result]['replay_point'])
        if not self.user.ClientToScreen(self.hwnd, ctypes.byref(point)): return False
        class Mouse(ctypes.Structure):
            _fields_ = [('dx', wintypes.LONG), ('dy', wintypes.LONG), ('data', wintypes.DWORD),
                        ('flags', wintypes.DWORD), ('time', wintypes.DWORD), ('extra', ctypes.c_size_t)]
        class Union(ctypes.Union): _fields_ = [('mouse', Mouse)]
        class Input(ctypes.Structure): _fields_ = [('type', wintypes.DWORD), ('payload', Union)]
        u = self.user
        left, top, width, height = [u.GetSystemMetrics(n) for n in (76, 77, 78, 79)]
        if width <= 1 or height <= 1 or not left <= point.x < left+width or not top <= point.y < top+height: return False
        dx = round((point.x-left)*65535/(width-1)); dy = round((point.y-top)*65535/(height-1))
        events = (Input*3)()
        for i, flags in enumerate((0xC001, 0x0002, 0x0004)):
            events[i].type = 0; events[i].payload.mouse = Mouse(dx, dy, 0, flags, 0, 0)
        u.SendInput.argtypes = [wintypes.UINT, ctypes.POINTER(Input), ctypes.c_int]
        u.SendInput.restype = wintypes.UINT
        if self.stop_requested() or not self.ready(): return False
        sent = u.SendInput(3, events, ctypes.sizeof(Input))
        if sent == 2:
            release=Input();release.type=0;release.payload.mouse=Mouse(0,0,0,0x0004,0,0)
            u.SendInput(1,ctypes.byref(release),ctypes.sizeof(Input))
        if sent != 3: raise RuntimeError('Windows did not accept replay input; no retry or elevation attempted')
        return True
