// A specimen has one home even when it can be caught at several fishing spots.
// Bounds are x-start, x-end, z-start, depth, and water height in gallery tiles.
export const habitats={
  fresh:[
    ['upper','강 상류 · 산골 여울','맑고 빠른 물이 바위 사이로 흘러요. 바닥 틈의 가재와 물살을 거슬러 헤엄치는 산천어를 살펴보세요.',[1,8,.2,3.7,2.5],'#438994','sancheoneo songeo gajae galgyeoni beodeulchi swiri eoreumchi kkeokji chamjonggae yeolmogeo'],
    ['middle','강 중류 · 자갈 여울','넓어진 강줄기의 자갈밭이에요. 피라미가 물살을 타고 모래무지는 강바닥 가까이 머물러요.',[9,16,.2,3.5,2.1],'#509991','pirami ssogari euneo napjaru hwangssogari moraemuji dolgogi dongsari'],
    ['lower','강 하류 · 느린 물길','흐름이 느려지고 수초 사이로 쉴 곳이 많아져요. 메기와 동자개는 바닥을, 잉어는 넓은 물길을 오갑니다.',[17,24.5,.2,3.7,2.15],'#698e78','bungeo mikkuraji ingeo megi baemjangeo bass jara dongjagae'],
    ['pond','연못 · 수초 정원','잔잔한 물가에서는 작은 송사리와 올챙이를 함께 볼 수 있어요. 연잎 그늘 바로 아래도 찾아보세요.',[2,10,10,3.9,1.35],'#7c9762','songsari geumbungeo gamulchi bluegill bingeo gaksibungeo bidaningeo olchaengi gaeguri'],
    ['mouth','강어귀 · 기수역','강물이 바닷물과 만나는 구간이에요. 강과 바다를 오가는 연어와 바닥을 걷는 참게가 있어요.',[18,26,10,4,2.2],'#589da4','yeoneo cheolgapsangeo hwangeo chamge gasigogi']
  ],
  sea:[
    ['ocean','대양 · 회유 수조','탁 트인 대양을 오가는 상어와 참다랑어 전시예요. 긴 유리창을 따라 물고기와 나란히 걸어 보세요.',[1,14,.2,4.7,3.55],'#185373','bangeo chamdarangeo gaebokchi sangeo nalchi dotsaechi goraesangeo gadarangeo'],
    ['cold','차가운 바다 · 깊은 층','햇빛이 줄어드는 푸른 수조예요. 명태·대구와 바닥에 몸을 숨기는 아귀를 찾아보세요.',[15,23,.2,4.4,2.85],'#344b75','galchi daegu myeongtae agwi'],
    ['drift','해파리 · 표류 수조','보름달물해파리는 물결에 실려 천천히 떠다녀요. 몸이 오므라들었다 펴지는 순간을 지켜보세요.',[24,31,.2,4,2.75],'#615e93','haepari'],
    ['school','연안 · 떼 지어 다니는 물고기','연안 수면 아래를 회유하는 물고기 전시예요. 전갱이와 고등어가 어느 높이를 지나는지 관찰해 보세요.',[1,9,8,3.5,2.15],'#36858f','jeongaengi godeungeo myeolchi samchi kkongchi ojingeo'],
    ['reef','암초 · 바위와 산호','바위 틈에 숨을 곳이 많아요. 해마는 해초 곁에 머물고 곰치는 바위 아래를 오갑니다.',[22,31,8,3.6,2.05],'#407d86','ureok chamdom bogeo muneo haema gamseongdom doldom jwichi gasibok huindongari gomchi'],
    ['sand','모래 바닥 · 대륙붕','넙치와 도다리는 바닥에 붙어 있고 가오리는 모래 위를 미끄러지듯 헤엄쳐요.',[2,10,16,3.5,1.52],'#749b95','neopchi dodari gaori chamjogi badageobuk'],
    ['tidal','갯벌 · 연안 하구','밀물에 바닷물이 들어오는 갯벌이에요. 숭어와 전어 아래에서 망둥어와 꽃게를 찾아보세요.',[22,30,16,3.5,1.6],'#77978d','sungeo nongeo mangdungeo jeoneo kkotge']
  ]
};
export function aquariumHabitats(water,fish){
  return habitats[water].map(([id,name,detail,bounds,color,ids])=>{
    const members=new Set(ids.split(' '));
    return {id,name,detail,bounds,color,species:fish.filter(sp=>members.has(sp.id))};
  });
}
