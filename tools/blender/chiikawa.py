"""치이카와 주민과 갑옷 씨. 좌표와 부위 이름은 게임의 Actor 규격을 따른다."""
import math
from functools import partial
from lib import Model, arc, ball, box, capsule, lathe, poly, torus, tube


INK = '#382c34'
MILK = '#fffbf9'
PINK = '#f6a7ae'
BLUE = '#559ed2'
CREAM = '#ffe6ad'
# 한 덩어리로 이어지는 볼과 배의 단면. (반지름, 발바닥에서의 높이)
PROFILE = [(0, .105), (.21, .111), (.281, .139), (.351, .215), (.397, .32),
           (.416, .425), (.465, .513), (.519, .62), (.536, .73), (.532, .83), (.504, .93),
           (.448, 1.035), (.367, 1.12), (.269, 1.177), (.15, 1.213), (0, 1.228)]
DEPTH = .78


def radius(z):
    for (a, low), (b, high) in zip(PROFILE, PROFILE[1:]):
        if z <= high:
            return a + (b - a) * max(0, (z - low) / (high - low))
    return 0


def front(x, z, lift=0):
    return (x, -DEPTH * math.sqrt(max(0, radius(z)**2 - x*x)) - lift, z)


def oval(x, z, w, h, color, lift=.008, depth=.013, tilt=0):
    """얼굴 곡면에 밀착시킨 잉크 또는 연지."""
    r = radius(z)
    yaw = math.degrees(math.atan2(DEPTH*x, math.sqrt(max(.0001, r*r-x*x))))
    slope = (front(x, z+.004)[1] - front(x, z-.004)[1]) / .008
    pitch = -math.degrees(math.atan(slope))
    ball(front(x, z, lift), 1, color, (w, depth, h), rot=(pitch, tilt, yaw), sub=3)


def stroke(points, width=.011, color=INK, lift=.018):
    pts = [front(x, z, lift) for x, z in points]
    for a, b in zip(pts, pts[1:]):
        tube(a, b, width, color, seg=8)
    for p in pts:
        ball(p, width, color, sub=1)


def face_patch(x, z, w, h, color, lift):
    verts=[front(x,z,lift)]
    faces=[]
    n=48
    for ring in range(1,9):
        for i in range(n):
            a=2*math.pi*i/n
            verts.append(front(x+w*ring/8*math.cos(a), z+h*ring/8*math.sin(a),lift))
        base=1+(ring-1)*n
        for i in range(n):
            k=(i+1)%n
            faces.append((0,base+i,base+k) if ring==1 else
                         (base-n+i,base+i,base+k,base-n+k))
    poly(verts,faces,color,smooth=True)


def cap(color, edge):
    """이마의 경계를 방위각에 따라 바꿔 팔자 무늬와 밤껍질을 그린다."""
    verts, faces = [], []
    n, rings = 64, 14
    for j in range(rings):
        for i in range(n):
            a = 2*math.pi*i/n
            z0 = edge(a)
            z = z0 + (PROFILE[-1][1] - z0) * j/rings
            r = radius(z) + .007
            verts.append((r*math.sin(a), -DEPTH*r*math.cos(a), z+.003))
    for j in range(rings-1):
        for i in range(n):
            k = (i+1) % n
            faces.append((j*n+i, j*n+k, (j+1)*n+k, (j+1)*n+i))
    peak = len(verts)
    verts.append((0, 0, PROFILE[-1][1]+.006))
    faces.extend(((rings-1)*n+i, (rings-1)*n+(i+1)%n, peak) for i in range(n))
    poly(verts, faces, color, smooth=True)


def tuft(x, y, z, w, h, color, tilt=0):
    lathe([(.77*w, 0), (w, .22*h), (.88*w, .43*h), (.49*w, .76*h),
           (.19*w, .94*h), (0, h)], color, center=(x,y,z), scale=(1,.72),
          seg=20, rot=(0,tilt,0))


def little_ears(fur):
    for s in (-1, 1):
        ball((s*.295, .005, 1.157), 1, fur, (.091,.076,.104), rot=(0,s*20,0), sub=3)


