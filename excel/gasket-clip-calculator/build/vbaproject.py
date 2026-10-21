"""Build a vbaProject.bin (MS-OVBA) from plain VBA source, without Excel.

The project stores source code only. `_VBA_PROJECT` carries version 0xFFFF,
so Office ignores the (absent) compiled cache and compiles the source on open.

Layout written:
    PROJECT, PROJECTwm, VBA/_VBA_PROJECT, VBA/dir, VBA/<module streams>
inside a version-3 compound file (MS-CFB).
"""
import random
import struct
import uuid

ENDOFCHAIN = 0xFFFFFFFE
FREESECT = 0xFFFFFFFF
FATSECT = 0xFFFFFFFD
NOSTREAM = 0xFFFFFFFF
SECTOR = 512
MINI_SECTOR = 64
MINI_CUTOFF = 4096


# ---------------------------------------------------------------- compression
def compress(data: bytes) -> bytes:
    """MS-OVBA 2.4.1 compression (CompressedContainer)."""
    out = bytearray(b"\x01")
    for start in range(0, len(data), 4096):
        chunk = data[start:start + 4096]
        body = _compress_chunk(chunk)
        if len(body) > 4096 - 2 and len(chunk) == 4096:
            # Raw chunk: only allowed for a full 4096-byte chunk.
            header = (4096 + 2 - 3) | (0b011 << 12)
            out += struct.pack("<H", header) + chunk
        else:
            header = ((len(body) + 2) - 3) | (0b011 << 12) | 0x8000
            out += struct.pack("<H", header) + body
    return bytes(out)


def _copy_token_help(pos: int):
    bit_count = max((pos - 1).bit_length(), 4)
    length_mask = 0xFFFF >> bit_count
    offset_mask = ~length_mask & 0xFFFF
    maximum_length = (0xFFFF >> bit_count) + 3
    return length_mask, offset_mask, bit_count, maximum_length


def _compress_chunk(chunk: bytes) -> bytes:
    out = bytearray()
    pos = 0
    n = len(chunk)
    seen = {}  # 3-byte prefix -> earlier positions, to find match candidates fast

    def remember(upto):
        for p in range(remember.done, upto):
            seen.setdefault(chunk[p:p + 3], []).append(p)
        remember.done = upto
    remember.done = 0

    while pos < n:
        flag_index = len(out)
        out.append(0)
        flags = 0
        for bit in range(8):
            if pos >= n:
                break
            best_len, best_off = 0, 0
            if pos > 0:
                _, _, bit_count, max_len = _copy_token_help(pos)
                limit = min(max_len, n - pos)
                for cand in reversed(seen.get(chunk[pos:pos + 3], [])[-256:]):
                    length = 0
                    while length < limit and chunk[cand + length] == chunk[pos + length]:
                        length += 1
                    if length > best_len:
                        best_len, best_off = length, pos - cand
                        if length == limit:
                            break
            if best_len >= 3:
                token = ((best_off - 1) << (16 - bit_count)) | (best_len - 3)
                out += struct.pack("<H", token)
                flags |= 1 << bit
                pos += best_len
            else:
                out.append(chunk[pos])
                pos += 1
            remember(pos)
        out[flag_index] = flags
    return bytes(out)


def decompress(data: bytes) -> bytes:
    """MS-OVBA 2.4.1 decompression (used by the self-test)."""
    assert data[0] == 1
    out = bytearray()
    i = 1
    while i < len(data):
        header = struct.unpack_from("<H", data, i)[0]
        size = (header & 0x0FFF) + 3
        compressed = header & 0x8000
        chunk_end = i + size
        i += 2
        start = len(out)
        if not compressed:
            out += data[i:i + 4096]
            i += 4096
            continue
        while i < chunk_end:
            flags = data[i]
            i += 1
            for bit in range(8):
                if i >= chunk_end:
                    break
                if flags & (1 << bit):
                    token = struct.unpack_from("<H", data, i)[0]
                    i += 2
                    lm, om, bc, _ = _copy_token_help(len(out) - start)
                    length = (token & lm) + 3
                    offset = ((token & om) >> (16 - bc)) + 1
                    for _ in range(length):
                        out.append(out[-offset])
                else:
                    out.append(data[i])
                    i += 1
    return bytes(out)


