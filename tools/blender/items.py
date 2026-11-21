"""도구와 자잘한 물건, 화석 모델. 도구는 손잡이(쥐는 곳)가 원점이고 위(+Z)로 뻗는다. 일하는 쪽(날, 주둥이)은 -Y."""
import math
from lib import *


def tools():
    """도구: 쥐는 곳이 원점, 자루는 +Z로 뻗는다. 앞면(일하는 쪽)은 -Y."""
    with Model('tool_net'):
        tube((0, 0, -0.2), (0, 0, 0.74), 0.034, 'wood', seg=8)
        ball((0, 0, -0.2), 0.04, 'wood_d', sub=1)
        tube((0, 0, -0.07), (0, 0, 0.09), 0.041, '#e8574c', seg=8)                 # 손잡이 감은 띠
        tube((0, 0, 0.7), (0, 0, 0.76), 0.042, 'wood_d', seg=8)
        torus((0, 0, 0.98), 0.235, 0.027, '#f2c66a', seg=18, tseg=6, rot=(90, 0, 0))
        bag = [(0.232, 0.0), (0.225, 0.07), (0.17, 0.2), (0.08, 0.28), (0.0, 0.3)]
        lathe(bag, '#f6f9ff', center=(0, 0.0, 0.98), seg=14, rot=(-90, 0, 0), caps=False)
        lathe(list(reversed([(r * 0.985, z) for r, z in bag])), '#e3ebf7', center=(0, 0.0, 0.98), seg=14, rot=(-90, 0, 0), caps=False)   # 안쪽 면
    with Model('tool_rod') as m:
        m.anchor('tip', (0, -0.4, 1.72))                                           # 낚싯줄이 나가는 끝
        tube((0, 0, -0.2), (0, 0, 0.16), 0.04, '#d9b48a', seg=8)                   # 코르크 손잡이
        ball((0, 0, -0.2), 0.045, '#8a5a34', sub=1)
        tube((0, 0, 0.16), (0, 0, 0.3), 0.034, '#3a4a5a', seg=8)
        cyl((0.045, -0.02, 0.2), 0.055, 0.04, '#e8574c', seg=10, rot=(0, 90, 0))   # 릴
        ball((0.1, -0.02, 0.2), 0.02, '#f2c230', sub=1)
        pts = [(0, 0, 0.3), (0, -0.03, 0.7), (0, -0.1, 1.1), (0, -0.24, 1.5), (0, -0.4, 1.72)]
        for i in range(4):
            tube(pts[i], pts[i + 1], 0.024 - i * 0.005, '#e0b84a', r2=0.019 - i * 0.005, seg=6)
        ball(pts[4], 0.016, '#e8574c', sub=1)
    with Model('tool_shovel'):
        tube((0, 0, -0.14), (0, 0, 0.74), 0.034, 'wood', seg=8)
        box((0, 0, -0.17), (0.17, 0.05, 0.05), 'wood_d', bevel=0.012)                 # T자 손잡이
        tube((0, 0, 0.68), (0, 0, 0.78), 0.044, '#e8574c', seg=8)
        box((0, 0, 0.8), (0.25, 0.045, 0.05), '#8a96a4', bevel=0.01)
        ball((0, 0, 0.96), 1.0, '#b4bec9', (0.135, 0.028, 0.2), sub=2)                # 삽날
        ball((0, -0.012, 0.98), 1.0, '#cfd8e0', (0.085, 0.022, 0.14), sub=2)
    with Model('tool_axe'):
        tube((0, 0, -0.2), (0, 0, 0.84), 0.036, 'wood', seg=8)
        ball((0, 0, -0.2), 0.044, 'wood_d', sub=1)
        tube((0, 0, -0.07), (0, 0, 0.09), 0.042, '#4a90d9', seg=8)
        # 도끼날(-Y 쪽이 날)
        poly([(-0.035, 0.05, 0.62), (0.035, 0.05, 0.62), (0.035, 0.05, 0.84), (-0.035, 0.05, 0.84), (0, -0.25, 0.54), (0, -0.25, 0.92)],
             [(0, 3, 2, 1), (0, 1, 4), (3, 5, 2), (0, 4, 5, 3), (1, 2, 5, 4)], '#b4bec9')
        box((0, 0.0, 0.73), (0.09, 0.12, 0.2), '#e8574c', bevel=0.012)
        box((0, -0.235, 0.73), (0.012, 0.03, 0.36), '#e3e9ee')
    with Model('tool_can'):
        # 물뿌리개: 위 손잡이를 쥔다. 주둥이는 앞(-Y)
        lathe([(0.0, -0.4), (0.13, -0.4), (0.155, -0.37), (0.155, -0.15), (0.14, -0.12), (0.0, -0.12)], '#62b4ea', seg=14)
        lathe([(0.157, -0.3), (0.157, -0.27)], '#f6f9ff', seg=14, caps=False)
        arc((0, 0.0, -0.13), 0.13, 0.022, '#3f8fd0', 0, 180, seg=10, tseg=6, rot=(90, 0, 90))      # 위 손잡이
        tube((0, -0.13, -0.3), (0, -0.36, -0.1), 0.034, '#62b4ea', r2=0.026, seg=8)               # 주둥이
        cyl((0, -0.35, -0.11), 0.03, 0.05, '#3f8fd0', r2=0.065, seg=10, rot=(49, 0, 0))
        arc((0, 0.15, -0.26), 0.08, 0.02, '#3f8fd0', -90, 90, seg=8, tseg=6, rot=(90, 0, 90))       # 뒤 손잡이
    with Model('bobber'):
        ball((0, 0, 0.03), 0.07, 'red', sub=2)
        ball((0, 0, 0.0), 0.072, 'white', (1, 1, 0.5), sub=2)
        cyl((0, 0, 0.08), 0.008, 0.08, 'black', seg=4)