def chiikawa(head, tail):
    little_ears(MILK)
    for s in (-1, 1):
        stroke([(s*.199,.932),(s*.175,.949),(s*.149,.955)], .009)
    with tail:
        ball((0,.29,.30), .088, MILK, sub=3)


def hachiware(head, tail):
    cap(BLUE, lambda a: .997 + .139*max(0,1-abs(math.atan2(math.sin(a),math.cos(a)))/1.16)**2
        - .029*(1-math.cos(a)))
    for s in (-1,1):
        tuft(s*.278,.01,1.045,.157,.311,BLUE, s*15)
        oval(s*.151,.949,.016,.011,INK,tilt=s*12)
    with tail:
        ball((.135,.35,.32),1,BLUE,(.084,.224,.086),rot=(18,0,-25),sub=3)


def usagi(head, tail):
    for s in (-1,1):
        ball((s*.177,.024,1.378),1,CREAM,(.089,.081,.265),rot=(0,s*6,0),sub=3)
        ball((s*.180,-.045,1.401),1,'#f3b3ad',(.050,.020,.187),rot=(0,s*6,0),sub=3)
        stroke([(s*.253,.926),(s*.239,.964),(s*.206,.997),(s*.168,1.015),(s*.117,1.025)], .0075)
    with tail:
        ball((0,.306,.30),.104,CREAM, sub=3)


def momonga(head, tail):
    for s in (-1,1):
        ball((s*.289,.015,1.168),1,MILK,(.135,.085,.175),rot=(0,s*21,0),sub=3)
        ball((s*.301,-.052,1.185),1,'#a9d8e3',(.086,.024,.116),rot=(0,s*21,0),sub=3)
        for j,z in enumerate((.632,.703,.77)):
            tuft(s*(.465+.015*j),.015,z-.045,.063,.132,MILK,s*61)
            stroke([(s*.464,z),(s*.49,z+.012),(s*.510,z+.006)],.0075)
        stroke([(s*.094,.909),(s*.073,.923)],.008)
    oval(0,.829,.037,.041,'#a4d8e6',.010,.019)
    for s in (-1,1):
        oval(s*.012,.838,.005,.009,INK,.028,.005)
    with tail:
        ball((.451,.30,.723),1,'#9ed5e5',(.269,.217,.480),rot=(-13,18,0),sub=4)
        for x,z,tilt in [(.41,1.065,-12),(.53,1.129,10),(.66,1.047,26)]:
            tuft(x,.40,z,.08,.17,'#9ed5e5',tilt)
        for i in range(5):
            z=.45+.133*i
            x=.62+.078*math.sin(math.pi*i/5)
            capsule((x-.046,.159,z),(x+.020,.20,z+.032),.009,'#618fa4',seg=7,sub=1)


def kurimanju(head, tail):
    cap('#985f40',lambda a: 1.045 + .026*math.cos(a) - .012*math.cos(2*a))
    for s in (-1,1):
        ball((s*.395,.012,1.029),1,'#f6deb5',(.074,.065,.055),rot=(0,s*20,0),sub=3)
    # 작고 푸른 찻잔, 갈색 차가 보이는 테두리.
    with head:
        lathe([(.046,0),(.064,.021),(.068,.108),(.071,.116)],'#73b2bd',
              center=(-.313,-.291,.365),seg=20)
        torus((-.313,-.291,.481),.062,.009,'#dcf3ea',seg=20,tseg=6)
        ball((-.313,-.291,.477),1,'#a5723f',(.061,.061,.006),sub=2)