# ------------------------------------------------------------ data encryption
def encrypt(project_id: str, payload: bytes, seed: int) -> str:
    """MS-OVBA 2.4.3.2 data encryption, returned as the hex string PROJECT uses."""
    version = 2
    key = sum(project_id.encode("ascii")) & 0xFF
    version_enc = seed ^ version
    key_enc = seed ^ key
    out = [seed, version_enc, key_enc]
    unenc1, enc1, enc2 = key, key_enc, version_enc
    ignored = (seed & 6) // 2
    for _ in range(ignored):
        temp = 0
        b = temp ^ ((enc2 + unenc1) & 0xFF)
        out.append(b)
        enc2, enc1, unenc1 = enc1, b, temp
    for byte in struct.pack("<I", len(payload)) + payload:
        b = byte ^ ((enc2 + unenc1) & 0xFF)
        out.append(b)
        enc2, enc1, unenc1 = enc1, b, byte
    return "".join("%02X" % b for b in out)


def decrypt(project_id: str, hexstr: str) -> bytes:
    data = bytes.fromhex(hexstr)
    seed, version_enc, key_enc = data[0], data[1], data[2]
    assert seed ^ version_enc == 2
    key = seed ^ key_enc
    assert key == sum(project_id.encode("ascii")) & 0xFF
    unenc1, enc1, enc2 = key, key_enc, version_enc
    i = 3
    for _ in range((seed & 6) // 2):
        b = data[i] ^ ((enc2 + unenc1) & 0xFF)
        enc2, enc1, unenc1 = enc1, data[i], b
        i += 1
    plain = bytearray()
    while i < len(data):
        b = data[i] ^ ((enc2 + unenc1) & 0xFF)
        enc2, enc1, unenc1 = enc1, data[i], b
        plain.append(b)
        i += 1
    length = struct.unpack_from("<I", plain)[0]
    return bytes(plain[4:4 + length])


# ------------------------------------------------------------------ dir stream
def _rec(rid: int, payload: bytes) -> bytes:
    return struct.pack("<HI", rid, len(payload)) + payload


def _dir_stream(modules, codepage: int) -> bytes:
    enc = lambda s: s.encode("cp%d" % codepage)
    u16 = lambda s: s.encode("utf-16-le")
    d = bytearray()
    # PROJECTINFORMATION
    d += _rec(0x0001, struct.pack("<I", 1))            # SYSKIND: Win32
    d += _rec(0x0002, struct.pack("<I", 0x409))        # LCID
    d += _rec(0x0014, struct.pack("<I", 0x409))        # LCIDINVOKE
    d += _rec(0x0003, struct.pack("<H", codepage))     # CODEPAGE
    d += _rec(0x0004, enc("VBAProject"))               # NAME
    d += _rec(0x0005, b"") + _rec(0x0040, b"")         # DOCSTRING
    d += _rec(0x0006, b"") + _rec(0x003D, b"")         # HELPFILEPATH
    d += _rec(0x0007, struct.pack("<I", 0))            # HELPCONTEXT
    d += _rec(0x0008, struct.pack("<I", 0))            # LIBFLAGS
    d += struct.pack("<HIIH", 0x0009, 4, 1, 0)         # VERSION (Reserved=4)
    d += _rec(0x000C, b"") + _rec(0x003C, b"")         # CONSTANTS
    # PROJECTREFERENCES: stdole
    d += _rec(0x0016, enc("stdole")) + _rec(0x003E, u16("stdole"))
    libid = enc("*\\G{00020430-0000-0000-C000-000000000046}#2.0#0#"
                "C:\\Windows\\System32\\stdole2.tlb#OLE Automation")
    registered = struct.pack("<I", len(libid)) + libid + struct.pack("<IH", 0, 0)
    d += _rec(0x000D, registered)
    # PROJECTMODULES
    d += _rec(0x000F, struct.pack("<H", len(modules)))
    d += _rec(0x0013, struct.pack("<H", 0xFFFF))       # PROJECTCOOKIE
    for name, kind, _ in modules:
        d += _rec(0x0019, enc(name))                   # MODULENAME
        d += _rec(0x0047, u16(name))                   # MODULENAMEUNICODE
        d += _rec(0x001A, enc(name)) + _rec(0x0032, u16(name))  # STREAMNAME
        d += _rec(0x001C, b"") + _rec(0x0048, b"")     # DOCSTRING
        d += _rec(0x0031, struct.pack("<I", 0))        # MODULEOFFSET: source at 0
        d += _rec(0x001E, struct.pack("<I", 0))        # HELPCONTEXT
        d += _rec(0x002C, struct.pack("<H", 0xFFFF))   # MODULECOOKIE
        d += _rec(0x0021 if kind == "std" else 0x0022, b"")  # MODULETYPE
        d += _rec(0x002B, b"")                         # module terminator
    d += _rec(0x0010, b"")                             # dir terminator
    return bytes(d)


# ------------------------------------------------------------ compound file
class _Entry:
    def __init__(self, name, kind, data=b""):
        self.name, self.kind, self.data = name, kind, data
        self.children = []
        self.left = self.right = self.child = NOSTREAM
        self.start, self.size = ENDOFCHAIN, 0
        self.sid = None


def _cfb_key(e):
    return (len(e.name), e.name.upper())


def _tree(nodes):
    """Balanced binary tree over sorted siblings; returns root sid (all nodes black)."""
    if not nodes:
        return NOSTREAM
    mid = len(nodes) // 2
    root = nodes[mid]
    root.left = _tree(nodes[:mid])
    root.right = _tree(nodes[mid + 1:])
    return root.sid


def build_cfb(tree: dict) -> bytes:
    """tree: {name: bytes | dict} nested; returns the compound file bytes."""
    root = _Entry("Root Entry", 5)

    def add(parent, items):
        for name, val in items.items():
            if isinstance(val, dict):
                e = _Entry(name, 1)
                add(e, val)
            else:
                e = _Entry(name, 2, val)
            parent.children.append(e)

    add(root, tree)
    entries = []

    def number(e):
        e.sid = len(entries)
        entries.append(e)
        for c in e.children:
            number(c)

    number(root)
    for e in entries:
        if e.children:
            e.child = _tree(sorted(e.children, key=_cfb_key))

    # Mini stream for small streams.
    mini = bytearray()
    minifat = []
    for e in entries:
        if e.kind == 2:
            e.size = len(e.data)
            if 0 < len(e.data) < MINI_CUTOFF:
                n = -(-len(e.data) // MINI_SECTOR)
                e.start = len(mini) // MINI_SECTOR
                minifat += list(range(e.start + 1, e.start + n)) + [ENDOFCHAIN]
                mini += e.data + b"\0" * (n * MINI_SECTOR - len(e.data))

    def nsec(nbytes):
        return -(-nbytes // SECTOR)

    big = [e for e in entries if e.kind == 2 and e.size >= MINI_CUTOFF]
    dir_secs = nsec(len(entries) * 128)
    minifat_secs = nsec(len(minifat) * 4)
    mini_secs = nsec(len(mini))
    data_secs = dir_secs + minifat_secs + mini_secs + sum(nsec(e.size) for e in big)
    fat_secs = 1
    while fat_secs * 128 < fat_secs + data_secs:
        fat_secs += 1
    assert fat_secs <= 109

    fat = [FATSECT] * fat_secs
    body = bytearray()

    def place(data: bytes) -> int:
        if not data:
            return ENDOFCHAIN
        first = len(fat)
        n = nsec(len(data))
        fat.extend(list(range(first + 1, first + n)) + [ENDOFCHAIN])
        body.extend(data + b"\0" * (n * SECTOR - len(data)))
        return first

    # Directory sectors are placed first, but entries reference later sectors,
    # so reserve them now and fill in after everything else is placed.
    dir_start = len(fat)
    fat.extend(list(range(dir_start + 1, dir_start + dir_secs)) + [ENDOFCHAIN])
    body.extend(b"\0" * (dir_secs * SECTOR))
    minifat_start = place(b"".join(struct.pack("<I", x) for x in minifat))
    root.start = place(bytes(mini))
    root.size = len(mini)
    for e in big:
        e.start = place(e.data)

    dir_bytes = bytearray()
    for e in entries:
        name = e.name.encode("utf-16-le") + b"\0\0"
        assert len(name) <= 64
        dir_bytes += name + b"\0" * (64 - len(name))
        dir_bytes += struct.pack("<HBB", len(name), e.kind, 1)
        dir_bytes += struct.pack("<III", e.left, e.right, e.child)
        dir_bytes += b"\0" * 16 + struct.pack("<I", 0) + b"\0" * 16
        dir_bytes += struct.pack("<IQ", e.start, e.size)
    while len(dir_bytes) < dir_secs * SECTOR:
        dir_bytes += b"\0" * 64 + struct.pack("<HBB", 0, 0, 0)
        dir_bytes += struct.pack("<III", NOSTREAM, NOSTREAM, NOSTREAM)
        dir_bytes += b"\0" * 36 + struct.pack("<IQ", 0, 0)
    body[0:len(dir_bytes)] = dir_bytes

    fat += [FREESECT] * (fat_secs * 128 - len(fat))
    fat_bytes = b"".join(struct.pack("<I", x) for x in fat)

    header = bytearray()
    header += bytes.fromhex("D0CF11E0A1B11AE1") + b"\0" * 16
    header += struct.pack("<HHHHH", 0x003E, 0x0003, 0xFFFE, 9, 6)
    header += b"\0" * 6
    header += struct.pack("<III", 0, fat_secs, dir_start)
    header += struct.pack("<II", 0, MINI_CUTOFF)
    header += struct.pack("<II", minifat_start if minifat else ENDOFCHAIN,
                          minifat_secs)
    header += struct.pack("<II", ENDOFCHAIN, 0)
    difat = list(range(fat_secs)) + [FREESECT] * (109 - fat_secs)
    header += b"".join(struct.pack("<I", x) for x in difat)
    assert len(header) == SECTOR
    return bytes(header) + fat_bytes + bytes(body)


# ------------------------------------------------------------------- project
DOC_ATTRS = {
    "workbook": "0{00020819-0000-0000-C000-000000000046}",
    "sheet": "0{00020820-0000-0000-C000-000000000046}",
}


def module_source(name: str, kind: str, code: str) -> str:
    if kind == "std":
        head = 'Attribute VB_Name = "%s"\r\n' % name
    else:
        head = (
            'Attribute VB_Name = "%s"\r\n'
            'Attribute VB_Base = "%s"\r\n'
            "Attribute VB_GlobalNameSpace = False\r\n"
            "Attribute VB_Creatable = False\r\n"
            "Attribute VB_PredeclaredId = True\r\n"
            "Attribute VB_Exposed = True\r\n"
            "Attribute VB_TemplateDerived = False\r\n"
            "Attribute VB_Customizable = True\r\n" % (name, DOC_ATTRS[kind])
        )
    body = code.replace("\r\n", "\n").replace("\n", "\r\n")
    return head + body


def build_vba_project(modules, codepage: int = 1252, seed: int = None) -> bytes:
    """modules: list of (name, kind, code); kind in {'workbook', 'sheet', 'std'}."""
    rnd = random.Random(seed)
    project_id = "{%s}" % str(uuid.UUID(int=rnd.getrandbits(128))).upper()
    lines = ['ID="%s"' % project_id]
    for name, kind, _ in modules:
        if kind == "std":
            lines.append("Module=%s" % name)
        else:
            lines.append("Document=%s/&H00000000" % name)
    lines += [
        'Name="VBAProject"',
        'HelpContextID="0"',
        'VersionCompatible32="393222000"',
        'CMG="%s"' % encrypt(project_id, struct.pack("<I", 0), rnd.randrange(256)),
        'DPB="%s"' % encrypt(project_id, b"\x00", rnd.randrange(256)),
        'GC="%s"' % encrypt(project_id, b"\xff", rnd.randrange(256)),
        "",
        "[Host Extender Info]",
        "&H00000001={3832D640-CF90-11CF-8E43-00A0C911005A};VBE;&H00000000",
        "",
        "[Workspace]",
    ]
    lines += ["%s=0, 0, 0, 0, C" % name for name, _, _ in modules]
    project = ("\r\n".join(lines) + "\r\n").encode("cp%d" % codepage)

    projectwm = bytearray()
    for name, _, _ in modules:
        projectwm += name.encode("cp%d" % codepage) + b"\0"
        projectwm += name.encode("utf-16-le") + b"\0\0"
    projectwm += b"\0\0"

    vba = {
        "_VBA_PROJECT": b"\xCC\x61\xFF\xFF\x00\x00\x00",
        "dir": compress(_dir_stream(modules, codepage)),
    }
    for name, kind, code in modules:
        src = module_source(name, kind, code)
        vba[name] = compress(src.encode("cp%d" % codepage))
    return build_cfb({"PROJECT": project, "PROJECTwm": bytes(projectwm), "VBA": vba})


if __name__ == "__main__":
    # Self-test: compression round trip and encryption round trip.
    rnd = random.Random(1)
    samples = [b"", b"a", b"abcabcabcabc" * 50,
               bytes(rnd.randrange(256) for _ in range(9000)),
               b"#aaabcdefaaaaghijaaaaaklaaamnopqaaaaaaaaaaaarstuvwxyzaaa" * 200]
    for s in samples:
        assert decompress(compress(s)) == s, len(s)
    pid = "{11111111-2222-3333-4444-555555555555}"
    for seed in range(256):
        assert decrypt(pid, encrypt(pid, b"\x00\x00\x00\x00", seed)) == b"\0\0\0\0"
    print("self-test ok")
