// SafeRoad 가상 시뮬레이션용 데이터셋 및 행정구역 매핑

// 1. 전국 시도 및 구군 교통지점 매핑 테이블 (지도 비행 및 코드 변환용)
const regionMapData = {
  "11": {
    name: "서울특별시",
    guguns: {
      "680": { name: "강남구", lat: 37.4979, lng: 127.0276 },
      "110": { name: "종로구", lat: 37.5730, lng: 126.9790 },
      "710": { name: "송파구", lat: 37.5140, lng: 127.1060 },
      "440": { name: "마포구", lat: 37.5620, lng: 126.9080 },
      "560": { name: "영등포구", lat: 37.5260, lng: 126.8960 }
    }
  },
  "26": {
    name: "부산광역시",
    guguns: {
      "110": { name: "중구", lat: 35.1060, lng: 129.0320 },
      "350": { name: "해운대구", lat: 35.1630, lng: 129.1630 },
      "380": { name: "사하구", lat: 35.1044, lng: 128.9675 }
    }
  },
  "41": {
    name: "경기도",
    guguns: {
      "110": { name: "수원시 팔달구", lat: 37.2820, lng: 127.0200 },
      "135": { name: "성남시 분당구", lat: 37.3820, lng: 127.1180 },
      "280": { name: "의정부시", lat: 37.7380, lng: 127.0330 }
    }
  }
};

// 2. 가상 체험용 모범 미로 데이터
const simulationAccidentData = [
  {
    id: 1,
    locationName: "강남역 사거리 부근",
    type: "pedestrian",
    typeName: "보행자 사고 다발지역",
    lat: 37.4979,
    lng: 127.0276,
    accidentCount: 14,
    deathCount: 1,
    heavyInjuryCount: 8,
    lightInjuryCount: 5,
    description: "유동 보행인구가 극도로 많아 무단횡단 사고 및 스마트폰 사용 중 전방 미주시 사고가 빈번합니다.",
    mazeLayout: [
      ['S', 'W', 'W', 'W', 'W', 'W', 'W', 'W'],
      ['S', 'S', 'R', 'R', 'R', 'R', 'S', 'E'],
      ['W', 'S', 'W', 'W', 'W', 'R', 'S', 'W'],
      ['W', 'S', 'S', 'T', 'S', 'R', 'S', 'W'],
      ['W', 'W', 'W', 'R', 'W', 'R', 'S', 'W'],
      ['W', 'R', 'R', 'R', 'R', 'R', 'S', 'W'],
      ['W', 'S', 'S', 'T', 'S', 'S', 'S', 'W'],
      ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W']
    ]
  },
  {
    id: 2,
    locationName: "명동역 인근 교차로",
    type: "elderly",
    typeName: "고령자 사고 다발지역",
    lat: 37.5609,
    lng: 126.9863,
    accidentCount: 9,
    deathCount: 0,
    heavyInjuryCount: 5,
    lightInjuryCount: 4,
    description: "재래시장 초입으로 노약자 통행량이 많습니다. 횡단 보행 속도가 느려 횡단보도 신호 대기 준수가 매우 중요합니다.",
    mazeLayout: [
      ['S', 'S', 'S', 'W', 'W', 'W', 'W', 'W'],
      ['W', 'W', 'S', 'W', 'S', 'S', 'S', 'E'],
      ['W', 'W', 'S', 'T', 'S', 'W', 'S', 'W'],
      ['W', 'S', 'S', 'W', 'W', 'W', 'S', 'W'],
      ['W', 'S', 'W', 'W', 'S', 'S', 'S', 'W'],
      ['W', 'S', 'T', 'R', 'R', 'R', 'W', 'W'],
      ['W', 'S', 'S', 'S', 'S', 'S', 'W', 'W'],
      ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W']
    ]
  },
  {
    id: 3,
    locationName: "잠실역 롯데월드 인근 스쿨존",
    type: "child",
    typeName: "어린이 보호구역 내 사고지역",
    lat: 37.5113,
    lng: 127.0982,
    accidentCount: 6,
    deathCount: 0,
    heavyInjuryCount: 2,
    lightInjuryCount: 4,
    description: "어린이 보호구역으로 사각지대 모퉁이 및 불법 주정차 차량에 의한 전방 가림 사고가 잦습니다. 모퉁이 일단정지가 필요합니다.",
    mazeLayout: [
      ['S', 'W', 'W', 'W', 'W', 'W', 'W', 'W'],
      ['S', 'B', 'R', 'R', 'S', 'S', 'S', 'E'],
      ['W', 'S', 'W', 'W', 'R', 'W', 'W', 'W'],
      ['W', 'S', 'S', 'B', 'R', 'R', 'S', 'W'],
      ['W', 'W', 'W', 'W', 'W', 'R', 'S', 'W'],
      ['W', 'S', 'S', 'S', 'T', 'S', 'S', 'W'],
      ['W', 'S', 'W', 'W', 'W', 'W', 'W', 'W'],
      ['W', 'S', 'S', 'S', 'S', 'S', 'S', 'W']
    ]
  },
  {
    id: 4,
    locationName: "홍대입구역 8번 출구 앞 이면도로",
    type: "bicycle",
    typeName: "자전거/이륜차 사고 다발지역",
    lat: 37.5575,
    lng: 126.9244,
    accidentCount: 11,
    deathCount: 1,
    heavyInjuryCount: 6,
    lightInjuryCount: 4,
    description: "대학가 골목길 및 자전거 경계로 이륜차/PM 유입 속도가 빠릅니다. 차로 횡단 시 시야 좌우 대기가 적극 요구됩니다.",
    mazeLayout: [
      ['S', 'S', 'R', 'R', 'R', 'R', 'S', 'E'],
      ['W', 'S', 'W', 'W', 'W', 'W', 'S', 'W'],
      ['W', 'S', 'T', 'S', 'S', 'T', 'S', 'W'],
      ['W', 'W', 'W', 'W', 'R', 'W', 'W', 'W'],
      ['W', 'S', 'S', 'B', 'R', 'S', 'S', 'W'],
      ['W', 'S', 'W', 'W', 'W', 'W', 'S', 'W'],
      ['W', 'S', 'S', 'S', 'S', 'S', 'S', 'W'],
      ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W']
    ]
  }
];

