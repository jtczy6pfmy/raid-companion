"""Portable validation for explicitly calibrated RAID screen patches."""
import base64
import math
import zlib


def validate_profile(profile):
    if not isinstance(profile, dict) or profile.get('version') != 1:
        raise ValueError('Use a version 1 replay calibration')
    size = profile.get('client_size')
    if not isinstance(size, list) or len(size) != 2 or any(type(n) is not int or not 100 <= n <= 16384 for n in size):
        raise ValueError('Invalid game client size')
    fingerprint = profile.get('executable_sha256')
    if not isinstance(fingerprint, str) or len(fingerprint) != 64 or any(c not in '0123456789abcdef' for c in fingerprint):
        raise ValueError('Invalid executable fingerprint')
    states = profile.get('states')
    if not isinstance(states, dict) or not states or any(s not in ('Victory', 'Defeat', 'Running') for s in states):
        raise ValueError('Invalid calibrated states')
    for name, state in states.items():
        if not isinstance(state, dict): raise ValueError('Invalid state')
        patch_bytes(state['patch'], size)
        if name != 'Running':
            patch_bytes(state['replay_patch'], size)
            point = state.get('replay_point')
            if not isinstance(point, list) or len(point) != 2 or any(type(n) is not int for n in point):
                raise ValueError('Invalid replay point')
            x, y, width, height = state['replay_patch']['region']
            if not x <= point[0] < x + width or not y <= point[1] < y + height:
                raise ValueError('Replay point must be inside its calibrated button patch')
    return profile


def patch_bytes(patch, client_size):
    if not isinstance(patch, dict): raise ValueError('Invalid screen patch')
    region = patch.get('region')
    if not isinstance(region, list) or len(region) != 4 or any(type(n) is not int for n in region):
        raise ValueError('Invalid patch rectangle')
    x, y, width, height = region
    if x < 0 or y < 0 or not 4 <= width <= 1024 or not 4 <= height <= 1024 or x + width > client_size[0] or y + height > client_size[1]:
        raise ValueError('Patch must fit the calibrated game window')
    tolerance = patch.get('tolerance', 4)
    if isinstance(tolerance, bool) or not isinstance(tolerance, (float, int)) or not math.isfinite(tolerance) or not 0 <= tolerance <= 10:
        raise ValueError('Patch tolerance must be between 0 and 10')
    encoded = patch.get('pixels')
    if not isinstance(encoded, str) or len(encoded) > 2000000: raise ValueError('Invalid pixel payload')
    compressed = base64.b64decode(encoded, validate=True)
    decoder = zlib.decompressobj()
    pixels = decoder.decompress(compressed, width * height + 1)
    if len(pixels) != width * height or not decoder.eof or decoder.unused_data:
        raise ValueError('Pixel payload does not match rectangle')
    if max(pixels)-min(pixels)<15:
        raise ValueError('Choose a patch containing distinctive text or an icon, not a uniform background')
    return pixels


def make_patch(region, pixels, tolerance=4):
    return {'region': list(region), 'tolerance': tolerance,
            'pixels': base64.b64encode(zlib.compress(pixels)).decode('ascii')}


def matches(actual, expected, tolerance):
    if not actual or len(actual) != len(expected): return False
    differences=[abs(a-b) for a,b in zip(actual,expected)]
    return sum(differences)/len(actual)<=tolerance and sum(d>25 for d in differences)/len(actual)<=0.05
