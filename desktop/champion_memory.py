"""Experimental, bounded memory samples; never an authoritative account roster."""
import ctypes
from ctypes import wintypes
import hashlib
from pathlib import Path
import struct
import time
import re

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


def decode_hero_record(address, read, class_name, pointer, managed_string):
    if class_name(address) != 'Hero':
        return None
    hero = read(address, 0x38)
    if not hero:
        return None
    hero_id, type_id, rank, level = struct.unpack_from('<4i', hero, 0x18)
    type_address = struct.unpack_from('<Q', hero, 0x10)[0]
    if not valid_hero_fields(hero_id, type_id, rank, level):
        return None
    name = None
    if type_address:
        if class_name(type_address) != 'HeroType':
            return None
        type_header = read(type_address, 0x28)
        if not type_header or struct.unpack_from('<i', type_header, 0x10)[0] != type_id:
            return None
        name_key = struct.unpack_from('<Q', type_header, 0x18)[0]
        name = managed_string(pointer(name_key + 0x18)) if class_name(name_key) == 'SharedLTextKey' else None
    return {'id': hero_id, 'type_id': type_id, 'rank': rank, 'level': level, 'name': name,
            'locked': bool(hero[0x34]), 'in_storage': bool(hero[0x35]), 'in_reserve': bool(hero[0x36])}


