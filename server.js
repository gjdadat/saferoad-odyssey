const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const CONFIG_PATH = path.join(__dirname, 'config.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 백엔드 보유 행정구역 좌표 테이블 (체험 모드용 동적 핀 생성용)
const regionCoordinates = {
  "11": {
    "680": { name: "강남구", lat: 37.4979, lng: 127.0276 },
    "110": { name: "종로구", lat: 37.5730, lng: 126.9790 },
    "710": { name: "송파구", lat: 37.5140, lng: 127.1060 },
    "440": { name: "마포구", lat: 37.5620, lng: 126.9080 },
    "560": { name: "영등포구", lat: 37.5260, lng: 126.8960 }
  },
  "26": {
    "110": { name: "중구", lat: 35.1060, lng: 129.0320 },
    "350": { name: "해운대구", lat: 35.1630, lng: 129.1630 },
    "380": { name: "사하구", lat: 35.1044, lng: 128.9675 }
  },
  "41": {
    "110": { name: "수원시 팔달구", lat: 37.2820, lng: 127.0200 },
    "135": { name: "성남시 분당구", lat: 37.3820, lng: 127.1180 },
    "280": { name: "의정부시", lat: 37.7380, lng: 127.0330 }
  }
};

// 기본 체험용 사고지 템플릿 (각 사고타입별 특성 데이터셋)
const baseAccidentTemplates = [
  {
    templateId: 1,
    type: "pedestrian",
    typeName: "보행자 사고 다발지역",
    offsetLat: 0.005,
    offsetLng: -0.003,
    accidentCount: 14,
    deathCount: 1,
    heavyInjuryCount: 8,
    lightInjuryCount: 5,
    description: "유동 보행인구가 극도로 많아 무단횡단 사고 및 스마트폰 사용 중 전방 미주시 사고가 빈번합니다."
  },
  {
    templateId: 2,
    type: "elderly",
    typeName: "고령자 사고 다발지역",
    offsetLat: -0.004,
    offsetLng: 0.005,
    accidentCount: 9,
    deathCount: 0,
    heavyInjuryCount: 5,
    lightInjuryCount: 4,
    description: "재래시장 초입으로 노약자 통행량이 많습니다. 횡단 보행 속도가 느려 횡단보도 신호 대기 준수가 매우 중요합니다."
  },
  {
    templateId: 3,
    type: "child",
    typeName: "어린이 보호구역 내 사고지역",
    offsetLat: 0.003,
    offsetLng: 0.004,
    accidentCount: 6,
    deathCount: 0,
    heavyInjuryCount: 2,
    lightInjuryCount: 4,
    description: "어린이 보호구역으로 사각지대 모퉁이 및 불법 주정차 차량에 의한 전방 가림 사고가 잦습니다. 모퉁이 일단정지가 필요합니다."
  },
  {
    templateId: 4,
    type: "bicycle",
    typeName: "자전거/이륜차 사고 다발지역",
    offsetLat: -0.003,
    offsetLng: -0.004,
    accidentCount: 11,
    deathCount: 1,
    heavyInjuryCount: 6,
    lightInjuryCount: 4,
    description: "대학가 골목길 및 자전거 경계로 이륜차/PM 유입 속도가 빠릅니다. 차로 횡단 시 시야 좌우 대기가 적극 요구됩니다."
  }
];

// Helper: config 키 조회
function getApiKey() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return config.apiKey || null;
    } catch (e) {
      console.error("Config read error:", e);
      return null;
    }
  }
  return null;
}

// 1단계: 선택 지역에 따른 가상 핀 목록 동적 빌더 (체험 모드용)
function generateFallbackData(sido, gugun, filterType) {
  // 선택한 sido, gugun 중심 좌표 추적
  let centerLat = 37.4979; // 디폴트 강남구
  let centerLng = 127.0276;
  let regionName = "서울특별시 강남구";

  if (regionCoordinates[sido] && regionCoordinates[sido][gugun]) {
    const info = regionCoordinates[sido][gugun];
    centerLat = info.lat;
    centerLng = info.lng;
    
    // 시도 명칭 매핑
    const sidoName = sido === "11" ? "서울특별시" : (sido === "26" ? "부산광역시" : "경기도");
    regionName = `${sidoName} ${info.name}`;
  }

  // 필터링 적용된 템플릿 매핑
  const filteredTemplates = filterType === 'all'
    ? baseAccidentTemplates
    : baseAccidentTemplates.filter(t => t.type === filterType);

  return filteredTemplates.map(tpl => {
    return {
      id: tpl.templateId,
      locationName: `${regionName} ${tpl.typeName} 부근`,
      type: tpl.type,
      typeName: tpl.typeName,
      lat: centerLat + tpl.offsetLat,
      lng: centerLng + tpl.offsetLng,
      accidentCount: tpl.accidentCount,
      deathCount: tpl.deathCount,
      heavyInjuryCount: tpl.heavyInjuryCount,
      lightInjuryCount: tpl.lightInjuryCount,
      description: `${regionName} 일대 시뮬레이션 지점입니다. ${tpl.description}`
    };
  });
}

