"""작업대에서 만드는 정원·여행 소품과 바느질 재료."""
import math
from lib import Model, arc, ball, box, boxb, cyl, disc, lathe, poly, torus, tube

HONEY, WICKER, BARK = '#d6a564', '#ad7949', '#785137'
FLAX, MOSS, INDIGO = '#f1dfb8', '#70885e', '#536d83'


def basket():
    with Model('f_picnic_basket'):
        for row in range(6):
            z = .035 + row * .047
            cyl((0, 0, z), .31 + row * .014, .051, HONEY if row % 2 else WICKER,
                seg=20, scale=(1, .73, 1))
        for i in range(16):
            a = math.tau * i / 16
            tube((.30*math.cos(a), .22*math.sin(a), .04),
                 (.385*math.cos(a), .28*math.sin(a), .31), .012, BARK, seg=5)
        box((0, -.015, .335), (.51, .39, .059), FLAX, bevel=.025)
        for x in (-.17, 0, .17):
            box((x, -.015, .367), (.048, .36, .008), '#c56358')
        arc((0, 0, .30), .36, .028, BARK, rot=(90, 0, 0))
        for x,y in [(-.14,.05), (.11,.09)]:
            ball((x,y,.40), .096, '#df8060')
            tube((x,y,.47),(x+.016,y,.53),.012,BARK)