def misc():
    with Model('medicine'):
        cyl((0, 0, 0), 0.1, 0.2, '#f5f5f0', seg=10)
        cyl((0, 0, 0.2), 0.06, 0.06, '#e8574c', seg=10)
        box((0, -0.1, 0.1), (0.1, 0.01, 0.03), '#e8574c'); box((0, -0.1, 0.1), (0.03, 0.01, 0.1), '#e8574c')
    with Model('seedbag'):
        box((0, 0, 0.14), (0.26, 0.1, 0.28), '#e9d9a8', bevel=0.02)
        box((0, 0, 0.3), (0.28, 0.04, 0.05), '#c9b278')
        for i in range(5):
            a = math.radians(i * 72)
            ball((math.cos(a) * 0.045, -0.055, 0.14 + math.sin(a) * 0.045), 0.03, 'petal', (1, 0.3, 1))
        ball((0, -0.06, 0.14), 0.025, 'petal_c', (1, 0.3, 1))
    with Model('letter'):
        box((0, 0, 0.02), (0.34, 0.24, 0.03), '#fff8e0')
        poly([(-0.17, -0.12, 0.036), (0.17, -0.12, 0.036), (0, 0.02, 0.036)], [(0, 1, 2)], '#ead9a8')
        ball((0, -0.02, 0.04), 0.03, 'red', (1, 1, 0.4))
    with Model('roll'):          # 벽지·바닥재 두루마리(재질 roll의 색을 바꿔 쓴다)
        cyl((-0.16, 0, 0.09), 0.09, 0.32, 'roll', seg=10, rot=(0, 90, 0))
        cyl((-0.17, 0, 0.09), 0.03, 0.34, '#fff8e0', seg=8, rot=(0, 90, 0))
        box((0.0, 0.1, 0.012), (0.3, 0.14, 0.012), 'roll')
    with Model('fossil'):        # 감정받기 전 화석
        lump((0, 0, 0.12), 1.0, '#a08a6a', (0.2, 0.18, 0.13), seed=4, amp=0.2)
        torus((0, -0.12, 0.14), 0.06, 0.02, '#e8dcc0', seg=10, tseg=4, rot=(70, 0, 0))
        ball((0, -0.13, 0.14), 0.02, '#e8dcc0')
    with Model('weedbit'):
        for i in range(4):
            a = i * 1.6
            tube((0, 0, 0.02), (math.cos(a) * 0.14, math.sin(a) * 0.14, 0.06), 0.03, 'weed', r2=0.004, seg=5)