// API 키 저장 라우터 (POST)
app.post('/api/save-key', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) {
    return res.status(400).json({ success: false, message: "인증키가 입력되지 않았습니다." });
  }

  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ apiKey }, null, 2), 'utf8');
    console.log("API Key saved to config.json");
    res.json({ success: true, message: "API 키가 성공적으로 백엔드에 저장되었습니다." });
  } catch (err) {
    console.error("Config write error:", err);
    res.status(500).json({ success: false, message: "키 저장 중 파일 쓰기 오류가 발생했습니다." });
  }
});

// 공공데이터 중계 라우터 (GET - 시도/구군 파라미터 적용)
app.get('/api/accidents', async (req, res) => {
  const filterType = req.query.type || 'all';
  const sido = req.query.sido || '11';       // 디폴트 서울 (11)
  const gugun = req.query.gugun || '680';     // 디폴트 강남구 (680)
  const apiKey = getApiKey();

  // API 키가 없는 경우: 선택 지역 기반으로 동적 가상 핀 생성 리턴
  if (!apiKey) {
    console.log(`No API key. Simulating virtual data for region ${sido}-${gugun} (type: ${filterType})`);
    const fallbackData = generateFallbackData(sido, gugun, filterType);
    return res.json({ isRealtime: false, data: fallbackData });
  }

  try {
    console.log(`Fetching realtime public data for region ${sido}-${gugun} (type: ${filterType})`);
    
    const serviceKey = encodeURIComponent(apiKey);
    const searchYear = "2022";

    // 엔드포인트 분기
    let endpoint = "frequentzonePedestrian/getRestFrequentzonePedestrian";
    let typeName = "보행자 사고 다발지역";
    
    if (filterType === 'child') {
      endpoint = "frequentzoneChild/getRestFrequentzoneChild";
      typeName = "어린이 보호구역 내 사고지역";
    } else if (filterType === 'elderly') {
      endpoint = "frequentzoneOldman/getRestFrequentzoneOldman";
      typeName = "고령자 사고 다발지역";
    } else if (filterType === 'bicycle') {
      endpoint = "frequentzoneBicycle/getRestFrequentzoneBicycle";
      typeName = "자전거/이륜차 사고 다발지역";
    }

    // 공공데이터 API 호출 주소 바인딩
    const apiUrl = `http://apis.data.go.kr/B552061/${endpoint}?serviceKey=${serviceKey}&searchYearCd=${searchYear}&siDo=${sido}&guGun=${gugun}&type=json&numOfRows=10&pageNo=1`;

    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Public API returned status: ${response.status}`);
    }

    const json = await response.json();
    
    // 데이터 검증 및 폴백 매핑
    if (!json.items || !json.items.item || json.items.item.length === 0) {
      console.log(`Realtime API returned empty. Serving fallback simulation for region ${sido}-${gugun}`);
      const fallbackData = generateFallbackData(sido, gugun, filterType);
      return res.json({ isRealtime: false, data: fallbackData });
    }

    const rawItems = json.items.item;
    const mappedData = rawItems.map((item, idx) => {
      const lat = parseFloat(item.la_crd);
      const lng = parseFloat(item.lo_crd);
      
      const accidentCount = parseInt(item.occrrnc_cnt) || 0;
      const deathCount = parseInt(item.dth_dnv_cnt) || 0;
      const heavyInjuryCount = parseInt(item.se_dnv_cnt) || 0;
      const lightInjuryCount = parseInt(item.slInfo_dnv_cnt) || 0;

      return {
        id: idx + 100,
        locationName: item.spot_nm.trim(),
        type: filterType === 'all' ? 'pedestrian' : filterType,
        typeName: typeName,
        lat: lat,
        lng: lng,
        accidentCount: accidentCount,
        deathCount: deathCount,
        heavyInjuryCount: heavyInjuryCount,
        lightInjuryCount: lightInjuryCount,
        description: `실시간 공공데이터 연동 구역입니다. 총 ${accidentCount}건의 사고가 발생했으며, 특히 횡단 중 안전 확보를 실천해야 합니다.`
      };
    });

    console.log(`Successfully mapped ${mappedData.length} realtime records.`);
    res.json({ isRealtime: true, data: mappedData });

  } catch (error) {
    console.error("OpenAPI fetch failed:", error.message);
    const fallbackData = generateFallbackData(sido, gugun, filterType);
    res.json({ isRealtime: false, data: fallbackData, error: error.message });
  }
});

// Start listening
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`SafeRoad Server running on http://localhost:${PORT}`);
  console.log(`===================================================`);
});