const defaultMazeLayout = [
  ['S', 'S', 'W', 'W', 'W', 'W', 'W', 'W'],
  ['W', 'S', 'S', 'W', 'S', 'S', 'S', 'E'],
  ['W', 'W', 'S', 'T', 'S', 'W', 'S', 'W'],
  ['W', 'S', 'S', 'W', 'W', 'W', 'S', 'W'],
  ['W', 'S', 'W', 'W', 'S', 'S', 'S', 'W'],
  ['W', 'S', 'T', 'R', 'R', 'B', 'W', 'W'],
  ['W', 'S', 'S', 'S', 'S', 'S', 'W', 'W'],
  ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W']
];

const pedestrianQuizData = [
  {
    question: "보행자 초록 신호가 깜빡일 때, 올바른 행동 수칙은 무엇일까요?",
    options: [
      "아직 초록불이므로 최대한 뛰어서 건너간다.",
      "이미 진입한 보행자는 신속히 건너고, 진입 전 보행자는 다음 신호를 대기한다.",
      "초록 신호이므로 아무 걱정 없이 천천히 걸어가도 된다."
    ],
    answer: 1,
    explanation: "보행자 깜빡이는 신호는 이미 횡단보도에 진입한 보행자는 신속하게 횡단을 완료하고, 아직 건너기 전인 보행자는 무리해서 진입하지 말고 다음 신호를 기다리라는 안전 약속입니다."
  },
  {
    question: "골목길이나 횡단보도를 건널 때 스마트폰을 보며 걷는 행위(스몸비)가 위험한 주요 이유는?",
    options: [
      "스마트폰 화면에 지문이 많이 묻어 위생에 좋지 않다.",
      "스마트폰을 떨어뜨려 액정이 파손될 우려가 있다.",
      "시야폭이 120도에서 10도 수준으로 좁아져 차량 진입을 인지하지 못한다."
    ],
    answer: 2,
    explanation: "보행 중 스마트폰을 사용하면 시야 각도가 급격히 좁아지고 소리 인지력이 떨어져 주변 차량이나 보행자와의 충돌 사고 위험이 76% 이상 급증합니다."
  }
];