def slab(c='#b8a888', seed=2):
    lump((0, 0, 0.04), 1.0, c, (0.24, 0.2, 0.045), seed=seed, amp=0.14)


BONE = '#efe6d0'


def fossils():
    with Model('fossil_trilobite'):
        slab()
        for i in range(6):
            ball((0, -0.09 + i * 0.035, 0.085), 1.0, '#6a5a48', (0.09 - abs(i - 2) * 0.012, 0.022, 0.02))
        ball((0, -0.12, 0.085), 1.0, '#6a5a48', (0.085, 0.045, 0.025))
    with Model('fossil_ammonite'):
        for i in range(16):
            a = i * 0.62
            r = 0.02 + i * 0.011
            ball((math.cos(a) * r, 0, 0.2 + math.sin(a) * r), 0.018 + i * 0.0042, '#d9c8a0' if i % 2 else '#bfa878', (1, 0.9, 1))
        box((0, 0, 0.02), (0.2, 0.14, 0.04), '#8a7a62', bevel=0.01)
    with Model('fossil_amber'):
        lump((0, 0, 0.11), 1.0, '#f2a82e', (0.14, 0.12, 0.11), seed=7, amp=0.12, smooth=True)
        ball((0.01, -0.03, 0.12), 0.03, '#5a3a14', (1.4, 0.6, 0.7))
        ball((-0.04, -0.1, 0.16), 0.02, '#ffe2a0')
    with Model('fossil_egg'):
        slab('#a89878', 5)
        for (x, y) in ((-0.07, 0), (0.07, 0.02), (0, -0.07)):
            ball((x, y, 0.12), 0.07, '#e8dcc0', (0.85, 0.85, 1.15), sub=2)
    with Model('fossil_footprint'):
        slab('#b0a080', 9)
        for a in (-35, 0, 35):
            r = math.radians(a)
            ball((math.sin(r) * 0.07, -0.02 - math.cos(r) * 0.07, 0.082), 1.0, '#6a5a44', (0.025, 0.07, 0.012), rot=(0, 0, -a))
        ball((0, 0.05, 0.082), 1.0, '#6a5a44', (0.05, 0.045, 0.012))
    with Model('fossil_trex'):
        box((0, 0, 0.025), (0.22, 0.14, 0.05), '#8a7a62', bevel=0.01)
        tube((0, 0, 0.05), (0.03, 0, 0.2), 0.05, BONE, r2=0.04, seg=7)
        tube((0.03, 0, 0.2), (0.0, 0, 0.36), 0.04, BONE, r2=0.006, seg=7)
    with Model('fossil_horn'):
        box((0, 0, 0.025), (0.22, 0.14, 0.05), '#8a7a62', bevel=0.01)
        tube((-0.06, 0, 0.05), (-0.02, 0, 0.22), 0.06, '#d9ccb0', r2=0.045, seg=7)
        tube((-0.02, 0, 0.22), (0.08, 0, 0.38), 0.045, '#d9ccb0', r2=0.008, seg=7)
    with Model('fossil_plate'):
        box((0, 0, 0.025), (0.22, 0.14, 0.05), '#8a7a62', bevel=0.01)
        poly([(-0.12, 0.02, 0.05), (0.12, 0.02, 0.05), (0.14, 0.02, 0.2), (0, 0.02, 0.36), (-0.14, 0.02, 0.2),
              (-0.12, -0.02, 0.05), (0.12, -0.02, 0.05), (0.14, -0.02, 0.2), (0, -0.02, 0.36), (-0.14, -0.02, 0.2)],
             [(0, 1, 2, 3, 4), (9, 8, 7, 6, 5), (0, 5, 6, 1), (1, 6, 7, 2), (2, 7, 8, 3), (3, 8, 9, 4), (4, 9, 5, 0)], '#d9ccb0')
    with Model('fossil_tusk'):
        box((0, 0, 0.025), (0.3, 0.14, 0.05), '#8a7a62', bevel=0.01)
        pts = [(-0.14, 0, 0.08), (-0.06, 0, 0.2), (0.06, 0, 0.26), (0.16, 0, 0.2), (0.2, 0, 0.1)]
        for i in range(4):
            tube(pts[i], pts[i + 1], 0.05 - i * 0.01, BONE, r2=0.04 - i * 0.01, seg=7)
            ball(pts[i + 1], 0.04 - i * 0.01, BONE)
    with Model('fossil_fish'):
        slab('#c0b090', 11)
        box((0, 0, 0.085), (0.26, 0.012, 0.012), '#5a4a38')
        for i in range(6):
            box((-0.08 + i * 0.03, 0, 0.085), (0.01, 0.1 - abs(i - 2.5) * 0.02, 0.012), '#5a4a38')
        ball((0.12, 0, 0.085), 1.0, '#5a4a38', (0.04, 0.035, 0.012))
        poly([(-0.13, 0, 0.09), (-0.19, 0.05, 0.09), (-0.19, -0.05, 0.09)], [(0, 1, 2)], '#5a4a38')
    with Model('fossil_fern'):
        slab('#b8ac8c', 13)
        box((0, 0, 0.085), (0.012, 0.3, 0.012), '#4a5a38')
        for i in range(6):
            for s in (1, -1):
                ball((s * 0.05, -0.11 + i * 0.04, 0.085), 1.0, '#4a5a38', (0.045 - i * 0.004, 0.014, 0.01), rot=(0, 0, s * 25))
    with Model('fossil_megalodon'):
        box((0, 0, 0.025), (0.22, 0.14, 0.05), '#8a7a62', bevel=0.01)
        poly([(-0.11, 0.02, 0.07), (0.11, 0.02, 0.07), (0, 0.02, 0.34), (-0.11, -0.02, 0.07), (0.11, -0.02, 0.07), (0, -0.02, 0.34)],
             [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)], '#5a5a66')
        box((0, 0, 0.08), (0.24, 0.05, 0.05), '#3a3a44')