def rakko(head, tail):
    # 흉터·망토·칼집이 앞뒤와 옆모습에서 모두 보인다.
    ear_z = .98
    for side in (-1,1):
        ball((side*(radius(ear_z)-.005), -.012, ear_z), 1, '#412521',
             (.068, .066, .048), rot=(0, -side*12, 0), sub=3)
        for z in (.63,.72,.81):
            tuft(side*.469,.015,z,.068,.126,'#f4debb',side*61)
    for i in range(-5,6):
        a = i*.22
        x,z = .405*math.sin(a), .928+.296*math.cos(a)
        tuft(x,.008,z-.039,.026,.053,'#e9d1ad',math.degrees(a)*.55)
    scar=[(-.316,.997),(-.266,.973),(-.196,1.003),(-.22,.949),
          (-.198,.903),(-.264,.923),(-.323,.892),(-.294,.951)]
    poly([front(x,z,.016) for x,z in scar], [tuple(range(len(scar)-1,-1,-1))], '#dfc39f')
    stroke(scar+[scar[0]],.008,'#654a3a',.023)
    for s in (-1,1):
        stroke([(s*.123,.873),(s*.131,.889)],.006)
    nose=[(-.028,.752),(-.018,.769),(.018,.769),(.028,.752),(0,.724)]
    poly([front(x,z,.018) for x,z in nose], [tuple(range(4,-1,-1))], INK)
    # 짧은 털끝과 볼을 따라 난 수염.
    for s in (-1,1):
        for x,z in [(.399,1.039),(.455,.952),(.486,.884),(.497,.794),(.470,.637)]:
            stroke([(s*x,z),(s*(x+.012),z+.017)],.006,'#9d7957')
    # 앞은 트여 있고 등쪽으로 길게 내려가는 망토.
    verts,faces=[],[]
    for j,(r,z) in enumerate([(.558,.177),(.551,.201),(.474,.398),(.451,.520)]):
        for i in range(33):
            a=math.radians(33+294*i/32)
            verts.append((r*math.sin(a),-r*.82*math.cos(a),z+.019*math.cos(a*5)*(1-j/3)))
    for j in range(3):
        for i in range(32):
            a=j*33+i; faces.append((a,a+1,a+34,a+33))
    poly(verts,faces,'#fffaf2',smooth=True)
    lathe([(.425,0),(.445,.016),(.462,.053),(.459,.091),(.443,.103)],'#fffaf4',
          center=(0,0,.431),scale=(1,.82),seg=40)
    with tail:
        ball((0,.250,.264),1,'#f4debb',(.098,.114,.065),sub=3)


def back_sword():
    """랏코 봉제인형 S의 후면 사진. 허리 오른쪽 흰 망토에 붙는 짧은 갈색 칼집."""
    leather, piping = '#925138', '#693b30'
    ivory, engraved = '#f6f2ef', '#a8a0a2'
    # Along-axis coordinates run from the five-sided tip to the little flat pommel.
    def surface(t,u,depth):
        x = -.164 - .311*t + .834*u
        z = .184 + .473*t + .551*u
        head = DEPTH * math.sqrt(max(0,radius(z)**2-x*x))
        cloth_r = .557 - .106*max(0,min(1,(z-.177)/.343))
        cloth = .82*math.sqrt(max(0,cloth_r**2-x*x)) if z<.54 else 0
        return (x,max(head,cloth)+.031+depth,z)
    def piece(rows,color,thick):
        verts,faces=[],[]
        for t,w in rows:
            for u,h in [(-w*.87,0),(-w,.008),(-w,thick-.006),(-w*.88,thick),
                        (w*.88,thick),(w,thick-.006),(w,.008),(w*.87,0)]:
                verts.append(surface(t,u,h))
        for j in range(len(rows)-1):
            for i in range(8):
                k=j*8+i;n=j*8+(i+1)%8
                faces.append((k,n,n+8,k+8))
        faces.extend([tuple(range(7,-1,-1)),tuple(range(len(verts)-8,len(verts)))])
        poly(verts,[tuple(reversed(f)) for f in faces],color,smooth=False)
    piece([(0,.005),(.095,.076),(.16,.079),(.39,.068),(.66,.053)],leather,.033)
    for side in (-1,1):
        pts=[surface(t,side*w,.035) for t,w in [(.045,.007),(.116,.061),(.18,.064),(.39,.054),(.635,.039)]]
        for a,b in zip(pts,pts[1:]): tube(a,b,.0025,piping,seg=6)
    piece([(.64,.070),(.65,.081),(.704,.081),(.71,.069)],ivory,.045)
    piece([(.71,.040),(.74,.040),(.9,.037),(.944,.040)],ivory,.032)
    for t in (.766,.835,.898):
        tube(surface(t,-.034,.033),surface(t+.012,.035,.033),.0032,engraved,seg=6)
    piece([(.94,.047),(.945,.059),(.993,.059),(1,.05)],ivory,.039)


