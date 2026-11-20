"""glb 파일의 꼭짓점 값을 작은 정수로 줄여 담는다(glTF 표준 확장 KHR_mesh_quantization, three.js가 그대로 읽는다).

- 위치(POSITION): 32비트 실수 3개(12바이트) → 16비트 정수 3개(8바이트). 메시마다 가운데와 크기를 재서
  [-1, 1]로 줄여 담고, 그 메시를 담은 노드 밑에 '되돌리는 변환(이동+고른 확대)'을 가진 노드를 하나 끼운다.
  확대를 x·y·z 모두 같게 해서 법선이 비뚤어지지 않는다.
- 법선(NORMAL): 12바이트 → 8비트 정수 3개(4바이트).
- 그림 자리(TEXCOORD_0): 0~1 안에 있으면 8바이트 → 16비트 정수 2개(4바이트). 벗어나면 그대로 둔다.
곤충·물고기 묶음이 40%쯤 줄어든다. 사람 눈에 보이는 차이는 없다(위치 오차는 메시 크기의 1/65000).

쓰는 법: python3 tools/blender/quantize.py assets/models/bugs.glb [다른 파일 …]  (build.py가 fish·bugs에 알아서 쓴다)
"""
import json
import struct
import sys

FLOAT, BYTE, SHORT, USHORT = 5126, 5120, 5122, 5123
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
CSIZE = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
CFMT = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}


def _read(j, binv, ai):
    a = j['accessors'][ai]
    bv = j['bufferViews'][a['bufferView']]
    n, c, ct = a['count'], NCOMP[a['type']], a['componentType']
    es = CSIZE[ct] * c
    stride = bv.get('byteStride', es)
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    fmt = '<' + CFMT[ct] * c
    return [struct.unpack_from(fmt, binv, off + i * stride) for i in range(n)]


def quantize(path):
    raw = open(path, 'rb').read()
    jl = struct.unpack_from('<I', raw, 12)[0]
    j = json.loads(raw[20:20 + jl])
    if 'KHR_mesh_quantization' in j.get('extensionsUsed', []):
        return 0
    bo = 20 + jl
    bl = struct.unpack_from('<I', raw, bo)[0]
    binv = raw[bo + 8:bo + 8 + bl]

    new = {}                                       # 접근자 번호 → (바이트, 접근자 고칠 값, 한 칸 크기)
    mesh_xf = {}                                   # 메시 번호 → (가운데, 확대)
    for mi, m in enumerate(j['meshes']):
        pos = [p['attributes']['POSITION'] for p in m['primitives'] if 'POSITION' in p['attributes']]
        if any(j['accessors'][a]['componentType'] != FLOAT for a in pos) or not pos:
            continue
        lo = [min(j['accessors'][a]['min'][k] for a in pos) for k in range(3)]
        hi = [max(j['accessors'][a]['max'][k] for a in pos) for k in range(3)]
        c = [(lo[k] + hi[k]) / 2 for k in range(3)]
        s = max(max((hi[k] - lo[k]) / 2 for k in range(3)), 1e-6)
        mesh_xf[mi] = (c, s)
        for p in m['primitives']:
            at = p['attributes']
            a = at.get('POSITION')
            if a is not None and a not in new:
                q = [tuple(max(-32767, min(32767, round((v[k] - c[k]) / s * 32767))) for k in range(3)) for v in _read(j, binv, a)]
                data = b''.join(struct.pack('<hhhh', x, y, z, 0) for x, y, z in q)
                new[a] = (data, dict(componentType=SHORT, normalized=True, min=[min(v[k] for v in q) for k in range(3)], max=[max(v[k] for v in q) for k in range(3)]), 8)
            a = at.get('NORMAL')
            if a is not None and a not in new and j['accessors'][a]['componentType'] == FLOAT:
                data = b''.join(struct.pack('<bbbb', *[max(-127, min(127, round(x * 127))) for x in v], 0) for v in _read(j, binv, a))
                new[a] = (data, dict(componentType=BYTE, normalized=True), 4)
            a = at.get('TEXCOORD_0')
            if a is not None and a not in new and j['accessors'][a]['componentType'] == FLOAT:
                uv = _read(j, binv, a)
                if all(-1e-4 <= x <= 1.0001 for v in uv for x in v):
                    data = b''.join(struct.pack('<HH', *[max(0, min(65535, round(x * 65535))) for x in v]) for v in uv)
                    new[a] = (data, dict(componentType=USHORT, normalized=True), 4)

    # 버퍼를 새로 짠다: 바뀐 접근자는 새 조각으로, 나머지 조각(색인·그림)은 그대로 옮긴다
    used = {}
    for ai, a in enumerate(j['accessors']):
        if ai not in new and 'bufferView' in a:
            used.setdefault(a['bufferView'], True)
    for im in j.get('images', []):
        if 'bufferView' in im:
            used.setdefault(im['bufferView'], True)
    out, views, remap = bytearray(), [], {}

    def put(data, extra):
        while len(out) % 4:
            out.append(0)
        v = dict(buffer=0, byteOffset=len(out), byteLength=len(data))
        v.update(extra)
        out.extend(data)
        views.append(v)
        return len(views) - 1

    for vi, bv in enumerate(j['bufferViews']):
        if vi in used:
            o = bv.get('byteOffset', 0)
            remap[vi] = put(binv[o:o + bv['byteLength']], {k: v for k, v in bv.items() if k in ('byteStride', 'target')})
    for ai, a in enumerate(j['accessors']):
        if ai in new:
            data, fix, stride = new[ai]
            a['bufferView'] = put(data, dict(byteStride=stride, target=34962))
            a.pop('byteOffset', None)
            a.update(fix)
        elif 'bufferView' in a:
            a['bufferView'] = remap[a['bufferView']]
    for im in j.get('images', []):
        if 'bufferView' in im:
            im['bufferView'] = remap[im['bufferView']]
    j['bufferViews'] = views
    j['buffers'] = [dict(byteLength=len(out))]

    # 메시를 담은 노드 밑에 '되돌리는 변환' 노드를 끼운다
    for ni in range(len(j['nodes'])):
        nd = j['nodes'][ni]
        mi = nd.get('mesh')
        if mi is None or mi not in mesh_xf:
            continue
        c, s = mesh_xf[mi]
        j['nodes'].append(dict(name=(nd.get('name') or 'mesh') + '_q', mesh=mi, translation=c, scale=[s, s, s]))
        del nd['mesh']
        nd['children'] = nd.get('children', []) + [len(j['nodes']) - 1]
    for key in ('extensionsUsed', 'extensionsRequired'):
        j[key] = sorted(set(j.get(key, [])) | {'KHR_mesh_quantization'})

    js = json.dumps(j, separators=(',', ':'), ensure_ascii=False).encode()
    js += b' ' * (-len(js) % 4)
    while len(out) % 4:
        out.append(0)
    glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
    open(path, 'wb').write(glb)
    return len(raw) - len(glb)


if __name__ == '__main__':
    for p in sys.argv[1:]:
        before = len(open(p, 'rb').read())
        saved = quantize(p)
        print('%s: %.0f KB → %.0f KB' % (p, before / 1024, (before - saved) / 1024))