def materials():
    """재료: 도끼질로 얻는 나무, 바위를 두드려 얻는 돌"""
    with Model('mat_wood'):
        for i, (y, z) in enumerate(((-0.09, 0.07), (0.09, 0.07), (0.0, 0.2))):
            tube((-0.2, y, z), (0.2, y, z), 0.085, 'bark', seg=8)
            for sx in (-1, 1):
                cyl((sx * 0.2, y, z), 0.07, 0.006, 'wood_l', seg=8, rot=(0, 90, 0))
        torus((0, 0, 0.12), 0.17, 0.016, '#e9d9a8', seg=10, tseg=4, rot=(0, 90, 0), scale=(1, 1.15, 1.0))
    with Model('mat_stone'):
        lump((0, 0, 0.11), 1.0, 'rock', (0.17, 0.15, 0.12), seed=11, amp=0.22, smooth=True)
        lump((0.16, -0.08, 0.07), 1.0, 'rock_d', (0.1, 0.09, 0.07), seed=13, amp=0.22, smooth=True)
        lump((-0.12, 0.1, 0.06), 1.0, 'rock_l', (0.08, 0.08, 0.06), seed=17, amp=0.2, smooth=True)


def patrol_gear():
    with Model('hunt_staff'):
        tube((0,0,-.24),(0,0,.68),.045,'#f1cf52',seg=16)
        for z in (-.24,.68):
            ball((0,0,z),1,'#fff4da',(.046,.046,.042),sub=3)
    for name,body,trim in [('hunt_fork','#e994aa','#f8ced1'),('hunt_blue','#71adc6','#bde8e8'),('hunt_bell','#77a888','#b9d6a0')]:
        with Model(name):
            tube((0,0,-.16),(0,0,.63),.029,body,r2=.024,seg=12)
            ball((0,0,-.16),.039,trim,sub=2)
            for z in (-.10,-.06,-.02,.58):
                torus((0,0,z),.030,.005,trim,seg=12,tseg=6)
            if name=='hunt_bell':
                ball((0,0,.70),1,'#e6b65c',(.105,.085,.106),sub=3)
                torus((0,0,.675),.086,.013,'#f8db85',seg=16,tseg=6)
                ball((0,-.083,.668),.016,'#966a43',sub=2)
                for side in (-1,1):
                    ball((side*.055,0,.81),1,trim,(.046,.024,.080),rot=(0,side*42,0),sub=2)
            else:
                for side in (-1,1):
                    pts=[(0,0,.60),(side*.078,0,.625),(side*.113,0,.67),(side*.115,0,.80)]
                    for start,end in zip(pts,pts[1:]):
                        tube(start,end,.025,body,seg=12);ball(end,.025,body,sub=2)
                ball((0,-.01,.604),.039,trim,sub=2)


