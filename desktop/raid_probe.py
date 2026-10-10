"""Read-only Windows RAID connection probe. No game writes or account dumps."""
import argparse
import ctypes
from ctypes import wintypes
import json
from pathlib import Path
import struct
import sys


def probe():
    result = {"status": "unavailable", "champion_data_verified": False}
    if sys.platform != "win32":
        return {**result, "reason": "Windows is required"}
    if ctypes.sizeof(ctypes.c_void_p) != 8:
        return {**result, "reason": "64-bit Python is required for 64-bit RAID"}
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    class ProcessEntry(ctypes.Structure):
        _fields_ = [("dwSize", wintypes.DWORD), ("cntUsage", wintypes.DWORD),
                    ("th32ProcessID", wintypes.DWORD), ("th32DefaultHeapID", ctypes.c_size_t),
                    ("th32ModuleID", wintypes.DWORD), ("cntThreads", wintypes.DWORD),
                    ("th32ParentProcessID", wintypes.DWORD), ("pcPriClassBase", wintypes.LONG),
                    ("dwFlags", wintypes.DWORD), ("szExeFile", wintypes.WCHAR * 260)]
    kernel.CreateToolhelp32Snapshot.argtypes = [wintypes.DWORD, wintypes.DWORD]
    kernel.CreateToolhelp32Snapshot.restype = wintypes.HANDLE
    kernel.Process32FirstW.argtypes = [wintypes.HANDLE, ctypes.POINTER(ProcessEntry)]
    kernel.Process32NextW.argtypes = kernel.Process32FirstW.argtypes
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.K32EnumProcessModulesEx.argtypes = [wintypes.HANDLE, ctypes.POINTER(ctypes.c_void_p), wintypes.DWORD, ctypes.POINTER(wintypes.DWORD), wintypes.DWORD]
    kernel.K32GetModuleFileNameExW.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.LPWSTR, wintypes.DWORD]
    kernel.ReadProcessMemory.argtypes = [wintypes.HANDLE, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_size_t, ctypes.POINTER(ctypes.c_size_t)]
    snapshot = kernel.CreateToolhelp32Snapshot(2, 0)
    if snapshot == ctypes.c_void_p(-1).value:
        return {**result, "reason": "Process enumeration failed", "windows_error": ctypes.get_last_error()}
    processes = []
    try:
        entry = ProcessEntry()
        entry.dwSize = ctypes.sizeof(entry)
        more = kernel.Process32FirstW(snapshot, ctypes.byref(entry))
        while more:
            if entry.szExeFile.lower() == "raid.exe":
                processes.append(entry.th32ProcessID)
            more = kernel.Process32NextW(snapshot, ctypes.byref(entry))
    finally:
        kernel.CloseHandle(snapshot)
    if not processes:
        return {**result, "reason": "RAID is not running"}
    if len(processes) != 1:
        return {**result, "reason": "Multiple RAID processes found; close extra instances", "process_count": len(processes)}
    result["process_id"] = processes[0]
    # PROCESS_QUERY_INFORMATION | PROCESS_VM_READ; no write, injection or debug rights.
    handle = kernel.OpenProcess(0x0400 | 0x0010, False, processes[0])
    if not handle:
        return {**result, "reason": "Windows denied read access to RAID", "windows_error": ctypes.get_last_error()}
    try:
        modules = (ctypes.c_void_p * 2048)()
        needed = wintypes.DWORD()
        if not kernel.K32EnumProcessModulesEx(handle, modules, ctypes.sizeof(modules), ctypes.byref(needed), 3):
            return {**result, "reason": "Cannot enumerate RAID modules", "windows_error": ctypes.get_last_error()}
        if needed.value > ctypes.sizeof(modules):
            return {**result, "reason": "Module buffer too small"}
        inspected = []
        game_folder = None
        for base in modules[:needed.value // ctypes.sizeof(ctypes.c_void_p)]:
            name = ctypes.create_unicode_buffer(32768)
            if not kernel.K32GetModuleFileNameExW(handle, base, name, len(name)):
                continue
            filename = Path(name.value).name
            if filename.lower() not in ("raid.exe", "gameassembly.dll", "unityplayer.dll"):
                continue
            header = (ctypes.c_ubyte * 64)()
            count = ctypes.c_size_t()
            success = kernel.ReadProcessMemory(handle, base, header, 64, ctypes.byref(count))
            inspected.append({"module": filename, "header_read": bool(success and count.value == 64),
                              "valid_pe_signature": bool(success and bytes(header[:2]) == b"MZ")})
            if filename.lower() == "raid.exe":
                game_folder = Path(name.value).parent
        result["modules"] = inspected
        if game_folder:
            metadata = game_folder / "Raid_Data/il2cpp_data/Metadata/global-metadata.dat"
            if metadata.is_file():
                with metadata.open("rb") as source:
                    header = source.read(8)
                if len(header) == 8:
                    magic, version = struct.unpack("<II", header)
                    result["metadata"] = {"standard_magic": magic == 0xFAB11BAF, "version": version,
                                          "size_bytes": metadata.stat().st_size}
        verified = {item["module"].lower() for item in inspected if item["header_read"] and item["valid_pe_signature"]}
        result["status"] = "memory_access_verified" if {"raid.exe", "gameassembly.dll"}.issubset(verified) else "partial"
        result["reason"] = "Module headers only; champion schema and account object locations are not yet verified"
        return result
    finally:
        kernel.CloseHandle(handle)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Optional private diagnostic JSON path")
    args = parser.parse_args()
    try:
        data = probe()
    except (OSError, ValueError) as error:
        data = {"status": "unavailable", "champion_data_verified": False, "reason": str(error)}
    serialized = json.dumps(data, indent=2)
    print(serialized)
    if args.output:
        args.output.write_text(serialized + "\n", encoding="utf-8")
    sys.exit(0 if data["status"] == "memory_access_verified" else 1)