def shisa(head, tail):
    orange='#e59862'
    for s in (-1,1):
        tuft(s*.278,.02,1.087,.101,.177,'#ffe8b1',s*22)
        capsule((s*.276,-.040,1.183),(s*.307,-.040,1.206),.008,'#a37042')
        for i,(x,y,z,r) in enumerate([(.36,.09,1.02,.118),(.465,.06,.913,.125),
                                      (.507,.05,.773,.136),(.50,.06,.625,.131),
                                      (.448,.10,.51,.119),(.355,.14,.447,.10)]):
            ball((s*x,y,z),r,orange,(1,.83,1.14),sub=3)
            if i in (1,3):
                arc((s*x,y-.092,z),r*.55,.011,'#c77e54',30,280,
                    seg=16,tseg=6,rot=(90,0,0))
        oval(s*.170,.961,.072,.048,orange,.009,.021,s*12)
        oval(s*.142,.979,.042,.038,orange,.013,.020,-s*22)
        stroke([(s*.190,.965),(s*.170,.982),(s*.157,.978),(s*.155,.960)],.007,'#ac6d4c',.035)
    with tail:
        ball((0,.32,.32),1,orange,(.143,.135,.141),sub=3)


def kanichan(head, tail):
    cap('#edacb8',lambda a: 1.046 + .062*math.cos(a))
    for s in (-1,1):
        # V-shaped cleft between the two lobes of each crab claw.
        x=s*.299
        claw='#efa5b2'
        ball((x,.00,1.192),1,claw,(.124,.073,.117),rot=(0,s*20,0),sub=3)
        tuft(x+s*.064,0,1.21,.073,.158,claw,s*14)
        tuft(x-s*.050,-.016,1.211,.059,.125,claw,-s*22)
        for dz in (0,.036):
            stroke([(s*.198,.928+dz),(s*.176,.940+dz),(s*.143,.945+dz)],.0085)
        tuft(s*.040,0,1.211,.015,.044,INK,s*13)
    with tail:
        ball((0,.275,.268),.055,'#fbe0db',sub=2)


def features(m, kind):
    eye_z = .823
    with m.part('eyes',front(0,eye_z),parent='head'):
        for s in (-1,1):
            x=s*.157
            if kind == 'momonga':
                oval(x,eye_z,.081,.065,INK)
                oval(x,eye_z+.014,.050,.025,'#fffdf6',.025,.008)
                oval(x+.005,eye_z-.027,.044,.010,'#f4e6e0',.026,.006)
            else:
                w,h = (.053,.052) if kind=='kurimanju' else (.066,.046) if kind=='rakko' else (.064,.067)
                face_patch(x,eye_z,w,h,INK,.009)
                face_patch(x+.004,eye_z+h*.32,w*.41,h*.33,'#fffcf8',.014)
                stroke([(x-w*.41,eye_z-h*.34),(x-w*.18,eye_z-h*.45),
                        (x+w*.08,eye_z-h*.47),(x+w*.35,eye_z-h*.32)],.0055,'#fff9f2',.018)
    if kind == 'hachiware':
        hachiware_mouth(m)
        return
    with m.part('mouth',front(0,.737),parent='head'):
        for s in (-1,1):
            stroke([(0,.752),(s*.004,.735),(s*.018,.724),(s*.037,.725),(s*.054,.739)],.0095)
        if kind == 'usagi':
            stroke([(-.020,.722),(-.015,.698),(0,.682),(.023,.680)],.008)
        elif kind in ('momonga','kanichan'):
            oval(0,.700,.033,.042,INK,.013,.010)
            if kind=='momonga':
                oval(0,.700,.021,.025,'#fff6f1',.026,.008)
            else:
                oval(0,.721,.011,.009,'#fffaf4',.027,.007)
            stroke([(-.015,.641),(0,.637),(.015,.641)],.006)
        else:
            stroke([(-.016,.691),(0,.687),(.017,.691)],.0065)
    with m.part('mouth_open',front(0,.73),parent='head'):
        oval(0,.731,.049,.041,INK)
        oval(0,.719,.031,.018,'#f49b9e',.023,.007)