def story_props():
    with Model('story_ramen') as m:
        # Glazed bowl and its foot, broth, rolled pork, curly noodles and sprouts.
        lathe([(.13,0),(.14,.035),(.22,.065),(.31,.16),(.35,.245),
               (.35,.255),(.325,.257),(.305,.225),(.20,.085)],'#f8e3cb',seg=48)
        torus((0,0,.247),.342,.013,'#a64e43',seg=48,tseg=8)
        lathe([(.317,.223),(.322,.232),(.001,.233)],'#b78145',seg=40)
        for i in range(9):
            x=-.15+i*.040
            pts=[(x+.018*math.sin(j*1.85+i),-.19+j*.064,.24+.008*math.sin(j*.8+i)) for j in range(6)]
            for a,b in zip(pts,pts[1:]):tube(a,b,.009,'#efd287',seg=6)
        ball((-.152,.07,.25),1,'#ae7254',(.112,.096,.024),sub=3)
        torus((-.152,.07,.267),.061,.009,'#e7b695',seg=18,tseg=6,scale=(1,.81,1))
        for part,n,col,rad in [('sprouts',26,'#f1e6b1',.014),('garlic',13,'#fbe8b4',.025),('fat',12,'#f6d5a3',.020)]:
            with m.part(part):
                for i in range(n):
                    a=i*2.4;r=.118*math.sqrt((i+.5)/n)
                    x=(.02 if part=='sprouts' else .17 if part=='garlic' else -.13)+r*math.cos(a)
                    y=(-.015 if part=='sprouts' else .04 if part=='garlic' else -.11)+r*.7*math.sin(a)
                    z=.25+.066*(1-r/.14) if part=='sprouts' else .25+.02*(1-r/.14)
                    if part=='sprouts':
                        tube((x-.025,y-.025,z),(x+.027,y+.018,z+.024),rad,'#e7e4a8',r2=.008,seg=6)
                        ball((x+.027,y+.018,z+.024),.012,'#8ba461',sub=1)
                    else:ball((x,y,z),rad,col,(1,.8,.6),sub=2)
        with m.part('sauce'):
            for i in range(4):
                ball((.14-i*.054,-.15+.015*i,.243),.031,'#915c37',(1,.55,.12),sub=2)
    with Model('story_vine'):
        for z,r in [(.028,.15),(.046,.14),(.062,.121)]:
            torus((0,0,z),r,.014,'#688045',seg=24,tseg=7,scale=(1,.77,1))
        for s in (-1,1):
            ball((s*.12,-.085,.046),1,'#87a555',(.055,.026,.013),rot=(0,15,s*35),sub=2)
    with Model('story_hollow'):
        ball((0,0,.004),1,'#503d37',(.81,.60,.037),sub=3)
        ball((0,-.012,.019),1,'#362e32',(.67,.48,.025),sub=3)
        for i in range(14):
            a=i*math.tau/14
            ball((.755*math.cos(a),.55*math.sin(a),.046),1,'#937d64' if i%3 else '#ac9472',
                 (.139,.088,.065+.020*(i%3)),rot=(0,i%3*9,math.degrees(a)+85),sub=2)