def inspect_champion_samples(progress=lambda message: None, limit=24, roster=False, gear=False):
    if roster and gear:
        raise ValueError('Choose one inspection mode')
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
        runtime_name = b'UpdatableArtifactData' if gear else b'UpdatableHeroData' if roster else b'Hero'
        namespace = 'Client.Model.Gameplay.Artifacts.Data' if gear else 'Client.Model.Gameplay.Heroes.Data' if roster else 'SharedModel.Meta.Heroes'
        name_index = metadata[string_start:string_start + string_size].find(b'\0' + runtime_name + b'\0')
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
        type_targets = {target: namespace}
        if gear:
            base_index = metadata[string_start:string_start + string_size].find(b'\0UserArtifactData\0')
            if base_index >= 0:
                type_targets[struct.pack('<Q', metadata_base + string_start + base_index + 1)] = 'SharedModel.Meta.Artifacts'
            cache_index = metadata[string_start:string_start + string_size].find(b'\0CachedArtifacts\0')
            if cache_index >= 0:
                type_targets[struct.pack('<Q', metadata_base + string_start + cache_index + 1)] = 'Client.Model.Gameplay.Artifacts'
        champion_class = None
        runtime_classes = set()
        for base, data in scan():
            for type_target, type_namespace in type_targets.items():
                found = data.find(type_target)
                while found >= 0:
                    address = base + found - 0x10
                    if address % 8 == 0 and ascii_text(pointer(address + 0x18)) == type_namespace:
                        champion_class = address
                        runtime_classes.add(address)
                    found = data.find(type_target, found + 1)
            if champion_class and not gear:
                break
        if not champion_class:
            result.update(status='samples_unavailable', reason='The champion runtime type was not found within the scan limit')
            return result
        def decode_hero(address):
            return decode_hero_record(address, read, class_name, pointer, managed_string)

        if gear:
            progress('Reading artifact list candidates; account membership remains unverified…')
            target = struct.pack('<Q', champion_class)
            object_pattern = re.compile(b'|'.join(re.escape(struct.pack('<Q', address)) for address in runtime_classes))
            matches = {}
            rejected = []
            visited = set()
            for base, data in scan():
                for match in object_pattern.finditer(data):
                    address = base + match.start()
                    if address % 8 or address in visited:
                        continue
                    visited.add(address)
                    cached = class_name(address) == 'CachedArtifacts'
                    items = pointer(address + (0x18 if cached else 0x28))
                    if class_name(items) != ('Dictionary`2' if cached else 'List`1'):
                        continue
                    header = read(items, 0x30 if cached else 0x28)
                    if not header:
                        continue
                    array = struct.unpack_from('<Q', header, 0x18 if cached else 0x10)[0]
                    count = struct.unpack_from('<i', header, 0x20 if cached else 0x18)[0]
                    free_count = struct.unpack_from('<i', header, 0x28)[0] if cached else 0
                    array_header = read(array, 0x20)
                    capacity = struct.unpack_from('<Q', array_header, 0x18)[0] if array_header else 0
                    if not 0 < count <= capacity <= 20000 or not 0 <= free_count < count:
                        continue
                    stride = 24 if cached else 8
                    raw = read(array + 0x20, count * stride)
                    if raw is None:
                        continue
                    artifacts = []
                    ids = set()
                    snapshots = []
                    for index in range(count):
                        if cached and struct.unpack_from('<i', raw, index * stride)[0] < 0:
                            continue
                        artifact = struct.unpack_from('<Q', raw, index * stride + (16 if cached else 0))[0]
                        if class_name(artifact) != 'Artifact':
                            break
                        fields = read(artifact, 0x90)
                        if not fields:
                            break
                        artifact_id = struct.unpack_from('<i', fields, 0x10)[0]
                        if cached and artifact_id != struct.unpack_from('<i', raw, index * stride + 8)[0]:
                            break
                        level = struct.unpack_from('<i', fields, 0x30)[0]
                        kind, variant, rank, rarity = struct.unpack_from('<4i', fields, 0x40)
                        if not 0 < artifact_id < 100000000 or artifact_id in ids or not 0 <= level <= 16 or not 1 <= kind <= 9 or not 1 <= rank <= 6 or not 1 <= rarity <= 6:
                            if len(rejected) < 3:
                                rejected.append({'index': index, 'id': artifact_id, 'level': level, 'kind': kind, 'rank': rank, 'rarity': rarity})
                            break
                        ids.add(artifact_id)
                        snapshots.append((artifact, fields))
                        artifacts.append({'id': artifact_id, 'level': level, 'kind_id': kind, 'variant_id': variant, 'rank': rank,
                                          'rarity_id': rarity, 'set_id': struct.unpack_from('<i', fields, 0x68)[0]})
                    if len(artifacts) != count - free_count or header != read(items, len(header)) or raw != read(array + 0x20, len(raw)):
                        continue
                    if any(fields != read(artifact, 0x90) for artifact, fields in snapshots):
                        continue
                    ordered = sorted(artifacts, key=lambda artifact: artifact['id'])
                    matches[tuple((a['id'], a['level'], a['rank']) for a in ordered)] = ordered
            result.update(status='gear_candidates_read' if matches else 'gear_unavailable',
                          gear_candidates=list(matches.values()), gear_verified=False,
                          rejected_artifacts=rejected,
                          reason='Stable artifact list candidates only. Account identity, equipped links and bonus stats remain unverified; nothing is synced.')
            return result

        if roster:
            progress('Reading complete roster dictionaries and checking for changes…')
            matches = {}
            rejected = {}
            def reject(reason):
                rejected[reason] = rejected.get(reason, 0) + 1
            target = struct.pack('<Q', champion_class)
            visited = set()
            for base, data in scan():
                found = data.find(target)
                while found >= 0:
                    address = base + found
                    found = data.find(target, found + 1)
                    if address % 8 or address in visited:
                        continue
                    visited.add(address)
                    dictionary = pointer(address + 0x18)
                    if class_name(dictionary) != 'Dictionary`2':
                        continue
                    header = read(dictionary, 0x30)
                    if not header:
                        continue
                    entries = struct.unpack_from('<Q', header, 0x18)[0]
                    count, _, free_count, _ = struct.unpack_from('<4i', header, 0x20)
                    array_header = read(entries, 0x20)
                    capacity = struct.unpack_from('<Q', array_header, 0x18)[0] if array_header else 0
                    if not 0 < count <= capacity <= 10000 or not 0 <= free_count < count:
                        reject('invalid_dictionary_bounds')
                        continue
                    raw = read(entries + 0x20, count * 24)
                    if raw is None:
                        continue
                    records = []
                    ids = set()
                    valid = True
                    for index in range(count):
                        entry_hash, _, key = struct.unpack_from('<3i', raw, index * 24)
                        if entry_hash < 0:
                            continue
                        hero = decode_hero(struct.unpack_from('<Q', raw, index * 24 + 16)[0])
                        if not hero or hero['id'] != key or key in ids:
                            reject('invalid_hero_or_dictionary_key')
                            invalid_address = struct.unpack_from('<Q', raw, index * 24 + 16)[0]
                            invalid = read(invalid_address, 0x38)
                            result['rejected_entry'] = {'index': index, 'key': key, 'class': class_name(invalid_address),
                                                       'hero_fields': list(struct.unpack_from('<4i', invalid, 0x18)) if invalid else None,
                                                       'type_class': class_name(pointer(invalid_address + 0x10)),
                                                       'type_cache_present': bool(pointer(invalid_address + 0x10))}
                            valid = False
                            break
                        ids.add(key)
                        records.append(hero)
                    if not valid or len(records) != count - free_count:
                        if valid:
                            reject('active_entry_count_mismatch')
                        continue
                    # Reject snapshots changed while being read. Repeat field reads too.
                    if header != read(dictionary, 0x30) or raw != read(entries + 0x20, count * 24):
                        reject('dictionary_changed_during_read')
                        continue
                    if any(decode_hero(struct.unpack_from('<Q', raw, index * 24 + 16)[0]) != next((h for h in records if h['id'] == struct.unpack_from('<i', raw, index * 24 + 8)[0]), None)
                           for index in range(count) if struct.unpack_from('<i', raw, index * 24)[0] >= 0):
                        reject('hero_changed_during_read')
                        continue
                    ordered = sorted(records, key=lambda hero: hero['id'])
                    signature = tuple((h['id'], h['type_id'], h['rank'], h['level']) for h in ordered)
                    matches[signature] = ordered
            result.update(status='roster_candidates_read' if matches else 'roster_unavailable',
                          roster_candidates=list(matches.values()), dictionary_structure_verified=bool(matches),
                          rejected_candidates=rejected,
                          reason='Complete, stable dictionary snapshots only. Active account identity and final stats remain unverified; nothing is synced.')
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