def hachiware_mouth(m):
    for part, half_height in [('mouth',.047),('mouth_open',.061)]:
        with m.part(part,front(0,.675),parent='head'):
            face_patch(0,.704-half_height,.050,half_height,INK,.011)
            face_patch(0,.687-half_height,.027,half_height*.56,'#f3a8aa',.017)
            for s in (-1,1):
                stroke([(0,.733),(s*.004,.710),(s*.017,.699),(s*.036,.694),
                        (s*.055,.699),(s*.071,.716)],.012,INK,.022)
            stroke([(-.015,.587),(0,.584),(.015,.587)],.0065)


# 이름은 저장·멀티플레이에서 쓰는 기존 ID로 등록한다.
FRIENDS = {
    'dalgom': (chiikawa,MILK,1.27), 'goran': (hachiware,MILK,1.36),
    'nureong': (usagi,CREAM,1.65), 'beomi': (rakko,'#f4debb',1.24),
    'jangkki': (kurimanju,'#f6deb5',1.24), 'pongdang': (shisa,'#ffe8b1',1.27),
    'sandeul': (kanichan,'#fbe0db',1.38), 'dahong': (momonga,MILK,1.35),
}
PAJAMAS = {'dungdung':'#a3ca80', 'kkokki':'#ed9fa9',
           'dodam':'#f6efdf', 'pogeun':'#b6a5d8'}


def small_friend(name):
    key = name.removeprefix('villager_')
    night = key in PAJAMAS
    is_hachi = key == 'goran'
    fur = PAJAMAS[key] if night else FRIENDS[key][1]
    with Model(name) as m:
        head=m.part('head',(0,0,.54))
        body=m.part('body',(0,0,.26))
        with body:
            if is_hachi:
                lathe([(0,.118),(.12,.120),(.216,.143),(.27,.192),(.312,.281),
                       (.338,.391),(.339,.495),(.31,.574),(.235,.609),(0,.625)],
                      fur,seg=48,scale=(1,.81))
            else:
                lathe([(0,.132),(.14,.132),(.216,.154),(.266,.202),(.284,.282),
                       (.296,.371),(.293,.482),(.247,.546),(0,.566)],fur,seg=40,scale=(1,.78))
        tail=m.part('tail',(0,.235,.31)) if key not in ('jangkki',) and not night else None
        with head:
            profile = PROFILE
            if is_hachi:
                # 턱 아래를 닫고 몸통을 안쪽으로 겹쳐 고개를 돌려도 목이 이어진다.
                profile = [(0,.452),(.172,.454),(.299,.466),(.394,.492),(.458,.531),
                           (radius(.575),.575)] + [(r,z) for r,z in PROFILE if z>.575]
            lathe(profile,fur,seg=64,scale=(1,DEPTH))
            if night:
                face_patch(0,.814,.418,.295,'#e1dbce',.011)
                face_patch(0,.818,.387,.268,'#667678',.019)
                for s in (-1,1):
                    for k in (-1,0,1):
                        x=s*.233+k*.032
                        stroke([(x-.009,.804),(x+.003,.829)],.007,'#455258',.028)
                if key=='dungdung':
                    for s in (-1,1):
                        tuft(s*.168,.012,1.167,.057,.116,fur,s*15)
                elif key=='kkokki':
                    for s in (-1,1):
                        ball((s*.269,.008,1.122),1,fur,(.078,.066,.079),sub=3)
                else:
                    tuft(.037,.02,1.199,.041,.094,fur,20 if key=='dodam' else -25)
                oval(0,.399,.025,.025,'#fff7dc',.009)
                oval(0,.307,.022,.022,'#fff7dc',.009)
            else:
                style = FRIENDS[key][0]
                style(head,tail)
                for s in (-1,1):
                    face_patch(s*.282,.691,.080,.061,PINK,.008)
                    for dx in (-.047,-.016,.016,.047):
                        x=s*.282+dx
                        stroke([(x-.008,.666),(x+.008,.714)],.007,INK,.018)
                features(m,style.__name__)
        if key=='beomi':
            with body: back_sword()
        for s,side in [(-1,'R'),(1,'L')]:
            shoulder=(s*.316,-.017,.488) if is_hachi else (s*.418,-.026,.544)
            with m.part('arm_'+side,shoulder):
                if is_hachi:
                    ball((s*.369,-.037,.420),1,fur,(.054,.065,.130),rot=(-6,-s*22,0),sub=3)
                elif key=='beomi':
                    capsule((s*.383,-.098,.451),(s*.245,-.247,.372),.063,fur)
                    ball((s*.223,-.267,.375),1,'#3d2c2b',(.079,.065,.062),sub=3)
                elif key=='pongdang' or night:
                    ball((s*.445,-.058,.516),1,fur,(.074,.075,.115),rot=(-9,-s*48,0),sub=3)
                elif key=='jangkki' and s<0:
                    capsule((-.405,-.08,.491),(-.350,-.301,.421),.060,fur)
                elif (key=='sandeul' and s>0) or (key in ('dalgom','dahong') and s<0):
                    capsule((s*.422,-.066,.499),(s*.427,-.147,.551),.062,fur)
                    ball((s*.415,-.153,.563),.067,fur,(1,.93,1.06),sub=3)
                else:
                    ball((s*.436,-.073,.488),1,fur,(.067,.077,.110),rot=(-17,-s*12,0),sub=3)
            leg_x = .134 if is_hachi else .196
            with m.part('leg_'+side,(s*leg_x,0,.17)):
                ball((s*(leg_x+.007),-.038,.093),1,'#3d2c2b' if key=='beomi' else fur,(.065 if is_hachi else .075,.105,.095),rot=(0,s*8,0),sub=3)
        m.anchor('hand',(-.398,-.055,.335) if is_hachi else (-.454,-.097,.427),'arm_R')
        m.anchor('top',(0,0,(1.30 if night else FRIENDS[key][2])+.08))