def gallery_skeleton():
    # A long-necked dinosaur cast for the museum's central island.
    ivory, joint, frame = '#dfcc9c', '#c4ab80', '#465057'
    with Model('gallery_sauropod'):
        spine = [(-4.9,1.00),(-4.2,1.15),(-3.4,1.39),(-2.6,1.68),(-1.9,1.98),
                 (-1.25,2.16),(-.55,2.27),(.15,2.31),(.80,2.27),(1.36,2.23),
                 (1.83,2.46),(2.23,2.84),(2.57,3.27),(2.83,3.68),(3.10,3.96),(3.43,4.08)]
        for i,((x,z),(xx,zz)) in enumerate(zip(spine,spine[1:])):
            radius=.045 if i<3 else .10 if i<10 else .072
            tube((x,0,z),(xx,0,zz),radius,ivory,r2=radius*.86,seg=10)
            for t in (.18,.64):
                px=x+(xx-x)*t; pz=z+(zz-z)*t
                ball((px,0,pz),1,ivory,(radius*1.2,radius*1.5,radius*1.55),sub=2)
                tube((px,0,pz),(px-.055,0,pz+radius*2.2),radius*.5,joint,r2=.016,seg=7)
        for i in range(11):
            x=-1.55+i*.25
            spread=.25+.41*math.sin((i+.55)/11.5*math.pi)
            z=2.22+.08*math.cos(x+0.1)
            for s in (-1,1):
                ribs=[(x,0,z),(x-.06,s*spread*.72,z-.13),(x-.10,s*spread,z-.38),
                      (x-.13,s*spread*.85,z-.65),(x-.10,s*spread*.38,z-.82)]
                for a,b in zip(ribs,ribs[1:]):tube(a,b,.041,ivory,r2=.033,seg=8)
        for x,z in [(-1.36,1.90),(.90,1.96)]:
            for s in (-1,1):
                y=.39*s
                ball((x,y*.50,z+.10),1,joint,(.30,.18,.22),sub=2)
                leg=[(x,y,z),(x+(.14 if x>0 else -.19),y*1.18,1.18),(x-.01,y*1.22,.55),(x+.06,y*1.25,.18)]
                for j,(a,b) in enumerate(zip(leg,leg[1:])):
                    tube(a,b,.10-j*.015,ivory,r2=.080-j*.013,seg=10)
                    ball(b,.102-j*.010,joint,sub=2)
                ball((x+.14,y*1.25,.15),1,ivory,(.19,.12,.07),sub=2)
        ball((3.51,0,4.07),1,ivory,(.27,.145,.165),sub=3)
        ball((3.76,0,4.025),1,ivory,(.22,.108,.089),sub=2)
        for s in (-1,1):
            ball((3.57,s*.128,4.09),1,frame,(.072,.018,.056),sub=2)
            tube((3.49,s*.10,3.99),(3.86,s*.055,3.91),.033,ivory,r2=.023,seg=8)
        for x,z in [(-2.92,1.51),(-.74,2.19),(2.56,3.21)]:
            tube((x,0,.08),(x,0,z-.04),.024,frame,seg=8)
            cyl((x,0,.04),.13,.08,frame,seg=12)


def build():
    tools(); misc(); fossils(); materials(); patrol_gear(); story_props(); gallery_skeleton()
