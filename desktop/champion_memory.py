"""Experimental, bounded memory samples; never an authoritative account roster."""
import ctypes
from ctypes import wintypes
import hashlib
from pathlib import Path
import struct
import time

from raid_probe import probe

SUPPORTED_BINARY = 'a66241f0379d12fd8204084c03c3bf06292f2a0e3416fa5cb582889ddc40f414'
CHUNK_SIZE = 1024 * 1024
SCAN_LIMIT = 2 * 1024 ** 3
TIME_LIMIT = 100


class MemoryRegion(ctypes.Structure):
    _fields_ = [('base', ctypes.c_void_p), ('allocation', ctypes.c_void_p),
                ('allocation_protect', wintypes.DWORD), ('padding', wintypes.DWORD),
                ('size', ctypes.c_size_t), ('state', wintypes.DWORD),
                ('protect', wintypes.DWORD), ('kind', wintypes.DWORD), ('padding2', wintypes.DWORD)]


def valid_hero_fields(hero_id, type_id, rank, level):
    return 0 < hero_id < 100000000 and 0 < type_id < 10000000 and 1 <= rank <= 6 and 1 <= level <= rank * 10


def inspect_champion_samples(progress=lambda message: None, limit=24):
    if not 1 <= limit <= 100:
        raise ValueError('Sample limit must be between 1 and 100')
    result = probe()
    result.update(roster_verified=False, champion_data_verified=False, samples=[])
    if result['status'] != 'memory_access_verified':
        return result
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    psapi = ctypes.WinDLL('psapi', use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.ReadProcessMemory.argtypes = [wintypes.HANDLE, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_size_t, ctypes.POINTER(ctypes.c_size_t)]
    kernel.VirtualQueryEx.argtypes = [wintypes.HANDLE, ctypes.c_void_p, ctypes.POINTER(MemoryRegion), ctypes.c_size_t]
    kernel.VirtualQueryEx.restype = ctypes.c_size_t
    kernel.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
    psapi.GetMappedFileNameW.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.LPWSTR, wintypes.DWORD]
    handle = kernel.OpenProcess(0x410, False, result['process_id'])
    if not handle:
        result.update(status='unavailable', reason='Windows denied read access', windows_error=ctypes.get_last_error())
        return result

    def read(address, size):
        if not address or not 0 < size <= CHUNK_SIZE:
            return None
        buffer = (ctypes.c_ubyte * size)()
        received = ctypes.c_size_t()
        if not kernel.ReadProcessMemory(handle, address, buffer, size, ctypes.byref(received)) or received.value != size:
            return None
        return bytes(buffer)

    def pointer(address):
        data = read(address, 8)
        return struct.unpack('<Q', data)[0] if data else 0

    def ascii_text(address):
        data = read(address, 128)
        if not data or b'\0' not in data:
            return ''
        try:
            return data.split(b'\0', 1)[0].decode('ascii')
        except UnicodeDecodeError:
            return ''

    def class_name(address):
        return ascii_text(pointer(pointer(address) + 0x10))

    def managed_string(address):
        if class_name(address) != 'String':
            return None
        header = read(address, 0x14)
        length = struct.unpack_from('<i', header, 0x10)[0] if header else 0
        if not 1 <= length <= 256:
            return None
        data = read(address + 0x14, length * 2)
        if not data:
            return None
        try:
            text = data.decode('utf-16-le')
            return text if all(ord(char) >= 32 for char in text) else None
        except UnicodeDecodeError:
            return None

    try:
        image = ctypes.create_unicode_buffer(32768)
        image_length = wintypes.DWORD(len(image))
        if not kernel.QueryFullProcessImageNameW(handle, 0, image, ctypes.byref(image_length)):
            result.update(status='unavailable', reason='Could not locate the running game files')
            return result
        game = Path(image.value).parent
        progress('Checking the game build before reading champion fields…')
        with (game / 'GameAssembly.dll').open('rb') as source:
            binary_hash = hashlib.file_digest(source, 'sha256').hexdigest()
        if binary_hash != SUPPORTED_BINARY:
            result.update(status='unsupported_build', reason='This game build needs a reader update. No champion offsets were used.')
            return result
        metadata = (game / 'Raid_Data/il2cpp_data/Metadata/global-metadata.dat').read_bytes()
        if len(metadata) < 44 or struct.unpack_from('<II', metadata) != (0xFAB11BAF, 39):
            result.update(status='unsupported_build', reason='Unsupported metadata format')
            return result
        string_start, string_size, _ = struct.unpack_from('<III', metadata, 32)
        if string_start < 44 or string_start + string_size > len(metadata):
            result.update(status='unsupported_build', reason='Invalid metadata string section')
            return result
        name_index = metadata[string_start:string_start + string_size].find(b'\0Hero\0')
        if name_index < 0:
            result.update(status='unsupported_build', reason='Champion type name not found in metadata')
            return result
        regions = []
        position = 0
        metadata_base = 0
        while position < 0x7FFFFFFFFFFF:
            region = MemoryRegion()
            if not kernel.VirtualQueryEx(handle, position, ctypes.byref(region), ctypes.sizeof(region)):
                break
            end = (region.base or 0) + region.size
            if end <= position:
                break
            readable = region.state == 0x1000 and not region.protect & 0x100 and region.protect & 0xFF in (2, 4, 8, 0x20, 0x40, 0x80)
            if readable and region.kind == 0x40000:
                filename = ctypes.create_unicode_buffer(2048)
                if psapi.GetMappedFileNameW(handle, region.base, filename, len(filename)) and filename.value.lower().endswith('\\global-metadata.dat'):
                    metadata_base = region.allocation
            if readable and region.kind == 0x20000:
                regions.append((region.base, region.size))
            position = end
        if not metadata_base:
            result.update(status='samples_unavailable', reason='The loaded metadata mapping was not found')
            return result

        def scan():
            started = time.monotonic()
            scanned = 0
            for base, size in regions:
                for offset in range(0, size, CHUNK_SIZE - 256):
                    count = min(CHUNK_SIZE, size - offset)
                    if scanned + count > SCAN_LIMIT or time.monotonic() - started > TIME_LIMIT:
                        return
                    data = read(base + offset, count)
                    scanned += count
                    if data:
                        yield base + offset, data

        progress('Locating the champion type in memory…')
        target = struct.pack('<Q', metadata_base + string_start + name_index + 1)
        champion_class = None
        for base, data in scan():
            found = data.find(target)
            while found >= 0:
                address = base + found - 0x10
                if address % 8 == 0 and ascii_text(pointer(address + 0x18)) == 'SharedModel.Meta.Heroes':
                    champion_class = address
                    break
                found = data.find(target, found + 1)
            if champion_class:
                break
        if not champion_class:
            result.update(status='samples_unavailable', reason='The champion runtime type was not found within the scan limit')
            return result
        progress('Reading bounded champion samples. These are not a verified account roster…')
        target = struct.pack('<Q', champion_class)
        candidates = {}
        conflicts = set()
        seen_addresses = set()
        for base, data in scan():
            found = data.find(target)
            while found >= 0:
                address = base + found
                if address % 8 == 0 and address not in seen_addresses:
                    seen_addresses.add(address)
                    hero = read(address, 0x38)
                    if hero:
                        hero_id, type_id, rank, level = struct.unpack_from('<4i', hero, 0x18)
                        type_address = struct.unpack_from('<Q', hero, 0x10)[0]
                        if valid_hero_fields(hero_id, type_id, rank, level) and class_name(type_address) == 'HeroType':
                            type_header = read(type_address, 0x28)
                            if type_header and struct.unpack_from('<i', type_header, 0x10)[0] == type_id:
                                name_key = struct.unpack_from('<Q', type_header, 0x18)[0]
                                name = managed_string(pointer(name_key + 0x18)) if class_name(name_key) == 'SharedLTextKey' else None
                                sample = {'id': hero_id, 'type_id': type_id, 'rank': rank, 'level': level, 'name': name}
                                if hero_id in candidates and candidates[hero_id] != sample:
                                    conflicts.add(hero_id)
                                else:
                                    candidates[hero_id] = sample
                found = data.find(target, found + 1)
            if len(candidates) >= limit:
                break
        result['samples'] = [sample for key, sample in candidates.items() if key not in conflicts][:limit]
        result['status'] = 'memory_samples_read' if result['samples'] else 'samples_unavailable'
        result['reason'] = 'Samples may include stale or non-player objects. Active account membership and total stats are not verified.'
        return result
    finally:
        kernel.CloseHandle(handle)