def wildflowers():
    with Model('f_meadow_box'):
        boxb((0, 0, .06), (1.42,.57,.35), WICKER, bevel=.035)
        box((0,0,.414),(1.31,.46,.022),'#624e39',bevel=.012)
        for x in (-.59,.59):
            boxb((x,0,0),(.09,.60,.43),HONEY,bevel=.014)
        for i in range(10):
            x=-.57+(i%5)*.282 + (i//5)*.035
            y=-.12+(i//5)*.22
            h=.58+(.09,.015,.15)[i%3]
            tube((x,y,.40),(x+.025,y,h),.013,MOSS,seg=6)
            ball((x-.033,y,.51),.07,MOSS,(1,.45,.38),rot=(0,28,0))
            for petal in range(5):
                a=math.tau*petal/5
                ball((x+.025+.049*math.cos(a),y+.047*math.sin(a),h),.038,
                     ('#fff4d4','#dfa0ad','#b19ece')[i%3],(1,1,.7),sub=1)
            ball((x+.025,y,h+.022),.030,'#e8b34e',sub=1)


def kettle():
    with Model('f_camp_kettle'):
        for i in range(9):
            a=math.tau*i/9
            ball((.36*math.cos(a),.34*math.sin(a),.065),.11,'#969589',(1.1,.86,.64),sub=1)
        for y in (-.14,.14):
            tube((-.25,y,.09),(.25,-y,.09),.055,BARK,seg=9)
        for x,y in [(-.33,-.18),(.32,-.17),(0,.27)]:
            tube((x,y,.025),(0,0,.92),.025,BARK)
        tube((0,0,.91),(0,0,.76),.014,'#555651')
        lathe([(.10,.25),(.19,.28),(.21,.42),(.15,.52)],INDIGO,seg=18)
        cyl((0,0,.51),.16,.036,'#456072',seg=18)
        ball((0,0,.565),.045,BARK)
        tube((.13,-.015,.35),(.30,-.03,.47),.065,INDIGO,r2=.041)
        arc((0,0,.52),.17,.018,'#484b46',rot=(90,0,0),scale=(1,1.4,1))


def shell_lamp():
    with Model('f_shell_lamp'):
        cyl((0,0,0),.27,.08,'#a58b67',seg=18)
        torus((0,0,.079),.22,.022,HONEY)
        for i in range(9):
            angle=(i-4)*10
            a=math.radians(angle)
            ball((.26*math.sin(a),.04,.15+.26*math.cos(a)),.22,
                 ('#edbbac','#f6d8bd')[i%2],(.27,.34,1.42),rot=(0,angle,0))
        ball((0,-.095,.245),.12,'#fff1c4',(1,.93,.97))


def ramen_tray():
    with Model('f_ramen_tray'):
        boxb((0,0,.025),(.82,.56,.065),BARK,bevel=.045)
        lathe([(.12,.09),(.16,.115),(.27,.28),(.285,.31),(.27,.31),(.25,.27)],'#e9dfc5',seg=24,caps=False)
        torus((0,0,.302),.275,.015,'#a35448',seg=24)
        disc((0,0,.282),.257,'#b77945',seg=24)
        for i in range(4):
            arc((-.055+i*.032,-.035,.29),.09,.009,'#ead29a',a0=15,a1=270,seg=14)
        ball((.11,.055,.315),.07,'#fff0cc',(1,.8,.4))
        ball((.11,.055,.335),.038,'#dfa34c',(1,.8,.38))
        for x in (-.12,-.07):
            tube((x,-.24,.32),(x+.25,.24,.37),.013,BARK,seg=6)


def drying_rack():
    with Model('f_herb_rack'):
        for x in (-.52,.52):
            for y in (-.24,.24):
                tube((x,y,.02),(x,0,.98),.036,WICKER)
        tube((-.61,0,.88),(.61,0,.88),.033,BARK)
        for i,x in enumerate((-.34,-.11,.12,.35)):
            tube((x,0,.89),(x,0,.64),.012,HONEY,seg=6)
            for j in range(4):
                a=math.tau*j/4
                tip=(x+.066*math.cos(a),.06*math.sin(a),.35+.05*(j%2))
                tube((x,0,.69),tip,.013,MOSS,seg=6)
                ball(tip,.074,(MOSS,'#b096bf','#8fa482','#d7b869')[i],(.70,.55,1.36),sub=1)


def sewing():
    with Model('mat_cloth'):
        for i,c in enumerate((INDIGO,FLAX,MOSS)):
            box((.018*(i%2),0,.045+i*.073),(.46,.31,.085),c,bevel=.034)
        box((-.11,0,.236),(.043,.29,.013),FLAX)
    with Model('mat_cord'):
        cyl((0,0,0),.17,.045,WICKER)
        for i in range(6):
            torus((0,0,.058+i*.033),.117,.025,FLAX,seg=16)
        cyl((0,0,.25),.17,.04,WICKER)
    for name,cloth,trim,large in [('pocket_field',MOSS,FLAX,False),('pocket_travel',INDIGO,HONEY,True)]:
        with Model(name):
            arc((0,0,.46),.195,.027,trim,rot=(90,0,0),scale=(1,1.35,1))
            boxb((0,0,0),(.53,.26,.49),cloth,bevel=.08,seg=3)
            box((0,-.15,.33),(.46,.07,.23),cloth,bevel=.03)
            for x in ((-.13,.13) if large else (0,)):
                box((x,-.19,.29),(.048,.018,.13),trim,bevel=.008)
                ball((x,-.203,.292),.024,'#e4be76',(1,.55,1))


def ferry():
    with Model('village_ferry'):
        # 세 단면을 잇는 뱃전. 앞뒤를 좁히고 윗판은 걸터앉을 수 있게 넓힌다.
        outline=[(0,-1.57),(.48,-1.05),(.58,.64),(.40,1.28),(-.40,1.28),(-.58,.64),(-.48,-1.05)]
        for lower,upper,z0,z1,col in [(.67,.98,0,.30,INDIGO),(.98,1,.30,.37,FLAX)]:
            v=[(x*s,y*s,z) for s,z in [(lower,z0),(upper,z1)] for x,y in outline]
            n=len(outline)
            poly(v,[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],col)
        poly([(x,y,.37) for x,y in outline],[tuple(range(len(outline)))],HONEY)
        for y in (-.7,-.14,.72): box((0,y,.48),(.91,.17,.095),WICKER,bevel=.025)
        for x in (-.44,.44):
            for y in (-.38,.68):tube((x,y,.37),(x,y,1.13),.036,BARK)
        for i in range(5):
            box((-.44+i*.22,.15,1.16),(.228,1.40,.085),('#609588',FLAX)[i%2],bevel=.028)
        torus((.58,.38,.50),.145,.041,'#e68e55',rot=(0,90,0))
        tube((0,-1.2,.37),(0,-1.2,1.10),.024,BARK)
        poly([(0,-1.2,1.1),(0,-.83,.98),(0,-1.2,.85)],[(0,1,2),(2,1,0)],'#e5b250')


def build():
    basket()
    wildflowers()
    kettle()
    shell_lamp()
    ramen_tray()
    drying_rack()
    sewing()
    ferry()