def armor(name, role):
    gold=role=='ramen'
    steel,light,edge,joint = (('#d5ca65','#e2d978','#aa9d4f','#625843') if gold else
                              (('#c9c6c7','#dedadb','#969191','#655c5a') if role=='pochette' else ('#b8aeaa','#cfc4be','#90837f','#5c504e')))
    with Model(name) as m:
        with m.part('body',(0,0,.48)):
            ball((0,0,.70),1,joint,(.222,.173,.264),sub=3)
            lathe([(.20,.567),(.237,.615),(.255,.796),(.196,.895),(.13,.928)],
                  steel,scale=(1,.77),seg=28)
            for r,z in [(.205,.475),(.214,.53),(.221,.582)]:
                lathe([(r,0),(r+.012,.025),(r-.014,.076)],steel,
                      center=(0,0,z),scale=(1,.78),seg=20)
            if role=='pochette':
                for a,b in [((.16,-.118,.869),(.079,-.203,.777)),
                            ((.079,-.203,.777),(-.051,-.205,.653)),
                            ((-.051,-.205,.653),(-.155,-.173,.555))]:
                    capsule(a,b,.016,'#996b60')
                ball((-.154,-.164,.531),1,'#e89dac',(.115,.053,.096),sub=3)
                for s in (-1,1):
                    ball((-.154+s*.07,-.169,.608),.036,'#e89dac',sub=2)
                    ball((-.154+s*.036,-.216,.545),.009,INK,sub=2)
                ball((-.154,-.214,.515),1,'#fff3dc',(.054,.015,.037),sub=3)
                ball((-.154,-.230,.529),.009,INK,sub=2)
                for s in (-1,1):
                    capsule((-.154,-.231,.515),(-.154+s*.019,-.229,.506),.004,INK)
        with m.part('head',(0,0,.918)):
            profile=[(.105,.899),(.158,.922),(.209,.982),(.232,1.056),(.242,1.144),
                     (.235,1.215),(.201,1.270),(.155,1.307),(.09,1.333),(0,1.343)]
            lathe(profile,steel,seg=56,scale=(1,.94))
            def plate(x,z,lift=.005):
                for (r0,z0),(r1,z1) in zip(profile,profile[1:]):
                    if z0<=z<=z1:
                        radius=r0+(r1-r0)*(z-z0)/(z1-z0)
                        return (x,-.94*math.sqrt(max(.0001,radius*radius-x*x))-lift,z)
                return (x,0,z)
            def strip(xs,top,bottom,col,lift):
                vv=[]
                for x in xs: vv.extend([plate(x,top(x),lift),plate(x,bottom(x),lift)])
                poly(vv,[(2*j+1,2*j+3,2*j+2,2*j) for j in range(len(xs)-1)],col,smooth=True)
            def seam(points,col=edge,r=.005):
                for a,b in zip(points,points[1:]):capsule(plate(*a,.007),plate(*b,.007),r,col)
            visor='#463032'
            xs=[i*.226/28 for i in range(-28,29)]
            strip(xs,lambda x:1.142+.003*abs(x)/.226,
                  lambda x:1.116-.025*math.sin(abs(x)/.226*math.pi)+.024*(abs(x)/.226)**5,visor,.010)
            for s in (-1,1):
                seam([(s*.220,1.076),(s*.175,1.058),(s*.116,1.046),(s*.067,1.061)],edge)
                seam([(s*.209,1.035),(s*.158,1.020),(s*.075,1.009),(0,1.007)],edge,.004)
            xs=[i*.072/12 for i in range(-12,13)]
            strip(xs,lambda x:1.083-.021*(x/.072)**2,lambda x:1.016+.004*(x/.072)**2,visor,.014)
            for x in (-.046,0,.046):
                for z in (1.034,1.057):
                    strip([x-.017,x,x+.017],lambda a:z+.007,lambda a:z-.007,'#fff6dd',.021)
            seam([(0,1.001),(0,.936)],edge)
            if gold:
                lathe([(.244,1.148),(.246,1.168),(.239,1.222),(.209,1.277),(.158,1.316),(.08,1.343),(0,1.353)],
                      '#fffcf5',seg=56,scale=(1,.96))
            else:
                for s in (-1,1):
                    seam([(0,1.312),(s*.050,1.285),(s*.125,1.26),(s*.18,1.227),(s*.207,1.197)])
                seam([(0,1.272),(0,1.165)],edge,.004)
        for s,side in [(-1,'R'),(1,'L')]:
            with m.part('arm_'+side,(s*.235,0,.831)):
                capsule((s*.232,0,.806),(s*.292,-.014,.52),.062,joint)
                ball((s*.239,0,.81),1,light,(.105,.116,.09),sub=3)
                ball((s*.282,-.011,.624),1,steel,(.076,.083,.102),rot=(0,-s*10,0),sub=3)
                ball((s*.302,-.025,.503),.076,steel,(1,1,1.12),sub=3)
            with m.part('leg_'+side,(s*.117,0,.464)):
                capsule((s*.117,0,.443),(s*.137,0,.10),.076,joint)
                ball((s*.129,-.017,.317),1,steel,(.090,.085,.14),sub=3)
                ball((s*.135,-.054,.228),.078,light,(1,.80,.92),sub=2)
                ball((s*.138,-.013,.143),1,steel,(.08,.077,.108),sub=3)
                ball((s*.14,-.062,.062),1,steel,(.088,.135,.062),sub=3)
        m.anchor('hand',(-.304,-.045,.493),'arm_R')
        # In the original lineup the helmet fits four times into the standing height.
        for p in m.parts:
            if p.name == 'head':
                for v in p.bm.verts:
                    v.co.x *= .82
                    v.co.y *= .84
                    v.co.z = .918 + (v.co.z-.918)*.78
        m.anchor('top',(0,0,1.31))


RESIDENT_MODELS = {'villager_'+key: small_friend for key in (*FRIENDS,*PAJAMAS)}
RESIDENT_MODELS.update(npc_kkami=partial(armor,role='pochette'),
                       npc_duru=partial(armor,role='ramen'), npc_ujik=partial(armor,role='work'))
