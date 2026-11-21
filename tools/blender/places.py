"""Walk-up landmarks for the three destinations. Front faces local -Y."""
from lib import *
import math

TIMBER='#79543e'
DARK='#4e493f'
LIGHT='#c69d6e'


def lantern(x,y,z,r):
    ball((x,y,z),1,'#edab67',(r,r,r*1.25),sub=3)
    for t in [-.86,-.52,0,.52,.86]:
        torus((x,y,z+t*r),r*math.sqrt(1-(t/1.25)**2),.009,'#ba7550',seg=20,tseg=5)
    for side in [-1,1]:
        cyl((x,y,z+side*r*1.14-.025),r*.57,.05,DARK,seg=16)
    tube((x,y,z+r*1.2),(x,y,z+r*1.78),.014,DARK,seg=7)


def kitchen():
    with Model('place_noodle_shop'):
        boxb((0,.16,0),(5.5,2.28,.18),'#a69b87',bevel=.06)
        boxb((0,.95,.18),(5.3,.17,2.05),'#e8d5ae',bevel=.045)
        for x in (-2.55,-1.68,0,1.68,2.55):
            boxb((x,.82,.18),(.12,.18,2.22),TIMBER,bevel=.016)
        box((0,.75,1.10),(5.17,.12,.075),TIMBER)
        # Lacquered slatted counter and hand rail.
        boxb((-.05,-.65,.16),(4.68,.59,.65),'#9a6243',bevel=.03)
        for i in range(23):box((i*.20-2.25,-.955,.51),(.043,.046,.56),TIMBER,bevel=.009)
        box((-.05,-.65,.85),(4.92,.83,.12),LIGHT,bevel=.045)
        for x in [-2.50,2.50]:boxb((x,-.80,.16),(.15,.16,2.08),TIMBER,bevel=.02)
        # Shallow clerestory leaves the front of the kitchen open to the game camera.
        box((0,.16,2.44),(5.85,2.22,.18),'#565c5a',rot=(7,0,0),bevel=.045)
        for i in range(32):box((i*.18-2.79,.16,2.54),(.044,2.16,.045),'#6e7772',rot=(7,0,0),bevel=.014)
        box((0,-.92,2.33),(5.82,.17,.14),TIMBER,bevel=.018)
        for i in range(9):
            x=(i-4)*.40
            box((x,-.97,2.08),(.375,.046,.43),'#a55648' if i%2 else '#b4614c',bevel=.027)
            box((x,-1.002,1.93),(.36,.012,.025),'#cf9a73')
        for x in [-2.24,2.24]:lantern(x,-1.02,1.85,.23)
        for i in range(3):
            for j in range(2+i%2):
                lathe([(.09,0),(.12,.02),(.21,.11),(.20,.13),(.16,.115)],'#ece0c2',center=(-1.62+i*.48,-.51,.92+j*.055),seg=20)
        for x in [.22,.45]:
            cyl((x,-.63,.91),.072,.18,'#a5754f',seg=12)
            for j in range(4):tube((x+(j-1.5)*.019,-.63,1.04),(x+(j-1.5)*.034,-.61,1.34),.009,LIGHT,seg=6)
        # Stockpot with broth, a coiled noodle ladle, and side handles.
        lathe([(.24,0),(.30,.06),(.31,.39),(.325,.42),(.30,.44)],'#9ca9a2',center=(1.29,-.57,.91),seg=30)
        cyl((1.29,-.57,1.32),.288,.014,'#bf9e69',seg=32)
        for s in [-1,1]:torus((1.29+s*.32,-.57,1.21),.078,.018,DARK,seg=12,tseg=6,rot=(90,0,0))
        tube((1.54,-.49,1.28),(1.71,-.43,1.65),.024,TIMBER,seg=8)


def work_shelter():
    with Model('place_field_shelter'):
        for x in [-1.33,1.33]:
            for y in [-.58,.58]:tube((x,y,0),(x,y,1.90),.076,TIMBER,seg=9)
        for s in [-1,1]:
            box((0,s*.47,2.07),(3.12,1.14,.10),'#88a489',rot=(s*-18,0,0),bevel=.045)
            box((0,s*1.0,1.86),(3.13,.10,.16),'#617e69',bevel=.025)
        box((0,0,2.24),(3.15,.14,.13),LIGHT,bevel=.025)
        boxb((0,.49,.28),(1.98,.13,1.02),'#927650',bevel=.04)
        for i in range(3):box(((i-1)*.53,.41,.90+(.04 if i==1 else 0)),(.38,.03,.45),'#e8d5aa',rot=(0,(i-1)*6,0),bevel=.012)
        box((0,-.17,.60),(2.7,.65,.11),LIGHT,bevel=.045)
        for x in [-1.03,1.03]:boxb((x,-.15,.0),(.11,.49,.60),TIMBER)
        for i in range(3):box((-.71+i*.04,-.18,.68+i*.012),(.48,.31,.014),'#f1dfb5',rot=(0,0,i*4))
        lantern(1.18,-.59,1.47,.14)
    with Model('place_harvest_basket'):
        lathe([(.24,0),(.29,.06),(.36,.37),(.33,.40),(.28,.34),(.22,.08)],'#ba9362',seg=18)
        for z in [.08,.15,.22,.29,.37]:torus((0,0,z),.255+z*.25,.014,'#9a764e',seg=18,tseg=5)
        for i in range(8):
            a=i*math.tau/8;tube((.26*math.cos(a),.26*math.sin(a),.04),(.35*math.cos(a),.35*math.sin(a),.38),.012,LIGHT,seg=6)
        for i in range(8):
            a=i*2.4;x=.21*math.cos(a);y=.21*math.sin(a)
            tube((x*.65,y*.65,.24),(x*1.25,y*1.25,.47+i%3*.065),.023,'#7b945b',r2=.008,seg=7)


def grotto():
    with Model('place_cave_home'):
        # Set-back dark alcove surrounded by rounded weathered stones, with an open threshold.
        ball((0,.53,1.01),1,'#444d49',(1.45,.38,1.04),sub=3)
        for i in range(13):
            a=i*math.pi/12;x=1.69*math.cos(a);z=.38+1.56*math.sin(a)
            lump((x,.14+.09*math.sin(4*a),z),1,['#9b9c89','#939986','#a8a793'][i%3],
                 (.52,.62,.45+(i%3)*.10),seed=35+i,amp=.14,smooth=True)
        for s in [-1,1]:
            for i in range(3):lump((s*(1.70+i*.27),.46+i*.25,.24),1,'#909887',(.56,.50,.49),seed=i+12,amp=.17,smooth=True)
        for i in range(7):
            a=.24+i*.41;ball((1.68*math.cos(a),-.025,.65+1.58*math.sin(a)),1,'#86956b',(.37,.27,.13),sub=2)
        boxb((0,-.35,0),(1.74,1.26,.13),'#b9aa87',bevel=.09)
        box((-.47,-.30,.17),(.65,.64,.06),'#9a9a6e',bevel=.035)
    with Model('place_cave_lamp'):
        cyl((0,0,0),.20,.11,'#766951',seg=12)
        tube((0,0,.10),(0,0,1.38),.049,TIMBER,seg=8)
        tube((0,0,1.26),(.29,0,1.37),.041,TIMBER,seg=8)
        lantern(.25,0,1.05,.16)


def build():
    kitchen();work_shelter();grotto()
